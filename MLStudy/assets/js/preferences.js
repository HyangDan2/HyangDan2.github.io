/* Apply theme before paint. The only stored values are display preferences. */
(() => {
  let theme;
  try {
    theme = localStorage.getItem('mlstudy-theme');
  } catch (_) {}
  if (!['light', 'dark'].includes(theme)) {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = theme;
})();
