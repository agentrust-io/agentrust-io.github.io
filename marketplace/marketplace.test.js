'use strict';

const assert = require('node:assert/strict');
const { escape, safeUrl } = require('./marketplace.js');

assert.equal(
  escape('" onmouseover="alert(1)" <script>'),
  '&quot; onmouseover=&quot;alert(1)&quot; &lt;script&gt;'
);
assert.equal(safeUrl('javascript:alert(1)'), '#');
assert.equal(safeUrl('data:text/html,<script>alert(1)</script>'), '#');
assert.equal(safeUrl('http://example.com/insecure'), '#');
assert.equal(safeUrl('not a URL'), '#');
assert.equal(safeUrl('https://github.com/agentrust-io/integrations'), 'https://github.com/agentrust-io/integrations');

// Exercise the actual browser script with unavailable and malformed catalogs.
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
async function checkUnavailable(fetch) {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', hidden: true, disabled: false, classList: { add() {}, toggle() {} }, addEventListener() {} });
      return elements.get(id);
    },
    querySelectorAll() { return []; },
    addEventListener() {}
  };
  await runInNewContext(readFileSync(require.resolve('./marketplace.js'), 'utf8'), {
    document, fetch, AbortController, setTimeout, clearTimeout, URL, URLSearchParams,
    location: { search: '', pathname: '/marketplace/', hash: '' }, history: { replaceState() {} }
  });
  assert.match(elements.get('catalog-status').textContent, /could not be loaded/);
  assert.doesNotMatch(elements.get('catalog-status').textContent, /loaded successfully/);
  assert.match(elements.get('market-empty').innerHTML, /Catalog temporarily unavailable/);
  assert.match(elements.get('market-empty').innerHTML, /Try again/);
  assert.equal(elements.get('market-empty').hidden, false);
  assert.equal(elements.get('hero-count').textContent, '?');
  assert.equal(elements.get('market-search').disabled, true);
}
(async () => {
  await checkUnavailable(async () => { throw new Error('offline'); });
  await checkUnavailable(async () => ({ ok: true, json: async () => ({ catalog_version: 99 }) }));
  console.log('Marketplace escaping, URL guards, offline and invalid-catalog states passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
