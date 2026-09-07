/* One primary navigation for desktop and mobile; links remain available without JS. */
(function () {
  'use strict';
  var button = document.querySelector('.nav-toggle');
  var links = document.getElementById('primary-links');
  if (!button || !links) return;
  var mobile = window.matchMedia('(max-width: 900px)');
  function closeMenu() {
    button.setAttribute('aria-expanded', 'false');
    links.classList.remove('is-open');
    links.querySelectorAll('details[open]').forEach(function (item) { item.open = false; });
  }
  button.hidden = false;
  document.documentElement.classList.add('hub-nav-ready');
  button.addEventListener('click', function () {
    var open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    links.classList.toggle('is-open', open);
  });
  links.addEventListener('click', function (event) {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    var wasOpen = button.getAttribute('aria-expanded') === 'true';
    var disclosure = links.querySelector('details[open]');
    closeMenu();
    if (wasOpen && mobile.matches) button.focus();
    else if (disclosure) disclosure.querySelector('summary').focus();
  });
  document.addEventListener('click', function (event) {
    if (!event.target.closest('.header-inner')) closeMenu();
  });
  mobile.addEventListener('change', closeMenu);
})();
