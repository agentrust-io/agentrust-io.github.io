/* Intel TDX v4 DCAP quote verification, for the browser and for Node.
 *
 * A port of agent_manifest._tdx_verify (agentrust-io/agent-manifest,
 * python/src/agent_manifest/_tdx_verify.py). The profile check, the nested
 * type-6 certification-data parse, every declared-length check and the four
 * fail-closed steps follow that file in the same order. CI runs both verifiers
 * over the committed GCP captures and over mutated copies of them, and fails if
 * they ever disagree (tools/tdx-differential.py, tools/check-tdx-verifier.mjs).
 *
 * WebCrypto does the ECDSA. The rest is parsing, and the only X.509 this file
 * understands is what an Intel PCK chain uses: EC keys on P-256 or P-384 with
 * ecdsa-with-SHA256/384/512 signatures. Anything else is rejected, never
 * skipped.
 */

// Intel SGX Provisioning Certification Root CA, byte-identical to the copy
// pinned in agent_manifest._tdx_verify. CI compares the two fingerprints.
export const INTEL_SGX_ROOT_CA_PEM = `-----BEGIN CERTIFICATE-----
MIICjzCCAjSgAwIBAgIUImUM1lqdNInzg7SVUr9QGzknBqwwCgYIKoZIzj0EAwIw
aDEaMBgGA1UEAwwRSW50ZWwgU0dYIFJvb3QgQ0ExGjAYBgNVBAoMEUludGVsIENv
cnBvcmF0aW9uMRQwEgYDVQQHDAtTYW50YSBDbGFyYTELMAkGA1UECAwCQ0ExCzAJ
BgNVBAYTAlVTMB4XDTE4MDUyMTEwNDUxMFoXDTQ5MTIzMTIzNTk1OVowaDEaMBgG
A1UEAwwRSW50ZWwgU0dYIFJvb3QgQ0ExGjAYBgNVBAoMEUludGVsIENvcnBvcmF0
aW9uMRQwEgYDVQQHDAtTYW50YSBDbGFyYTELMAkGA1UECAwCQ0ExCzAJBgNVBAYT
AlVTMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEC6nEwMDIYZOj/iPWsCzaEKi7
1OiOSLRFhWGjbnBVJfVnkY4u3IjkDYYL0MxO4mqsyYjlBalTVYxFP2sJBK5zlKOB
uzCBuDAfBgNVHSMEGDAWgBQiZQzWWp00ifODtJVSv1AbOScGrDBSBgNVHR8ESzBJ
MEegRaBDhkFodHRwczovL2NlcnRpZmljYXRlcy50cnVzdGVkc2VydmljZXMuaW50
ZWwuY29tL0ludGVsU0dYUm9vdENBLmRlcjAdBgNVHQ4EFgQUImUM1lqdNInzg7SV
Ur9QGzknBqwwDgYDVR0PAQH/BAQDAgEGMBIGA1UdEwEB/wQIMAYBAf8CAQEwCgYI
KoZIzj0EAwIDSQAwRgIhAOW/5QkR+S9CiSDcNoowLuPRLsWGf/Yi7GSX94BgwTwg
AiEA4J0lrHoMs+Xo5o/sX6O9QWxHRAvZUGOdRQ7cvqRXaqI=
-----END CERTIFICATE-----
`;

const QUOTE_HEADER_LEN = 48;
const TD_REPORT_LEN = 584;
export const OFF_MRTD = 136;
const OFF_RTMR0 = 328;
const OFF_REPORTDATA = 520;
const TDX_QUOTE_VERSION = 4;
const ATT_KEY_TYPE_ECDSA_P256 = 2;
const TEE_TYPE_TDX = 0x81;
const SGX_REPORT_LEN = 384;
const OFF_QE_REPORT_DATA = 320;
const CERT_TYPE_QE_REPORT = 6;
const CERT_TYPE_PCK_CHAIN = 5;

export const QUOTE_HEADER_LENGTH = QUOTE_HEADER_LEN;

