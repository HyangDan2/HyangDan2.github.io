/* Inputs only redraw local deterministic calculations; no network or storage. */
(() => {
  const form = document.querySelector('[data-lab]');
  if (!form) return;
  form.querySelectorAll('[disabled]').forEach((control) => {
    control.disabled = false;
  });
  const names = {
    regression: 'regression',
    'gradient-descent': 'descent',
    pca: 'pca',
    clustering: 'clustering',
    svm: 'svmExperiment'
  };
  let timer;
  function render() {
    const options = {};
    form.querySelectorAll('[name]').forEach((input) => {
      options[input.name] = input.type === 'checkbox' ? input.checked : Number(input.value);
      const output = form.querySelector('output[for="' + input.id + '"]');
      if (output) output.textContent = input.value;
    });
    try {
      const result = HDFigures[names[form.dataset.lab]](options);
      document.getElementById('primary-plot').innerHTML = result.svg;
      document.getElementById('secondary-plot').innerHTML = result.secondary;
      document.getElementById('metrics').innerHTML = result.metrics;
      const details = document.getElementById('experiment-details');
      if (details) details.innerHTML = result.details || '';
      document.getElementById('status').textContent = result.status;
      document.getElementById('mode').textContent =
        '실시간 계산 · 현재 설정' + (result.state ? ' · ' + result.state : '');
    } catch (error) {
      document.getElementById('status').textContent =
        '계산을 완료하지 못했습니다. 설정을 초기화해 주세요. ' + error.message;
    }
  }
  form.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(render, 60);
  });
  form.addEventListener('reset', () => {
    clearTimeout(timer);
    setTimeout(render, 0);
  });
  form.addEventListener('submit', (event) => event.preventDefault());
  render();
})();
