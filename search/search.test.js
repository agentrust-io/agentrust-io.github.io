'use strict';

// Covers the parts of search.js that decide what a reader sees: text cleaning,
// tokenizing, the all-terms rule, ranking, the per-page cap, absolute URLs per
// host, and that source text can never become markup.

const assert = require('node:assert/strict');
const s = require('./search.js');

// HTML stripping: tags, scripts and entities.
assert.equal(s.stripHtml('<p>Key <code>release</code> &amp; attest&#39;s&nbsp;<b>quote</b></p>'), "Key release & attest's quote");
assert.equal(s.stripHtml('a<script>alert(1)</script>b'), 'a b');
assert.equal(s.stripHtml('&#x1F600; &bogus; &#0;'), '\u{1F600} &bogus;');

// Tokenizing: lower case, deduplicated, punctuation dropped, dotted names kept.
assert.deepEqual(s.tokenize('  TDX quote, tdx! search_index.json '), ['tdx', 'quote', 'search_index.json']);
assert.deepEqual(s.tokenize('<script>'), ['script']);
assert.deepEqual(s.tokenize('   '), []);

// URL building per host, including MkDocs' empty home location and anchors.
const wcm = s.SOURCES.find((x) => x.id === 'wcm');
assert.equal(s.buildUrl(wcm.base, ''), 'https://wcm.agentrust-io.com/');
assert.equal(s.buildUrl(wcm.base, 'deployment-trust/#key-release'), 'https://wcm.agentrust-io.com/deployment-trust/#key-release');
assert.equal(s.buildUrl('https://ca2a.agentrust-io.com/', 'docs/quickstart/'), 'https://ca2a.agentrust-io.com/docs/quickstart/');

const index = {
  docs: [
    { location: 'attestation/', title: 'Attestation', text: '<p>How attestation evidence is checked.</p>' },
    { location: 'attestation/#tdx', title: 'Intel TDX', text: '<p>A TDX quote carries attestation evidence.</p>' },
    { location: 'attestation/#snp', title: 'SEV-SNP', text: '<p>An SNP report is attestation evidence too.</p>' },
    { location: 'attestation/#h100', title: 'H100', text: '<p>GPU attestation evidence.</p>' },
    { location: 'release/', title: 'Key release', text: '<p>Keys are released after attestation of the quote.</p>' },
    { location: 'glossary/', title: 'Glossary', text: '<p>Quote: a signed report.</p>' },
    { location: 'empty/', title: '', text: '' }
  ]
};
const docs = s.fromMkDocs(wcm, index);
assert.equal(docs.length, 6, 'entries with no title and no text are dropped');
assert.equal(docs[1].pageTitle, 'Attestation');
assert.equal(docs[1].url, 'https://wcm.agentrust-io.com/attestation/#tdx');

// All terms must match: "glossary" alone has "quote" but not "attestation".
const both = s.search(docs, 'attestation quote');
assert.deepEqual(both.map((h) => h.doc.url).sort(), [
  'https://wcm.agentrust-io.com/attestation/#tdx',
  'https://wcm.agentrust-io.com/release/'
]);
assert.ok(both.every((h) => !h.doc.url.includes('glossary')));

// Title matches outrank text matches, and a page outranks its own sections.
const ranked = s.search(docs, 'attestation');
assert.equal(ranked[0].doc.url, 'https://wcm.agentrust-io.com/attestation/');
assert.ok(ranked[0].score > ranked[ranked.length - 1].score);

// Per-page cap: the attestation page has four matching entries, at most two show.
assert.equal(ranked.filter((h) => h.doc.page === 'wcm:attestation/').length, s.PER_PAGE);

// Phrase bonus and the site filter.
const phrased = s.search(docs, 'key release');
assert.equal(phrased[0].doc.title, 'Key release');
assert.equal(s.search(docs, 'attestation', 'cmcp').length, 0);
assert.ok(s.search(docs, 'attestation', 'wcm').length > 0);
assert.equal(s.search(docs, '').length, 0);

// Snippets centre on the first match and highlight splits only on terms.
assert.match(s.snippet('x'.repeat(300) + ' attestation ' + 'y'.repeat(300), ['attestation']), /^…x+ attestation y+…$/);
assert.deepEqual(s.highlight('TDX quote tdx', ['tdx']), [
  { text: 'TDX', mark: true }, { text: ' quote ', mark: false }, { text: 'tdx', mark: true }
]);

// Escaping: a title carrying markup renders as text. A minimal DOM records every
// write; innerHTML must never be touched.
function fakeDocument() {
  const make = (tag) => {
    const node = {
      tag, children: [], className: '', href: '',
      set textContent(v) { this.children = [{ text: String(v) }]; },
      get textContent() { return this.children.map((c) => (c.text !== undefined ? c.text : c.textContent)).join(''); },
      append(...kids) { this.children.push(...kids); }
    };
    Object.defineProperty(node, 'innerHTML', { set() { throw new Error('innerHTML written'); }, get() { return ''; } });
    return node;
  };
  return { createElement: make, createTextNode: (text) => ({ text }) };
}
const hostile = s.fromMkDocs(wcm, { docs: [{ location: 'x/', title: '&lt;img src=x onerror=alert(1)&gt; quote', text: '&lt;script&gt;alert(2)&lt;/script&gt; quote' }] });
const hit = s.search(hostile, 'quote')[0];
const item = s.renderResult(fakeDocument(), hit, s.tokenize('quote'));
const [site, title, snippet, url] = item.children;
assert.equal(site.textContent, 'WCM');
assert.equal(title.textContent, '<img src=x onerror=alert(1)> quote');
assert.equal(title.href, 'https://wcm.agentrust-io.com/x/');
assert.ok(title.children.some((c) => c.tag === 'mark' && c.textContent === 'quote'));
assert.equal(snippet.textContent, '<script>alert(2)</script> quote');
assert.equal(url.textContent, 'https://wcm.agentrust-io.com/x/');

console.log('Search cleaning, ranking, per-page cap, URLs and escaping passed.');