/** The steps a result reports, in the order the Python verifier runs them. */
export const STEPS = [
  { id: 'profile', label: 'signed header declares TDX v4 with an ECDSA P-256 attestation key' },
  { id: 'quote-signature', label: 'attestation key signature over header and TD report' },
  { id: 'qe-binding', label: 'QE report binds the attestation key' },
  { id: 'qe-report-signature', label: 'QE report signed by the platform PCK certificate' },
  { id: 'pck-chain', label: 'PCK chain ends at the pinned Intel SGX Root CA' },
];

export class TdxVerificationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TdxVerificationError';
  }
}

function fail(message) {
  throw new TdxVerificationError(message);
}

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

export const hex = (bytes) => Array.from(bytes, (x) => x.toString(16).padStart(2, '0')).join('');

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Parse the quote header and TD report body. Mirrors parse_tdx_quote(strict=True). */
export function parseTdxQuote(quote) {
  if (quote.length < QUOTE_HEADER_LEN + TD_REPORT_LEN) {
    fail(`quote too short: ${quote.length} bytes, need ${QUOTE_HEADER_LEN + TD_REPORT_LEN}`);
  }
  const version = u16(quote, 0);
  const attKeyType = u16(quote, 2);
  const teeType = u32(quote, 4);
  if (version !== TDX_QUOTE_VERSION) fail(`unsupported TDX quote version ${version} (expected 4)`);
  if (attKeyType !== ATT_KEY_TYPE_ECDSA_P256) {
    fail(`unsupported TDX attestation key type ${attKeyType} (expected 2)`);
  }
  if (teeType !== TEE_TYPE_TDX) fail(`not a TDX quote: tee_type 0x${teeType.toString(16)}`);
  const body = quote.subarray(QUOTE_HEADER_LEN, QUOTE_HEADER_LEN + TD_REPORT_LEN);
  const rtmrs = [0, 1, 2, 3].map((i) => body.subarray(OFF_RTMR0 + i * 48, OFF_RTMR0 + i * 48 + 48));
  return {
    version,
    teeType,
    mrtd: body.subarray(OFF_MRTD, OFF_MRTD + 48),
    rtmrs,
    reportData: body.subarray(OFF_REPORTDATA, OFF_REPORTDATA + 64),
  };
}

/**
 * Parse the signature section, including the nested type-6 QE-report
 * certification data. Every length is declared by the quote, which is
 * untrusted, so each one is checked before it is used. Mirrors
 * parse_tdx_quote_signature.
 */
export function parseTdxQuoteSignature(quote) {
  if (quote.length < QUOTE_HEADER_LEN + TD_REPORT_LEN + 4) fail('quote too short to contain a signature');

  const signedBody = quote.subarray(0, QUOTE_HEADER_LEN + TD_REPORT_LEN);
  let off = QUOTE_HEADER_LEN + TD_REPORT_LEN;
  const authSize = u32(quote, off);
  off += 4;
  if (off + authSize > quote.length) {
    fail(`quote declares ${authSize} bytes of signature data, ${quote.length - off} available`);
  }
  const auth = quote.subarray(off, off + authSize);
  if (auth.length < 134) fail('truncated quote signature data');

  const quoteSignature = auth.subarray(0, 64);
  const attestationKey = auth.subarray(64, 128);
  const certType = u16(auth, 128);
  const certSize = u32(auth, 130);
  if (certType !== CERT_TYPE_QE_REPORT) {
    fail(`unexpected certification data type ${certType} (expected QE report)`);
  }
  if (134 + certSize > auth.length) {
    fail(`quote declares ${certSize} bytes of QE certification data, ${auth.length - 134} available`);
  }
  const certData = auth.subarray(134, 134 + certSize);
  if (certData.length < 448 + 6) fail('truncated QE certification data');

  const qeReport = certData.subarray(0, SGX_REPORT_LEN);
  const qeReportSignature = certData.subarray(SGX_REPORT_LEN, SGX_REPORT_LEN + 64);
  let o2 = SGX_REPORT_LEN + 64;
  const qeAuthSize = u16(certData, o2);
  o2 += 2;
  if (o2 + qeAuthSize + 6 > certData.length) {
    fail(`quote declares ${qeAuthSize} bytes of QE auth data, `
      + `${Math.max(0, certData.length - o2 - 6)} available before the PCK header`);
  }
  const qeAuthData = certData.subarray(o2, o2 + qeAuthSize);
  o2 += qeAuthSize;
  const pckCertType = u16(certData, o2);
  const pckSize = u32(certData, o2 + 2);
  o2 += 6;
  if (pckCertType !== CERT_TYPE_PCK_CHAIN) {
    fail(`unexpected PCK certification type ${pckCertType} (expected PEM chain)`);
  }
  if (o2 + pckSize > certData.length) {
    fail(`quote declares ${pckSize} bytes of PCK chain, ${certData.length - o2} available`);
  }

  return {
    signedBody,
    quoteSignature,
    attestationKey,
    qeReport,
    qeReportSignature,
    qeAuthData,
    pckChainPem: certData.subarray(o2, o2 + pckSize),
  };
}

