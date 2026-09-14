import base64
import hashlib
import json
import pathlib
import time

from agentrust_trace.sign import sign_record
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

# Generated inside the TD. The private half is never serialized.
key = Ed25519PrivateKey.generate()
public = key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
report_data = hashlib.sha256(public).digest() + bytes(32)

report = pathlib.Path("/sys/kernel/config/tsm/report/agentrust-capture")
report.mkdir()
(report / "inblob").write_bytes(report_data)
quote = (report / "outblob").read_bytes()
provider = (report / "provider").read_text().strip()
generation = (report / "generation").read_text().strip()
report.rmdir()

b64u = lambda raw: base64.urlsafe_b64encode(raw).rstrip(b"=").decode()
mrtd = quote[48 + 136:48 + 184]
script_sha256 = hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()

record = {
    "eat_profile": "tag:agentrust-io.com,2026:trace-v0.3",
    "iat": int(time.time()),
    "subject": "spiffe://agentrust-io.com/capture/gcp-tdx-key-binding",
    "model": {"provider": "none", "model_id": "none: attestation capture, no model loaded"},
    "runtime": {
        "platform": "intel-tdx",
        "measurement": "sha384:" + mrtd.hex(),
        "firmware_version": "gcp-c3",
        "evidence": {
            "format": "tdx-quote-v4",
            "quote": b64u(quote),
            "collateral": "embedded",
            "binds": "cnf-key",
        },
    },
    # No policy governed this capture: the digest is of empty input and the mode
    # only declares, it enforces nothing.
    "policy": {"bundle_hash": "sha256:" + hashlib.sha256(b"").hexdigest(), "enforcement_mode": "declared"},
    "data_class": "public",
    # The digest is of this capture program, published beside the capture, so it
    # can be recomputed. SLSA level 0: nothing attests how the VM image was built.
    "build_provenance": {"slsa_level": 0, "digest": "sha256:" + script_sha256},
    "appraisal": {"status": "none", "verifier": "https://github.com/agentrust-io/agent-manifest"},
}
signed = sign_record(record, key)

bundle = json.dumps(
    {
        "quote_b64": base64.b64encode(quote).decode(),
        "public_key_b64u": b64u(public),
        "report_data_hex": report_data.hex(),
        "tsm_provider": provider,
        "tsm_generation": generation,
        "capture_script_sha256": script_sha256,
        "record": signed,
    },
    separators=(",", ":"),
).encode()
encoded = base64.b64encode(bundle).decode()
chunks = [encoded[i:i + 900] for i in range(0, len(encoded), 900)]
print(f"AGT-BUNDLE sha256={hashlib.sha256(bundle).hexdigest()} chunks={len(chunks)}", flush=True)
for i, chunk in enumerate(chunks):
    print(f"AGT-CHUNK {i:04d} {chunk}", flush=True)
