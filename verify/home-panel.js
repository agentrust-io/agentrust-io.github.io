/* Fills the homepage hero panel from a live run of verify/tdx-verify.js on the
 * committed GCP key-binding capture, so "runs in your browser" is literally what
 * the panel shows. Without JavaScript the rows keep their "run it" link to /verify/.
 */
import { verifyTdxQuote } from './tdx-verify.js';
import { checkKeyBinding } from './key-binding.js';

const panel = document.getElementById('verify-panel');

function set(id, word, kind) {
  const state = panel.querySelector(`[data-step="${id}"] .state`);
  if (!state) return;
  state.textContent = word;
  state.className = `state ${kind}`.trim();
}

if (panel) {
  panel.querySelectorAll('.state').forEach((state) => { state.textContent = 'checking'; state.className = 'state'; });
  try {
    const [quoteResponse, recordResponse] = await Promise.all([
      fetch(new URL('fixtures/gcp-tdx-2026-09-14-keybind_quote.bin', import.meta.url)),
      fetch(new URL('fixtures/gcp-tdx-2026-09-14-keybind_record.json', import.meta.url)),
    ]);
    if (!quoteResponse.ok || !recordResponse.ok) throw new Error('capture not loaded');
    const quote = new Uint8Array(await quoteResponse.arrayBuffer());
    const result = await verifyTdxQuote(quote);
    const binding = await checkKeyBinding(result, (await recordResponse.json()).record, quote);
    for (const step of result.steps) {
      if (step.status === 'pass') set(step.id, 'PASS', 'pass');
      else if (step.status === 'fail') set(step.id, 'FAIL', 'fail');
      else set(step.id, 'not run', '');
    }
    const bound = binding.bound && binding.sameQuote && binding.sameMeasurement;
    set('reportdata', bound ? 'PASS' : 'FAIL', bound ? 'pass' : 'fail');
    set('verdict', result.accepted && bound ? 'ACCEPTED' : 'REJECTED', result.accepted && bound ? 'pass' : 'fail');
  } catch (error) {
    panel.querySelectorAll('.state').forEach((state) => { state.textContent = 'not run'; state.className = 'state'; });
  }
}
