/* ==========================================================================
   HD2Lab · Shutterplate — header-docked Light/Dark toggle
   --------------------------------------------------------------------------
   /assets/hd2-theme.js put one floating button on every HD2Lab route. On this
   app that button lands on the plate preview, so the studio hides the floating
   copy (style.css) and carries the same circle, with the same single-colour
   moon/sun, in the header instead (between 저장 and ⋮).

   The state itself is not duplicated here: the click goes through
   window.HD2Theme.toggle(), which persists `hd2-theme`, repaints every other
   HD2Lab surface and fires `hd2-theme-change`. This file only mirrors that
   state onto the header button (aria + label); the moon/sun swap is CSS, keyed
   on `html[data-theme]`, so it cannot disagree with the plate.
   ========================================================================== */
(function () {
  'use strict';

  var button = document.getElementById('headerThemeBtn');
  if (!button) return;

  var root = document.documentElement;

  function current() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function label(theme) {
    return theme === 'dark'
      ? '라이트 모드로 전환'
      : '다크 모드로 전환 (네이비 & 라벤더)';
  }

  function paint(theme) {
    var next = theme === 'dark' ? 'dark' : 'light';
    var text = label(next);
    button.setAttribute('aria-pressed', next === 'dark' ? 'true' : 'false');
    button.setAttribute('aria-label', text);
    button.setAttribute('title', text);
  }

  button.addEventListener('click', function () {
    if (window.HD2Theme && typeof window.HD2Theme.toggle === 'function') {
      window.HD2Theme.toggle();
      return;
    }
    /* the shared script is missing or blocked: keep the button working on its
       own, the same way the floating one would */
    var next = current() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try {
      window.localStorage.setItem('hd2-theme', next);
    } catch (error) {
      /* private mode — the theme still applies for this page */
    }
    paint(next);
  });

  /* the shared script (or another tab) owns the theme: follow it */
  window.addEventListener('hd2-theme-change', function (event) {
    var detail = event && event.detail;
    paint(detail && detail.theme ? detail.theme : current());
  });

  paint(current());
})();
