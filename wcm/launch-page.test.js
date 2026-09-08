'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const here = __dirname;
const html = fs.readFileSync(path.join(here, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(here, '..', 'design-system.css'), 'utf8');
const proof = JSON.parse(fs.readFileSync(path.join(here, 'proof.json'), 'utf8'));

assert.match(html, new RegExp(`<strong>${proof.sdk_version.replace('.', '\\.')}</strong>`));
assert.match(html, new RegExp(`<strong>${proof.conformance_vectors}</strong>`));
assert.equal(Object.values(proof.conformance_levels).reduce((sum, count) => sum + count, 0), proof.conformance_vectors);
for (const [level, count] of Object.entries(proof.conformance_levels)) {
  assert.ok(html.includes(`${level} ${count}/${count}`), `${level} result must match captured output`);
}
assert.ok(html.includes(proof.package_url), 'evidence must link to the tested public package');
assert.ok(html.includes(`weight-custody-manifest==${proof.sdk_version}`), 'installation must pin the tested version');
assert.ok(html.includes(`<pre>git clone https://github.com/agentrust-io/demos\ncd demos\n${proof.demo_command}</pre>`));
assert.equal(proof.hardware_executed, false);
assert.ok(!html.includes('wcm release --explain'), 'do not publish a nonexistent CLI command');
assert.ok(html.includes('placeholder key'), 'the demo must disclose its synthetic key');
assert.ok(html.includes('self-test, not independent certification or a hardware deployment test'));

assert.ok(!html.includes('None protect the builder'), 'avoid an unsupported novelty absolute');
assert.ok(!html.includes('<strong>Open core.</strong>'), 'launch copy must describe the open surface precisely');
assert.ok(html.includes('Sponsorship does not confer ownership or governance authority'));
// The two open limitations must stay disclosed. This used to assert the issue
// links were present, which is how six dead links survived on a public page: the
// tracker is private, so every one of them 404s for the readers this page is
// for. The disclosure is what matters, not the hyperlink, so assert the prose.
assert.ok(
  html.includes('Neither it nor the demo validates your hardware, protected-memory sweep, or production zeroization'),
  'the memory-sweep limitation must stay disclosed'
);
assert.ok(
  html.includes('Wiping the managed key buffer cannot erase plaintext or key copies that escaped that buffer'),
  'the zeroization limitation must stay disclosed'
);

// Public launch links must replace the pre-release availability notice.
assert.ok(html.includes('https://github.com/agentrust-io/weight-custody-manifest'));
assert.ok(html.includes('https://wcm.agentrust-io.com/'));
assert.ok(!html.includes('specification repository is still private'));
assert.ok(!html.includes('Not yet a public repository'));
assert.ok(html.includes('/wcm/og-launch.png'));
const socialCard = fs.readFileSync(path.join(here, 'og-launch.png'));
assert.ok(socialCard.length > 100_000);
assert.equal(socialCard.toString('ascii', 1, 4), 'PNG');
const width = socialCard.readUInt32BE(16);
const height = socialCard.readUInt32BE(20);
assert.equal(width, 1731);
assert.equal(height, 909);
assert.ok(html.includes(`<meta property="og:image:width" content="${width}">`));
assert.ok(html.includes(`<meta property="og:image:height" content="${height}">`));
for (const selector of ['.proof-grid', '.wcm-terminal', '.wcm-flow', '.wcm-personas']) {
  assert.ok(css.includes(selector), `${selector} must have a responsive style`);
}
assert.equal((css.match(/{/g) || []).length, (css.match(/}/g) || []).length);
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
for (const match of html.matchAll(/href="#([^"]+)"/g)) {
  assert.ok(ids.has(match[1]), `fragment #${match[1]} must resolve`);
}

console.log('WCM launch page evidence and positioning checks passed');
