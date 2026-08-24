'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const here = __dirname;
const html = fs.readFileSync(path.join(here, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(here, '..', 'design-system.css'), 'utf8');
const proof = JSON.parse(fs.readFileSync(path.join(here, 'proof.json'), 'utf8'));

assert.match(html, new RegExp(`<strong>${proof.sdk_version.replace('.', '\\.')}</strong>`));
assert.match(html, new RegExp(`<strong>${proof.conformance_vectors}</strong>`));
assert.match(html, new RegExp(`<strong>${proof.tests_passed}</strong>`));
assert.match(html, new RegExp(`<strong>${proof.hardware_families.length}</strong>`));
assert.ok(html.includes(proof.wcm_commit.slice(0, 7)), 'proof strip must pin the WCM commit');
for (const platform of proof.hardware_families) {
  assert.ok(html.includes(platform.split(' confidential computing')[0]));
}

assert.ok(!html.includes('None protect the builder'), 'avoid an unsupported novelty absolute');
assert.ok(!html.includes('<strong>Open core.</strong>'), 'launch copy must describe the open surface precisely');
assert.ok(html.includes('Sponsorship does not confer ownership or governance authority'));
assert.ok(html.includes('issues/78') && html.includes('issues/79'));
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
