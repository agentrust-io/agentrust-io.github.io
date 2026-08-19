/* Shared behaviour for .at-page documents.
 *
 * One delegated listener, so a page adds a copy button by writing the markup
 * and nothing else. No per-page handler, no onclick attribute.
 */
(function () {
  'use strict';

  var RESET_MS = 1400;

  function flash(button, label, failed) {
    var original = button.getAttribute('data-label') || button.textContent;
    button.setAttribute('data-label', original);
    button.textContent = label;
    button.classList.add(failed ? 'failed' : 'copied');
    window.setTimeout(function () {
      button.textContent = original;
      button.classList.remove('copied', 'failed');
    }, RESET_MS);
  }

  // Clipboard API needs a secure context and, in some browsers, a real user
  // gesture. Selecting an offscreen textarea still works where it does not.
  function copyBySelection(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '0';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    document.body.removeChild(area);
    return ok;
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest ? event.target.closest('.copy') : null;
    if (!button) return;

    var block = button.closest('.code');
    var pre = block && block.querySelector('pre');
    if (!pre) return;

    var text = pre.innerText;

    var fallback = function () {
      if (copyBySelection(text)) {
        flash(button, 'COPIED');
      } else {
        // Never leave the button silent: say so rather than imply success.
        flash(button, 'SELECT AND COPY', true);
      }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        flash(button, 'COPIED');
      }, fallback);
      return;
    }

    fallback();
  });
})();
