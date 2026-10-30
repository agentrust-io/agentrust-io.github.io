import assert from 'node:assert/strict';
import { test } from 'node:test';
import { render } from './render-capabilities.mjs';
const example = () => ({ reviewed_at: '2026-10-21', entries: [{
  project: '<script>alert(1)</script>', repository: 'ca2a', capability: 'Compare A & B',
  revision: 'a'.repeat(40), pull_request: 1, run: 2, evidence_class: 'synthetic',
  result: 'Passed bounded suite', limits: 'Not production acceptance',
}] });
test('escape content and pin source/run links', () => {
  const html = render(example());
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes(`/tree/${'a'.repeat(40)}`));
  assert.ok(html.includes('/actions/runs/2'));
  assert.ok(html.includes('scope="row"'));
});
test('reject missing limits, mutable revisions and unsafe references', () => {
  for (const [field, value] of [['limits', ''], ['revision', 'main'],
    ['repository', 'x/../../evil'], ['run', -1], ['evidence_class', 'verified']]) {
    const data = example(); data.entries[0][field] = value;
    assert.throws(() => render(data));
  }
});
test('reject duplicate entries and undated snapshots', () => {
  const data = example(); data.entries.push(data.entries[0]);
  assert.throws(() => render(data));
  assert.throws(() => render({ ...example(), reviewed_at: '' }));
});
