/* ==========================================================================
   HD2Lab · shared Light/Dark theme (Navy & Lavender)
   --------------------------------------------------------------------------
   One localStorage key, one floating toggle, every route.

     localStorage['hd2-theme'] = 'light' | 'dark'   (default 'light')

   Each page runs a one-line inline script in <head> that applies the stored
   value before the first paint (no flash), links /assets/hd2-theme.css and
   loads this file with `defer`. Everything else is handled here:

     · the fixed bottom-right toggle button (44px, safe-area aware)
     · <meta name="theme-color"> kept in step with the theme
     · cross-tab sync through the `storage` event
     · window.HD2Theme.get() / .set(theme) / .toggle() for page-level controls
     · a `hd2-theme-change` CustomEvent (detail.theme) for app scripts
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'hd2-theme';
  var root = document.documentElement;
  var META_DARK = '#0B1020';
  var meta = document.querySelector('meta[name="theme-color"]');
  var metaLight = (meta && meta.getAttribute('content')) || '#FAFAFD';
  var button = null;

  function isTheme(value) {
    return value === 'light' || value === 'dark';
  }

  function stored() {
    try {
      var value = window.localStorage.getItem(KEY);
      return isTheme(value) ? value : null;
    } catch (error) {
      return null;
    }
  }

  function persist(value) {
    try {
      window.localStorage.setItem(KEY, value);
    } catch (error) {
      /* private mode / storage disabled — the theme still applies for this page */
    }
  }

  function current() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function korean() {
    var lang = (root.getAttribute('lang') || '').toLowerCase();
    return lang.indexOf('ko') === 0;
  }

  function label(theme) {
    var toDark = theme !== 'dark';
    if (korean()) {
      return toDark ? '다크 모드로 전환 (네이비 & 라벤더)' : '라이트 모드로 전환';
    }
    return toDark ? 'Switch to dark mode (Navy & Lavender)' : 'Switch to light mode';
  }

  function paintMeta(theme) {
    if (meta) meta.setAttribute('content', theme === 'dark' ? META_DARK : metaLight);
  }

  function paintButton(theme) {
    if (!button) return;
    var text = label(theme);
    button.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    button.setAttribute('aria-label', text);
    button.setAttribute('title', text);
  }

  function apply(theme, options) {
    var next = theme === 'dark' ? 'dark' : 'light';
    var persistTo = !options || options.persist !== false;

    root.setAttribute('data-theme', next);
    paintMeta(next);
    paintButton(next);
    if (persistTo) persist(next);

    try {
      window.dispatchEvent(
        new CustomEvent('hd2-theme-change', { detail: { theme: next } })
      );
    } catch (error) {
      /* CustomEvent unsupported (very old engines) — theme still applies */
    }
    return next;
  }

  var ICONS = {
    sun:
      '<circle cx="12" cy="12" r="4.1"/>' +
      '<path d="M12 2.7v2.3M12 19v2.3M2.7 12h2.3M19 12h2.3M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6"/>',
    moon: '<path d="M20.4 14.4A8.6 8.6 0 0 1 9.6 3.6a8.6 8.6 0 1 0 10.8 10.8z"/>'
  };

  function buildButton() {
    if (document.getElementById('hd2ThemeToggle')) return;
    var el = document.createElement('button');
    el.type = 'button';
    el.id = 'hd2ThemeToggle';
    el.className = 'hd2-theme-toggle';

    var svgNs = 'http://www.w3.org/2000/svg';
    ['sun', 'moon'].forEach(function (name) {
      var svg = document.createElementNS(svgNs, 'svg');
      svg.setAttribute('class', 'hd2-theme-ic');
      svg.setAttribute('data-icon', name);
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      svg.innerHTML = ICONS[name];
      el.appendChild(svg);
    });

    el.addEventListener('click', function () {
      apply(current() === 'dark' ? 'light' : 'dark', { persist: true });
    });

    document.body.appendChild(el);
    button = el;
    paintButton(current());
  }

  /* another tab (or another HD2Lab route) changed the theme */
  window.addEventListener('storage', function (event) {
    if (event.key !== KEY) return;
    if (!isTheme(event.newValue) || event.newValue === current()) return;
    apply(event.newValue, { persist: false });
  });

  window.HD2Theme = {
    key: KEY,
    get: current,
    set: function (theme, options) {
      return apply(theme, options);
    },
    toggle: function () {
      return apply(current() === 'dark' ? 'light' : 'dark', { persist: true });
    }
  };

  if (document.body) buildButton();
  else document.addEventListener('DOMContentLoaded', buildButton);

  /* the inline head script sets the attribute; if this file somehow wins the
     race first, fall back to the stored value now */
  if (!isTheme(root.getAttribute('data-theme'))) {
    apply(stored() || 'light', { persist: false });
  } else {
    paintMeta(current());
  }
})();
