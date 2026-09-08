/* Static language links and content remain usable without JavaScript. */
(() => {
  document
    .querySelectorAll('[data-print]')
    .forEach((button) => button.addEventListener('click', () => window.print()));
  const toc = document.querySelector('.toc');
  if (toc && window.matchMedia('(max-width: 680px)').matches) toc.open = false;
  const save = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  };
  document.querySelectorAll('[data-language]').forEach((link) => {
    if (link.tagName !== 'A') return;
    link.addEventListener('click', () => {
      save('mlstudy-language', link.dataset.language);
      const target = new URL(link.href);
      target.hash = location.hash;
      target.search = location.search;
      link.href = target.href;
    });
  });
  const button = document.querySelector('[data-theme-toggle]');
  const sync = () => {
    if (button)
      button.setAttribute(
        'aria-pressed',
        String(document.documentElement.dataset.theme === 'dark')
      );
  };
  if (button) {
    button.hidden = false;
    button.addEventListener('click', () => {
      const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = theme;
      save('mlstudy-theme', theme);
      sync();
    });
    sync();
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    let saved;
    try {
      saved = localStorage.getItem('mlstudy-theme');
    } catch (_) {}
    if (!['light', 'dark'].includes(saved)) {
      document.documentElement.dataset.theme = event.matches ? 'dark' : 'light';
      sync();
    }
  });
})();
