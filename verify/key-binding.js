/* Checks what the 2026-09-14 capture adds over a bare quote: its REPORTDATA
 * commits to the signing key of the TRACE record published beside it, which is
 * the `attested` grade in trace-spec's runtime evidence profile
 * (REPORT_DATA[0:32] == SHA-256 of the record's cnf.jwk.x).
 *
 * The record signature is not checked here. That needs the SDK's canonical JSON,
 * and a second canonicalizer in a page about evidence would be its own problem,
 * so CI checks it with the Python SDK instead: see tools/check-key-binding.py.
 */
import { hex } from './tdx-verify.js';

const unb64u = (text) => Uint8Array.from(
  atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4)),
  (c) => c.charCodeAt(0),
);

const sameBytes = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

export async function checkKeyBinding(result, record, quote) {
  const jwk = (record && record.cnf && record.cnf.jwk) || {};
  const evidence = (record && record.runtime && record.runtime.evidence) || {};
  const keyHash = jwk.kty === 'OKP' && typeof jwk.x === 'string'
    ? hex(new Uint8Array(await crypto.subtle.digest('SHA-256', unb64u(jwk.x))))
    : null;
  return {
    keyHash,
    bound: Boolean(result.accepted && result.quote && keyHash && result.quote.reportData.slice(0, 64) === keyHash),
    sameQuote: typeof evidence.quote === 'string' && sameBytes(unb64u(evidence.quote), quote),
    sameMeasurement: Boolean(result.quote) && record.runtime.measurement === `sha384:${result.quote.mrtd}`,
  };
}
