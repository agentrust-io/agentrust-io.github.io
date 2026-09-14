"""Record what agent-manifest's Python TDX verifier decides, for the browser port to match.

verify/tdx-verify.js is a port of agent_manifest._tdx_verify. A port that agrees
on two genuine quotes can still disagree on everything else, and a verifier that
accepts something its original rejects is worse than no verifier. So this script
takes both committed captures, derives a deterministic set of mutations from
them (every byte of each length and type field, dense coverage of the PEM
boundaries, a stride over everything else, and truncations at each structure
edge) and records the Python verdict for each one.

tools/check-tdx-verifier.mjs rebuilds the same mutations from this file's output
and fails if the port accepts or rejects any of them differently.

Usage: python tools/tdx-differential.py --out differential.json
"""
import argparse
import hashlib
import json
import struct
from datetime import datetime, timezone
from pathlib import Path

from agent_manifest import _tdx_verify
from agent_manifest._tdx_verify import verify_tdx_quote
from cryptography import x509
from cryptography.hazmat.primitives import hashes

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "verify" / "fixtures"
CAPTURES = [
    "gcp-tdx-2026-07-21-tdx_quote.bin",
    "gcp-tdx-2026-07-21-tdx_quote_manifest.bin",
    "gcp-tdx-2026-09-14-keybind_quote.bin",
]
# Fixed, so a certificate expiring can never make the two runs disagree.
VERIFICATION_TIME = "2026-09-14T00:00:00+00:00"
STRIDE = 5


def offsets(quote: bytes) -> list[int]:
    """Byte offsets to flip, derived from the quote's own declared layout."""
    auth_size = struct.unpack_from("<I", quote, 632)[0]
    auth = 636
    cert_data = auth + 134
    qe_auth_size = struct.unpack_from("<H", quote, cert_data + 448)[0]
    pck_header = cert_data + 450 + qe_auth_size
    pem = pck_header + 6
    pem_end = auth + auth_size
    dense = [
        range(0, 48),                        # signed header
        range(632, 636),                     # signature data length
        range(auth + 128, auth + 134),       # certification data type and length
        range(cert_data + 448, cert_data + 450),  # QE auth data length
        range(pck_header, pck_header + 6),   # PCK chain type and length
        range(pem, pem + 64),                # first PEM marker and body start
        range(pem_end - 64, pem_end + 8),    # last PEM marker and what follows
    ]
    chosen = set(range(0, len(quote), STRIDE))
    for r in dense:
        chosen.update(i for i in r if 0 <= i < len(quote))
    # Every PEM newline and marker dash, where a tolerant parser would differ.
    for i in range(pem, pem_end):
        if quote[i] in (0x0A, 0x2D):
            chosen.add(i)
    return sorted(chosen)


def truncations(quote: bytes) -> list[int]:
    auth_size = struct.unpack_from("<I", quote, 632)[0]
    edges = [0, 47, 48, 631, 632, 635, 636, 700, 764, 769, 770, 1153, 1218, 1257, 1258, 636 + auth_size - 1, 636 + auth_size]
    return sorted({e for e in edges if 0 <= e <= len(quote)})


def verdict(quote: bytes, when: datetime) -> dict:
    try:
        ok = verify_tdx_quote(quote, verification_time=when)
        return {"accepted": ok is True, "outcome": "true" if ok is True else "false"}
    except Exception as exc:  # noqa: BLE001 - every failure mode is a rejection
        return {"accepted": False, "outcome": "raise", "error": type(exc).__name__}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    when = datetime.fromisoformat(VERIFICATION_TIME).astimezone(timezone.utc)
    root = x509.load_pem_x509_certificate(_tdx_verify.INTEL_SGX_ROOT_CA_PEM)
    report = {
        "verification_time": VERIFICATION_TIME,
        "pinned_root_sha256": root.fingerprint(hashes.SHA256()).hex(),
        "captures": {},
        "cases": [],
    }
    for name in CAPTURES:
        quote = (FIXTURES / name).read_bytes()
        parsed = _tdx_verify.parse_tdx_quote(quote)
        report["captures"][name] = {
            "sha256": hashlib.sha256(quote).hexdigest(),
            "mrtd": parsed.mrtd.hex(),
            "report_data": parsed.report_data.hex(),
        }
        report["cases"].append({"capture": name, "mutation": {"type": "none"}, **verdict(quote, when)})
        for offset in offsets(quote):
            mutated = bytearray(quote)
            mutated[offset] ^= 0xFF
            report["cases"].append(
                {"capture": name, "mutation": {"type": "flip", "offset": offset}, **verdict(bytes(mutated), when)}
            )
        for length in truncations(quote):
            report["cases"].append(
                {"capture": name, "mutation": {"type": "truncate", "length": length}, **verdict(quote[:length], when)}
            )

    Path(args.out).write_text(json.dumps(report, indent=1) + "\n", encoding="utf-8")
    accepted = sum(c["accepted"] for c in report["cases"])
    print(f"recorded {len(report['cases'])} Python verdicts ({accepted} accepted) to {args.out}")


if __name__ == "__main__":
    main()