/* ---- DER, only as much as a PCK chain needs ------------------------------ */

function tlv(buf, off, end) {
  if (off + 2 > end) fail('truncated DER element');
  const tag = buf[off];
  let len = buf[off + 1];
  let header = 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4 || off + 2 + n > end) fail('unsupported DER length');
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + buf[off + 2 + i];
    header += n;
  }
  const start = off + header;
  if (start + len > end) fail('DER element overruns its container');
  return { tag, start, end: start + len, whole: buf.subarray(off, start + len) };
}

function children(buf, el) {
  const out = [];
  for (let at = el.start; at < el.end;) {
    const child = tlv(buf, at, el.end);
    out.push(child);
    at = child.end;
  }
  return out;
}

function expectTag(el, tag, what) {
  if (!el || el.tag !== tag) fail(`certificate ${what} is missing or malformed`);
  return el;
}

function objectId(buf, el) {
  expectTag(el, 0x06, 'object identifier');
  const b = buf.subarray(el.start, el.end);
  if (b.length === 0 || b[b.length - 1] & 0x80) fail('certificate object identifier is truncated');
  const arcs = [];
  let value = 0;
  for (const byte of b) {
    value = value * 128 + (byte & 0x7f);
    if (!(byte & 0x80)) {
      arcs.push(value);
      value = 0;
    }
  }
  const first = arcs.shift();
  const head = first < 40 ? [0, first] : first < 80 ? [1, first - 40] : [2, first - 80];
  return [...head, ...arcs].join('.');
}

function certificateTime(buf, el) {
  const text = String.fromCharCode(...buf.subarray(el.start, el.end));
  let m;
  if (el.tag === 0x17 && (m = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(text))) {
    const yy = Number(m[1]);
    return Date.UTC(yy >= 50 ? 1900 + yy : 2000 + yy, m[2] - 1, m[3], m[4], m[5], m[6]);
  }
  if (el.tag === 0x18 && (m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(text))) {
    return Date.UTC(Number(m[1]), m[2] - 1, m[3], m[4], m[5], m[6]);
  }
  return fail('unsupported certificate time encoding');
}

const EC_PUBLIC_KEY = '1.2.840.10045.2.1';
const CURVES = { '1.2.840.10045.3.1.7': { name: 'P-256', size: 32 }, '1.3.132.0.34': { name: 'P-384', size: 48 } };
const SIGNATURE_HASHES = {
  '1.2.840.10045.4.3.2': 'SHA-256',
  '1.2.840.10045.4.3.3': 'SHA-384',
  '1.2.840.10045.4.3.4': 'SHA-512',
};

function commonName(buf, name) {
  for (const set of children(buf, name)) {
    for (const pair of children(buf, set)) {
      const [type, value] = children(buf, pair);
      if (type && value && objectId(buf, type) === '2.5.4.3') {
        return new TextDecoder().decode(buf.subarray(value.start, value.end));
      }
    }
  }
  return '';
}

