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
