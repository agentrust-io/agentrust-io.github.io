#!/usr/bin/env node
/**
 * Checks verify/tdx-verify.js, the in-browser port of agent_manifest._tdx_verify.
 *
 * Without an argument it runs the checks that need nothing but this repository:
 * the committed captures are the ones the hardware produced, both verify, a
 * tampered one and an expired chain are rejected at the right step.
 *
 * With the JSON written by tools/tdx-differential.py it also replays every
 * recorded mutation and fails if the port and the Python original disagree on
 * any of them. CI always passes the JSON; see .github/workflows/verifier.yml.
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  verifyTdxQuote, pinnedRootFingerprint, OFF_MRTD, QUOTE_HEADER_LENGTH,
} from '../verify/tdx-verify.js';

const root = new URL('../', import.meta.url);
const WHEN = '2026-09-14T00:00:00Z';

// Pinned in agent-manifest's tests/test_tdx_verify.py for the same files, so a
// swapped or re-captured fixture fails here rather than changing what
// "a genuine quote" refers to on the public page.
const CAPTURES = {
  'gcp-tdx-2026-07-21-tdx_quote.bin': 'f9efbac112efe510aa8ccd20703b063591b8c2c54c474d0ff1d6500299bae0ba',
  'gcp-tdx-2026-07-21-tdx_quote_manifest.bin': '1ae04c74b564ef8795d4c4e4ffd1835d080d9dad4f8879e5cd1e8249503828b2',
};
const MRTD = '9bf86e6280ec4282b8b5822d8166410a456cdb720109aa799f0011fa63df1de3ee5e35e293fc410c061433163acb03a6';

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const load = async (name) => new Uint8Array(await readFile(new URL(`verify/fixtures/${name}`, root)));

for (const [name, digest] of Object.entries(CAPTURES)) {
  const quote = await load(name);
  check(createHash('sha256').update(quote).digest('hex') === digest, `${name}: not the committed hardware capture`);

  const result = await verifyTdxQuote(quote, { verificationTime: WHEN });
  check(result.accepted, `${name}: genuine capture rejected (${result.error})`);
  check(result.steps.every((s) => s.status === 'pass'), `${name}: a step did not pass`);
  check(result.quote && result.quote.mrtd === MRTD, `${name}: MRTD differs from the capture's`);
  check(result.quote && result.quote.reportData.slice(64) === '0'.repeat(64), `${name}: REPORTDATA tail is not zero`);
  check(result.chain.length === 3, `${name}: expected a three-certificate PCK chain`);

  const tampered = quote.slice();
  tampered[QUOTE_HEADER_LENGTH + OFF_MRTD] ^= 0xff;
  const t = await verifyTdxQuote(tampered, { verificationTime: WHEN });
  check(!t.accepted && t.steps[1].status === 'fail', `${name}: tampered MRTD not rejected at the quote signature`);

  const late = await verifyTdxQuote(quote, { verificationTime: '2033-06-01T00:00:00Z' });
  check(!late.accepted && late.steps[4].status === 'fail', `${name}: expired PCK leaf not rejected at the chain`);
}

const differentialPath = process.argv[2];
if (differentialPath) {
  const report = JSON.parse(await readFile(differentialPath, 'utf8'));
  check(report.verification_time.startsWith('2026-09-14T00:00:00'), 'differential ran at a different verification time');
  check(await pinnedRootFingerprint() === report.pinned_root_sha256,
    'pinned Intel root differs from the one agent_manifest._tdx_verify pins');

  const quotes = {};
  for (const [name, facts] of Object.entries(report.captures)) {
    quotes[name] = await load(name);
    check(createHash('sha256').update(quotes[name]).digest('hex') === facts.sha256, `${name}: differential used another file`);
  }

  const disagreements = [];
  for (const c of report.cases) {
    let input = quotes[c.capture];
    if (c.mutation.type === 'flip') {
      input = input.slice();
      input[c.mutation.offset] ^= 0xff;
    } else if (c.mutation.type === 'truncate') {
      input = input.slice(0, c.mutation.length);
    }
    const ours = await verifyTdxQuote(input, { verificationTime: WHEN });
    if (ours.accepted !== c.accepted) {
      disagreements.push(`${c.capture} ${JSON.stringify(c.mutation)}: python ${c.outcome}, port ${ours.accepted ? 'accepted' : `rejected (${ours.error})`}`);
    }
  }
  disagreements.slice(0, 25).forEach((d) => failures.push(d));
  if (disagreements.length > 25) failures.push(`...and ${disagreements.length - 25} more disagreements`);
  if (disagreements.length === 0) {
    const accepted = report.cases.filter((c) => c.accepted).length;
    console.log(`PASS port agrees with agent_manifest._tdx_verify on ${report.cases.length} inputs (${accepted} accepted)`);
  }
} else {
  console.log('differential skipped: pass the JSON from tools/tdx-differential.py to compare with the Python verifier');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('PASS both GCP TDX captures verify; tampered quote and expired chain are rejected at the right step');