/** Parse one DER certificate into the fields chain verification uses. */
export function parseCertificate(der) {
  const cert = tlv(der, 0, der.length);
  if (cert.tag !== 0x30 || cert.end !== der.length) fail('certificate is not a single DER SEQUENCE');
  const [tbs, signatureAlgorithm, signatureValue] = children(der, cert);
  expectTag(tbs, 0x30, 'TBSCertificate');
  expectTag(signatureAlgorithm, 0x30, 'signature algorithm');
  expectTag(signatureValue, 0x03, 'signature');

  const fields = children(der, tbs);
  const first = fields[0] && fields[0].tag === 0xa0 ? 1 : 0;
  const [, , issuer, validity, subject, spki] = fields.slice(first);
  expectTag(issuer, 0x30, 'issuer');
  expectTag(validity, 0x30, 'validity');
  expectTag(subject, 0x30, 'subject');
  expectTag(spki, 0x30, 'public key');

  const [notBefore, notAfter] = children(der, validity);
  if (!notBefore || !notAfter) fail('certificate validity is malformed');

  const [keyAlgorithm] = children(der, spki);
  expectTag(keyAlgorithm, 0x30, 'public key algorithm');
  const [keyType, curve] = children(der, keyAlgorithm);
  const ec = objectId(der, keyType) === EC_PUBLIC_KEY;

  if (der[signatureValue.start] !== 0) fail('certificate signature has unused bits');

  return {
    der,
    tbs: tbs.whole,
    spki: spki.whole,
    ec,
    curve: ec && curve && curve.tag === 0x06 ? CURVES[objectId(der, curve)] || null : null,
    hash: SIGNATURE_HASHES[objectId(der, children(der, signatureAlgorithm)[0])] || null,
    signature: der.subarray(signatureValue.start + 1, signatureValue.end),
    notBefore: certificateTime(der, notBefore),
    notAfter: certificateTime(der, notAfter),
    subjectCN: commonName(der, subject),
  };
}

/** Every CERTIFICATE block in a PEM bundle, leaf first. Rejects bad base64. */
export function pemCertificates(pemBytes) {
  let text = '';
  for (const byte of pemBytes) text += String.fromCharCode(byte);
  const blocks = [...text.matchAll(/-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g)];
  if (blocks.length === 0) fail('no certificates found in the PCK chain');
  return blocks.map(([, body]) => {
    const b64 = body.replace(/[\r\n\t ]/g, '');
    if (b64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) fail('PCK chain PEM is not valid base64');
    const raw = atob(b64);
    const der = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) der[i] = raw.charCodeAt(i);
    return der;
  });
}

/** DER ECDSA-Sig-Value to the raw r||s form WebCrypto verifies. */
function rawSignature(der, size) {
  const seq = tlv(der, 0, der.length);
  if (seq.tag !== 0x30 || seq.end !== der.length) fail('malformed ECDSA signature');
  const parts = children(der, seq);
  if (parts.length !== 2 || parts.some((p) => p.tag !== 0x02)) fail('malformed ECDSA signature');
  const out = new Uint8Array(size * 2);
  parts.forEach((part, k) => {
    let value = der.subarray(part.start, part.end);
    while (value.length > size && value[0] === 0) value = value.subarray(1);
    if (value.length > size) fail('ECDSA signature integer is too large');
    out.set(value, k * size + size - value.length);
  });
  return out;
}

const pemToDer = (pem) => pemCertificates(new TextEncoder().encode(pem))[0];

async function sha256(subtle, data) {
  return new Uint8Array(await subtle.digest('SHA-256', data));
}

async function certificateKey(subtle, cert, what) {
  if (!cert.ec) fail(`${what} is not an EC key`);
  if (!cert.curve) fail(`${what} uses an unsupported curve`);
  return subtle.importKey('spki', cert.spki, { name: 'ECDSA', namedCurve: cert.curve.name }, false, ['verify']);
}

/** SHA-256 of the pinned Intel root, hex. */
export async function pinnedRootFingerprint(subtle = globalThis.crypto && globalThis.crypto.subtle) {
  return hex(await sha256(subtle, pemToDer(INTEL_SGX_ROOT_CA_PEM)));
}

/**
 * Verify a TDX v4 DCAP quote. Resolves to a result object and never rejects:
 * `accepted` is true only when every step passed. A step the Python verifier
 * would answer with False and a step it would raise on are both a failed step
 * here, with `error` carrying the message.
 */
