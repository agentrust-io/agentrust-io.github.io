"""Check the key-binding TDX capture published on /verify/.

verify/fixtures/gcp-tdx-2026-09-14-keybind_record.json carries a TRACE v0.3 record
signed inside a GCP C3 trust domain, with the quote that trust domain produced.
The page claims four things about it, and this checks each one with the Python
tools the page's JavaScript is held to:

1. the quote verifies to the pinned Intel SGX Root CA (agent_manifest._tdx_verify);
2. the record carries that exact quote, and claims its MRTD;
3. REPORT_DATA[0:32] is SHA-256 of the record's cnf.jwk.x, and the rest is zero;
4. the record signature verifies under that key, over the SDK's canonical bytes.

It also checks that the published capture program hashes to the digest the record
claims as its build provenance.

It does not validate the record against the TRACE v0.3 draft schema, which lives
in trace-spec, and it does not appraise TCB currency, revocation, or whether the
MRTD is an image anyone intended.
"""
import base64
import hashlib
import json
from pathlib import Path
import sys

from agent_manifest._tdx_verify import parse_tdx_quote, verify_tdx_quote
from agentrust_trace.sign import _canonical_bytes, _pubkey_from_jwk

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / 'verify' / 'fixtures'
FIXTURE = FIXTURES / 'gcp-tdx-2026-09-14-keybind_record.json'
PROFILE = 'tag:agentrust-io.com,2026:trace-v0.3'


def unb64u(text):
    return base64.urlsafe_b64decode(text + '=' * (-len(text) % 4))


def main():
    fixture = json.loads(FIXTURE.read_text(encoding='utf-8'))
    record = fixture['record']
    quote = (FIXTURES / fixture['quote_file']).read_bytes()
    failures = []

    def check(condition, message):
        if not condition:
            failures.append(message)

    check(record.get('eat_profile') == PROFILE, f'record profile is not {PROFILE}')
    check(verify_tdx_quote(quote) is True, 'quote does not verify to the pinned Intel root')

    parsed = parse_tdx_quote(quote)
    evidence = record['runtime']['evidence']
    check(evidence.get('format') == 'tdx-quote-v4', 'evidence format is not tdx-quote-v4')
    check(unb64u(evidence['quote']) == quote, 'record does not carry the published quote')
    check(record['runtime'].get('measurement') == 'sha384:' + parsed.mrtd.hex(), 'record does not claim the quote MRTD')

    jwk = record['cnf']['jwk']
    key = unb64u(jwk['x'])
    check(jwk.get('kty') == 'OKP' and jwk.get('crv') == 'Ed25519', 'record key is not Ed25519')
    check(jwk['x'] == fixture['public_key_b64u'], 'fixture key differs from the record key')
    check(parsed.report_data == hashlib.sha256(key).digest() + bytes(32), 'REPORT_DATA does not commit to the record key')
    check(parsed.report_data.hex() == fixture['report_data_hex'], 'fixture REPORT_DATA differs from the quote')

    body = _canonical_bytes({k: v for k, v in record.items() if k != 'signature'})
    try:
        _pubkey_from_jwk(jwk).verify(unb64u(record['signature']), body)
    except Exception as error:
        failures.append(f'record signature does not verify: {type(error).__name__}')

    program = (FIXTURES / 'gcp-tdx-2026-09-14-capture.py').read_bytes()
    digest = hashlib.sha256(program).hexdigest()
    check(digest == fixture['capture_script_sha256'], 'published capture program differs from the one that ran')
    check(record['build_provenance'].get('digest') == 'sha256:' + digest, 'record build provenance is not the capture program')

    if failures:
        print('\n'.join(f'FAIL {f}' for f in failures))
        return 1
    print('PASS key-binding capture: quote verifies, REPORT_DATA commits to the record key, record signature verifies')
    return 0


if __name__ == '__main__':
    sys.exit(main())
