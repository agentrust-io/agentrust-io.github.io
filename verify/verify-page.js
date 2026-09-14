/* Drives /verify/: loads a capture or a local file and renders the result of
 * verify/tdx-verify.js. Every value shown comes from the verifier's result
 * object and is written with textContent, never as markup.
 */
import { verifyTdxQuote } from './tdx-verify.js';
import { checkKeyBinding } from './key-binding.js';

const CAPTURES = {
  keybind: {
    file: 'fixtures/gcp-tdx-2026-09-14-keybind_quote.bin',
    label: 'keybind_quote.bin',
    record: 'fixtures/gcp-tdx-2026-09-14-keybind_record.json',
  },
  plain: { file: 'fixtures/gcp-tdx-2026-07-21-tdx_quote.bin', label: 'tdx_quote.bin' },
  manifest: { file: 'fixtures/gcp-tdx-2026-07-21-tdx_quote_manifest.bin', label: 'tdx_quote_manifest.bin' },
};

const WORDS = { pass: ['PASS', 'ok'], fail: ['FAIL', 'alert'], 'not-run': ['not run', 'dim'] };

const $ = (id) => document.getElementById(id);

function line(text, kind) {
  const div = document.createElement('div');
  if (kind) div.className = kind;
  div.textContent = text;
  return div;
}

function row(name, value) {
  const tr = document.createElement('tr');
  const th = document.createElement('td');
  th.textContent = name;
  const td = document.createElement('td');
  const code = document.createElement('code');
  // A 96-character measurement has no natural break, so offer one every 16
  // characters rather than letting the table push a phone-width page sideways.
  (value.match(/.{1,16}/g) || ['']).forEach((chunk, i) => {
    if (i) code.append(document.createElement('wbr'));
    code.append(chunk);
  });
  td.append(code);
  tr.append(th, td);
  return tr;
}

function render(result, label, size, binding) {
  $('term-title').textContent = `verify ${label}`;
  const body = $('term-body');
  body.replaceChildren(line(`quote: ${label}, ${size} bytes`, 'dim'));
  result.steps.forEach((step, i) => {
    const [word, kind] = WORDS[step.status];
    body.append(line(`${i === 0 ? 'profile' : `step ${i}`}: ${step.label}: ${word}`, kind));
    if (step.detail) body.append(line(step.detail, 'dim'));
  });
  if (result.quote) body.append(line(`REPORTDATA[0:32]: ${result.quote.reportData.slice(0, 64)}`, 'dim'));
  const bound = binding && binding.bound && binding.sameQuote && binding.sameMeasurement;
  if (binding) {
    body.append(line(`record key SHA-256: ${binding.keyHash}`, 'dim'));
    const [word, kind] = WORDS[bound ? 'pass' : 'fail'];
    body.append(line(`key binding: REPORTDATA[0:32] is the SHA-256 of the TRACE record's signing key, and the record carries this quote and its MRTD: ${word}`, kind));
  }
  body.append(result.accepted
    ? line(bound
      ? 'verdict: ACCEPTED. Genuine Intel TDX quote, and it commits to the key that signed the TRACE record published beside it.'
      : 'verdict: ACCEPTED. Genuine Intel TDX quote; the chain ends at the pinned Intel root.', 'ok')
    : line(`verdict: REJECTED. ${result.error}`, 'alert'));
  body.append(line(`checked ${result.checkedAt} against this device's clock`, 'dim'));

  const fields = $('fields');
  fields.replaceChildren();
  if (result.quote) {
    fields.append(row('MRTD', result.quote.mrtd));
    result.quote.rtmrs.forEach((value, i) => fields.append(row(`RTMR${i}`, value)));
    fields.append(row('REPORTDATA', result.quote.reportData));
  }
  result.chain.forEach((cert, i) => {
    fields.append(row(`Certificate ${i + 1}`, `${cert.subject}, valid ${cert.notBefore.slice(0, 10)} to ${cert.notAfter.slice(0, 10)}`));
  });
  $('run-status').textContent = result.accepted ? `${label}: accepted` : `${label}: rejected`;
}

async function run(bytes, label, record) {
  $('run-status').textContent = `Verifying ${label}`;
  const result = await verifyTdxQuote(bytes);
  render(result, label, bytes.byteLength, record ? await checkKeyBinding(result, record, bytes) : null);
}

async function fetchOk(file, label) {
  const response = await fetch(new URL(file, import.meta.url));
  if (!response.ok) throw new Error(`could not load ${label} (HTTP ${response.status})`);
  return response;
}

async function runCapture(key) {
  const capture = CAPTURES[key];
  try {
    const quote = new Uint8Array(await (await fetchOk(capture.file, capture.label)).arrayBuffer());
    const record = capture.record ? (await (await fetchOk(capture.record, 'the TRACE record')).json()).record : null;
    await run(quote, capture.label, record);
  } catch (error) {
    $('term-body').replaceChildren(line(error.message, 'alert'));
  }
}

document.querySelectorAll('[data-capture]').forEach((button) => {
  button.addEventListener('click', () => runCapture(button.getAttribute('data-capture')));
});

const input = $('quote-file');
$('load-file').addEventListener('click', () => input.click());
input.addEventListener('change', async () => {
  const file = input.files && input.files[0];
  if (!file) return;
  await run(new Uint8Array(await file.arrayBuffer()), file.name);
  input.value = '';
});

$('verifier').hidden = false;
runCapture('keybind');
