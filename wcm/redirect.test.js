'use strict';

// /wcm/ is a redirect to the single WCM home at wcm.agentrust-io.com.
//
// It used to be a full launch page, gated by a proof.json that pinned SDK
// numbers. That file could not see the WCM repository, so it went stale at
// 0.27.0 while the docs site moved to 0.28.1, and the two addresses ended up
// telling different stories. The numbers are now gated inside
// weight-custody-manifest (python/tests/test_docs_home_claims.py), which counts
// the actual conformance vectors.
//
// What this guards is that the page stays a redirect and does not grow content
// again.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DOCS_HOME = 'https://wcm.agentrust-io.com/';
const here = __dirname;
const html = fs.readFileSync(path.join(here, 'index.html'), 'utf8').replace(/\r\n/g, '\n');

// Three independent ways out, so no single blocked mechanism strands a reader.
assert.match(
  html,
  new RegExp(`<meta http-equiv="refresh" content="0; url=${DOCS_HOME}">`),
  'must carry an instant meta refresh to the docs home',
);
assert.ok(
  html.includes(`location.replace("${DOCS_HOME}")`),
  'must redirect in JS with replace(), so Back does not bounce',
);
assert.ok(
  html.includes(`<a href="${DOCS_HOME}">open the documentation</a>`),
  'must offer a visible link when refresh and JS are both blocked',
);

// One canonical, pointing away from here. This is what consolidates the two
// addresses into one indexed page.
const canonicals = html.match(/<link rel="canonical"[^>]*>/g) || [];
assert.equal(canonicals.length, 1, 'exactly one canonical');
assert.equal(canonicals[0], `<link rel="canonical" href="${DOCS_HOME}">`);
assert.ok(
  !/<link rel="canonical" href="https:\/\/agentrust-io\.com\/wcm\//.test(html),
  'must not claim itself as canonical',
);

// og:url points at the docs home too, so a share of this address and a share of
// the docs site resolve to the same card.
assert.ok(
  html.includes(`<meta property="og:url" content="${DOCS_HOME}">`),
  'og:url must be the docs home',
);

// The card image stays served from this directory: links cached against
// agentrust-io.com/wcm/og-launch.png must keep resolving.
assert.ok(
  fs.existsSync(path.join(here, 'og-launch.png')),
  'og-launch.png must stay in place for already-shared cards',
);
assert.ok(
  html.includes('content="https://agentrust-io.com/wcm/og-launch.png"'),
  'og:image must be absolute and point at the image this directory still serves',
);

// A redirect stub is small. If this trips, someone is rebuilding a second
// homepage here, which is the drift this change removed.
const bytes = Buffer.byteLength(html, 'utf8');
assert.ok(bytes < 6000, `redirect stub must stay small, got ${bytes} bytes`);
assert.ok(
  !fs.existsSync(path.join(here, 'proof.json')),
  'proof.json is gated in weight-custody-manifest now; do not reintroduce it here',
);

console.log(`ok: /wcm/ redirects to ${DOCS_HOME} (${bytes} bytes)`);