export async function verifyTdxQuote(input, options = {}) {
  const quote = input instanceof Uint8Array ? input : new Uint8Array(input);
  const subtle = options.subtle || (globalThis.crypto && globalThis.crypto.subtle);
  const now = options.verificationTime ? new Date(options.verificationTime) : new Date();
  const steps = STEPS.map((s) => ({ ...s, status: 'not-run', detail: '' }));
  const result = { accepted: false, error: null, steps, quote: null, chain: [], checkedAt: now.toISOString() };
  const step = (id) => steps.find((s) => s.id === id);
  let current = 'profile';
  const pass = (id, detail) => Object.assign(step(id), { status: 'pass', detail });
  const reject = (id, detail) => {
    Object.assign(step(id), { status: 'fail', detail });
    result.error = detail;
    return result;
  };

  try {
    if (!subtle) fail('this environment does not provide WebCrypto');

    const parsed = parseTdxQuote(quote);
    result.quote = {
      mrtd: hex(parsed.mrtd),
      rtmrs: parsed.rtmrs.map(hex),
      reportData: hex(parsed.reportData),
    };
    const sig = parseTdxQuoteSignature(quote);
    pass('profile', 'version 4, attestation key type 2, TEE type 0x81');

    current = 'quote-signature';
    const attestationKey = await subtle.importKey(
      'raw', concat(Uint8Array.of(4), sig.attestationKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'],
    );
    if (!await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, attestationKey, sig.quoteSignature, sig.signedBody)) {
      return reject(current, 'the attestation key signature does not match the header and TD report');
    }
    pass(current, `ECDSA P-256 over ${sig.signedBody.length} signed bytes`);

    current = 'qe-binding';
    const expected = await sha256(subtle, concat(sig.attestationKey, sig.qeAuthData));
    if (!bytesEqual(sig.qeReport.subarray(OFF_QE_REPORT_DATA, OFF_QE_REPORT_DATA + 32), expected)) {
      return reject(current, 'the QE report does not bind this attestation key');
    }
    pass(current, 'QE REPORTDATA equals SHA-256(attestation key, QE auth data)');

    // The Python verifier loads the chain and checks every validity period
    // before step 3, so a chain problem surfaces here, against step 4.
    current = 'pck-chain';
    const certs = pemCertificates(sig.pckChainPem).map(parseCertificate);
    result.chain = certs.map((c) => ({
      subject: c.subjectCN,
      notBefore: new Date(c.notBefore).toISOString(),
      notAfter: new Date(c.notAfter).toISOString(),
    }));
    if (certs.length < 2) fail('PCK chain must contain at least a leaf and the root');
    certs.forEach((c, i) => {
      if (!(c.notBefore <= now.getTime() && now.getTime() < c.notAfter)) {
        fail(`PCK chain certificate at position ${i} is outside its validity period`);
      }
    });

    current = 'qe-report-signature';
    const pck = certs[0];
    const pckKey = await certificateKey(subtle, pck, 'PCK certificate');
    if (!await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pckKey, sig.qeReportSignature, sig.qeReport)) {
      return reject(current, 'the PCK certificate did not sign this QE report');
    }
    pass(current, `signed by ${pck.subjectCN || 'the PCK leaf'}`);

    current = 'pck-chain';
    for (let i = 0; i < certs.length - 1; i++) {
      const issuer = certs[i + 1];
      const issuerKey = await certificateKey(subtle, issuer, 'PCK chain issuer');
      if (!certs[i].hash) fail(`PCK chain link ${i} has no supported signature hash algorithm`);
      const signature = rawSignature(certs[i].signature, issuer.curve.size);
      if (!await subtle.verify({ name: 'ECDSA', hash: certs[i].hash }, issuerKey, signature, certs[i].tbs)) {
        fail(`PCK chain link ${i} signature invalid`);
      }
    }
    const chainRoot = await sha256(subtle, certs[certs.length - 1].der);
    const pinned = await sha256(subtle, pemToDer(options.trustedRootPem || INTEL_SGX_ROOT_CA_PEM));
    if (!bytesEqual(chainRoot, pinned)) fail('PCK chain root does not match the pinned Intel SGX Root CA');
    pass(current, `${certs.length} certificates, all in date, root SHA-256 ${hex(pinned).slice(0, 16)}...`);

    result.accepted = true;
    return result;
  } catch (error) {
    return reject(current, error && error.message ? error.message : String(error));
  }
}
