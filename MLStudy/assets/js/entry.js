(() => {
  let lang = 'en';
  try {
    const saved = localStorage.getItem('mlstudy-language');
    if (['en', 'ko', 'ja'].includes(saved)) lang = saved;
  } catch (_) {}
  location.replace(
    (lang === 'en' ? '' : lang + '/') + 'main.html' + location.search + location.hash
  );
})();
