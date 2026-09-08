/* SVG figures shared by offline snapshots and interactive experiments. */
(function (root) {
  'use strict';
  const M =
    typeof module !== 'undefined' && module.exports ? require('./math-core.js') : root.HDMath;
  const SVM =
    typeof module !== 'undefined' && module.exports ? require('./svm-core.js') : root.HDSVM;
  const colors = ['#106858', '#b15d2d', '#6263a1', '#31778d'];
  const escape = (s) =>
    String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  const fmt = (v) =>
    Math.abs(v) < 1e-10
      ? '0'
      : Math.abs(v) >= 1e4 || Math.abs(v) < 0.001
        ? v.toExponential(2)
        : Number(v.toFixed(3)).toString();
  function chart({ id, title, xlabel, ylabel, xlim, ylim, series = [], bands = [] }) {
    const W = 680,
      H = 360,
      L = 64,
      R = 20,
      T = 22,
      B = 55,
      pw = W - L - R,
      ph = H - T - B;
    const sx = (x) => L + ((x - xlim[0]) / (xlim[1] - xlim[0])) * pw;
    const sy = (y) => T + ph - ((y - ylim[0]) / (ylim[1] - ylim[0])) * ph;
    let out =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 360" role="img" aria-labelledby="' +
      id +
      '-title"><title id="' +
      id +
      '-title">' +
      escape(title) +
      '</title><defs><clipPath id="' +
      id +
      '-clip"><rect x="' +
      L +
      '" y="' +
      T +
      '" width="' +
      pw +
      '" height="' +
      ph +
      '"/></clipPath></defs>';
    out += '<rect width="680" height="360" fill="white"/>';
    for (let i = 0; i < 6; i++) {
      let x = xlim[0] + (i * (xlim[1] - xlim[0])) / 5,
        y = ylim[0] + (i * (ylim[1] - ylim[0])) / 5;
      out +=
        '<path d="M' +
        sx(x) +
        ' ' +
        T +
        'V' +
        (T + ph) +
        ' M' +
        L +
        ' ' +
        sy(y) +
        'H' +
        (W - R) +
        '" stroke="#e4e9e0" fill="none"/>';
      out +=
        '<text x="' +
        sx(x) +
        '" y="' +
        (H - B + 23) +
        '" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#526964">' +
        fmt(x) +
        '</text>';
      out +=
        '<text x="' +
        (L - 10) +
        '" y="' +
        (sy(y) + 4) +
        '" text-anchor="end" font-family="sans-serif" font-size="11" fill="#526964">' +
        fmt(y) +
        '</text>';
    }
    out += '<g clip-path="url(#' + id + '-clip)">';
    for (const b of bands)
      out +=
        '<rect x="' +
        sx(b[0]) +
        '" y="' +
        T +
        '" width="' +
        (sx(b[1]) - sx(b[0])) +
        '" height="' +
        ph +
        '" fill="#dcb688" opacity=".2"/>';
    series.forEach((s) => {
      const pts = s.points.filter((p) => p.every(Number.isFinite)),
        color = s.color || colors[0];
      if (s.type === 'ring')
        pts.forEach((p) => {
          out +=
            '<circle cx="' +
            sx(p[0]) +
            '" cy="' +
            sy(p[1]) +
            '" r="' +
            (s.radius || 7) +
            '" fill="none" stroke="' +
            color +
            '" stroke-width="1.8"/>';
        });
      else if (s.type === 'scatter')
        pts.forEach((p, i) => {
          const x = sx(p[0]),
            y = sy(p[1]),
            c = s.pointColors ? s.pointColors[i] : color;
          if (s.square)
            out +=
              '<rect x="' +
              (x - 3) +
              '" y="' +
              (y - 3) +
              '" width="6" height="6" fill="' +
              c +
              '" opacity=".65"/>';
          else
            out +=
              '<circle cx="' +
              x +
              '" cy="' +
              y +
              '" r="' +
              (s.radius || 3) +
              '" fill="' +
              c +
              '" opacity="' +
              (s.opacity || 0.7) +
              '"/>';
        });
      else if (pts.length)
        out +=
          '<path d="' +
          pts
            .map((p, i) => (i ? 'L' : 'M') + sx(p[0]).toFixed(2) + ' ' + sy(p[1]).toFixed(2))
            .join(' ') +
          '" fill="none" stroke="' +
          color +
          '" stroke-width="' +
          (s.width || 2.2) +
          '" ' +
          (s.dash ? 'stroke-dasharray="6 5"' : '') +
          '/>';
    });
    out +=
      '</g><path d="M' +
      L +
      ' ' +
      T +
      'V' +
      (H - B) +
      'H' +
      (W - R) +
      '" fill="none" stroke="#9bafa4"/>';
    out +=
      '<text x="' +
      (L + pw / 2) +
      '" y="350" text-anchor="middle" font-size="12" fill="#18312e" font-family="sans-serif">' +
      escape(xlabel) +
      '</text>';
    out +=
      '<text x="15" y="' +
      (T + ph / 2) +
      '" transform="rotate(-90 15 ' +
      (T + ph / 2) +
      ')" text-anchor="middle" font-size="12" fill="#18312e" font-family="sans-serif">' +
      escape(ylabel) +
      '</text></svg>';
    return out;
  }
  const metric = (label, value) =>
    '<div class="metric"><span>' +
    escape(label) +
    '</span><strong>' +
    escape(value) +
    '</strong></div>';
  const lineRange = (n, a, b) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
  function regression(options = {}) {
    const d = M.regression(options);
    const ymin = Math.min(-2, ...d.train.map((p) => p[1])),
      ymax = Math.max(17, ...d.train.map((p) => p[1]));
    const svg = chart({
      id: 'reg-fit',
      title: '저장장치 부하별 학습 관측, 생성식과 회귀 곡선',
      xlabel: 'Load (unitless)',
      ylabel: 'Latency (ms)',
      xlim: [-0.15, 1.15],
      ylim: [ymin, ymax],
      bands: [
        [-0.15, 0],
        [1, 1.15]
      ],
      series: [
        { type: 'scatter', points: d.train, color: colors[0] },
        {
          points: lineRange(100, -0.15, 1.15).map((x) => [x, M.latency(x)]),
          color: '#8b948b',
          dash: true
        },
        { points: d.curve, color: colors[1] }
      ]
    });
    const degree = options.degree || 3;
    const residual = d.train.map((p) => [p[0], p[1] - M.dot(d.w, M.basis(p[0], degree))]);
    const rmax = Math.max(0.5, ...residual.map((p) => Math.abs(p[1]))) * 1.15;
    const secondary = chart({
      id: 'reg-residual',
      title: '부하별 학습 잔차',
      xlabel: 'Load (unitless)',
      ylabel: 'Residual (ms)',
      xlim: [0, 1],
      ylim: [-rmax, rmax],
      series: [
        {
          points: [
            [0, 0],
            [1, 0]
          ],
          color: '#8b948b',
          dash: true
        },
        { type: 'scatter', points: residual }
      ]
    });
    return {
      svg,
      secondary,
      metrics:
        metric('학습 MSE · ms²', fmt(d.trainMSE)) +
        metric('검증 MSE · ms²', fmt(d.validMSE)) +
        metric('학습 표본', d.train.length),
      status:
        '계산 완료 · 곡선 표시 범위 ' +
        fmt(ymin) +
        '~' +
        fmt(ymax) +
        ' ms. 음영은 외삽 구간이며 범위를 넘는 곡선은 잘라 표시합니다.',
      data: d
    };
  }
  function descent(options = {}) {
    const d = M.descent(options),
      k = options.curvature || 6;
    const series = [1, 4, 9, 18].map((level) => ({
      points: lineRange(121, 0, 2 * Math.PI).map((t) => [
        Math.sqrt(2 * level) * Math.cos(t),
        Math.sqrt((2 * level) / k) * Math.sin(t)
      ]),
      color: '#c5d5c7',
      width: 1
    }));
    series.push(
      { points: d.path, color: colors[1] },
      { points: d.path, type: 'scatter', radius: 2, color: colors[1] },
      { points: [d.path[0]], type: 'scatter', radius: 5, color: colors[0] },
      { points: [[0, 0]], type: 'scatter', radius: 5, color: '#18312e' }
    );
    const svg = chart({
      id: 'gd-path',
      title: '이차 손실의 등고선과 경사하강 경로',
      xlabel: 'u (unitless)',
      ylabel: 'v (unitless)',
      xlim: [-5, 5],
      ylim: [-4, 4],
      series
    });
    const logloss = d.losses.map((v, i) => [i, Math.log10(Math.max(v, 1e-12))]);
    const low = Math.min(-1, ...logloss.map((p) => p[1])),
      high = Math.max(1, ...logloss.map((p) => p[1]));
    const secondary = chart({
      id: 'gd-loss',
      title: '반복에 따른 손실의 상용로그',
      xlabel: 'Iteration',
      ylabel: 'log10(loss)',
      xlim: [0, Math.max(1, d.losses.length - 1)],
      ylim: [low, high + 0.2],
      series: [{ points: logloss, color: colors[1] }]
    });
    return {
      svg,
      secondary,
      metrics:
        metric('마지막 손실', fmt(d.losses.at(-1))) +
        metric('실행 갱신', d.path.length - 1) +
        metric('보정 전 η 상한', fmt(2 / k)),
      status:
        d.status +
        ' · 좌표 창 밖의 경로는 잘라 표시합니다. 손실 그래프는 모든 실행 단계를 포함합니다.',
      data: d
    };
  }
  function pca(options = {}) {
    const d = M.pcaExperiment(options),
      raw = d.data.map((r) => [r[0], r[1]]),
      restored = d.restored.map((r) => [r[0], r[1]]);
    const extent = Math.max(1, ...raw.flat().map(Math.abs), ...restored.flat().map(Math.abs)) * 1.1;
    const svg = chart({
      id: 'pca-observation',
      title: '관측과 PCA 복원의 첫 두 채널 비교',
      xlabel: 'Channel 1 (unitless)',
      ylabel: 'Channel 2 (unitless)',
      xlim: [-extent, extent],
      ylim: [-extent, extent],
      series: [
        { type: 'scatter', points: raw, color: '#8a9f93', radius: 2.5 },
        { type: 'scatter', points: restored, color: colors[0], square: true }
      ]
    });
    const errors = Array.from({ length: 6 }, (_, i) => [i + 1, M.sum(d.model.values.slice(i + 1))]);
    const secondary = chart({
      id: 'pca-error',
      title: '성분 수에 따른 관측당 재구성 오차',
      xlabel: 'Components',
      ylabel: 'Error per observation',
      xlim: [1, 6],
      ylim: [0, Math.max(0.1, errors[0][1]) * 1.1],
      series: [
        { points: errors },
        { points: errors, type: 'scatter', radius: 4 },
        { points: [[options.k || 2, d.error]], type: 'scatter', radius: 7, color: colors[1] }
      ]
    });
    return {
      svg,
      secondary,
      metrics:
        metric('보존 분산', fmt(d.ratio * 100) + '%') +
        metric('관측당 오차', fmt(d.error)) +
        metric('항등식 차이', fmt(Math.abs(d.error - d.discarded))),
      status:
        '6채널에서 압축·복원한 결과 중 첫 두 채널을 표시합니다. 표본 내 복원이며 잡음 제거 성능 평가는 아닙니다.',
      data: d
    };
  }
  function clustering(options = {}) {
    const d = M.gmm(options),
      assign = d.r.map((row) => row.indexOf(Math.max(...row))),
      series = [];
    for (let j = 0; j < d.components.length; j++) {
      series.push({
        points: d.data.filter((_, i) => assign[i] === j),
        type: 'scatter',
        color: colors[j],
        square: j % 2 === 1
      });
      const c = d.components[j],
        e = M.eigenSymmetric([
          [c.cov[0], c.cov[1]],
          [c.cov[1], c.cov[2]]
        ]);
      const ellipse = lineRange(100, 0, 2 * Math.PI).map((t) =>
        [0, 1].map(
          (i) =>
            c.mu[i] +
            2 * Math.sqrt(e.values[0]) * Math.cos(t) * e.vectors[i][0] +
            2 * Math.sqrt(e.values[1]) * Math.sin(t) * e.vectors[i][1]
        )
      );
      series.push({ points: ellipse, color: colors[j], dash: j % 2 === 1, width: 2 });
    }
    const svg = chart({
      id: 'gmm-fit',
      title: 'GMM 최대 책임값 군집과 성분별 거리 2 타원',
      xlabel: 'Request size (standardized)',
      ylabel: 'Processing time (standardized)',
      xlim: [-4, 4],
      ylim: [-4, 4],
      series
    });
    const lo = Math.min(...d.history),
      hi = Math.max(...d.history);
    const secondary = chart({
      id: 'gmm-likelihood',
      title: 'EM 반복에 따른 관측 로그우도',
      xlabel: 'EM iteration',
      ylabel: 'Log likelihood',
      xlim: [0, Math.max(1, d.history.length - 1)],
      ylim: [lo - 1, hi + 1],
      series: [{ points: d.history.map((v, i) => [i, v]) }]
    });
    const uncertain = d.r.filter((row) => Math.max(...row) < 0.7).length;
    return {
      svg,
      secondary,
      metrics:
        metric('로그우도', fmt(d.ll)) +
        metric('갱신 횟수', d.history.length - 1) +
        metric('최대 소속확률 < 0.7', uncertain + ' / 240'),
      status:
        d.status +
        ' · 성분 ' +
        d.components.map((c, i) => i + 1 + ': 혼합비 ' + fmt(c.weight)).join(' / '),
      data: d
    };
  }
  function svm() {
    return chart({
      id: 'svm-manual',
      title: '해석적 SVM 예제: x1=0 경계와 x1=±1 마진',
      xlabel: 'Feature 1 (standardized)',
      ylabel: 'Feature 2 (standardized)',
      xlim: [-3, 3],
      ylim: [-1, 2],
      bands: [[-1, 1]],
      series: [
        {
          points: [
            [0, -1],
            [0, 2]
          ],
          color: '#18312e'
        },
        {
          points: [
            [-1, -1],
            [-1, 2]
          ],
          dash: true,
          color: '#8a9f93'
        },
        {
          points: [
            [1, -1],
            [1, 2]
          ],
          dash: true,
          color: '#8a9f93'
        },
        {
          points: [
            [-2, 0],
            [-1, 1]
          ],
          type: 'scatter',
          radius: 7
        },
        {
          points: [
            [1, 1],
            [2, 0]
          ],
          type: 'scatter',
          color: colors[1],
          square: true
        }
      ]
    });
  }
  function svmExperiment(options = {}) {
    const d = SVM.experiment(options),
      m = d.model;
    const xlim = [
      Math.min(-3, ...d.train.X.map((x) => x[0])) - 0.4,
      Math.max(3, ...d.train.X.map((x) => x[0])) + 0.4
    ];
    const ylim = [
      Math.min(-2, ...d.train.X.map((x) => x[1])) - 0.4,
      Math.max(2, ...d.train.X.map((x) => x[1])) + 0.4
    ];
    const series = [-1, 1].map((label) => ({
      points: d.train.X.filter((_, i) => d.train.y[i] === label),
      type: 'scatter',
      color: label < 0 ? colors[0] : colors[1],
      square: label > 0,
      radius: 4
    }));
    for (const level of [-1, 0, 1]) {
      let points = [];
      if (Math.abs(d.rawW[1]) > 1e-10)
        points = xlim.map((x) => [x, (level - d.rawB - d.rawW[0] * x) / d.rawW[1]]);
      else if (Math.abs(d.rawW[0]) > 1e-10)
        points = ylim.map((y) => [(level - d.rawB) / d.rawW[0], y]);
      series.push({
        points,
        color: level === 0 ? '#18312e' : '#738b7a',
        dash: level !== 0,
        width: level === 0 ? 2.8 : 1.6
      });
    }
    series.push({ points: m.support.map((i) => d.train.X[i]), type: 'ring', color: '#18312e' });
    if (d.outlier)
      series.push({ points: [d.train.X.at(-1)], type: 'ring', radius: 11, color: colors[2] });
    const svg = chart({
      id: 'svm-trained',
      title: '학습 관측과 선형 SVM 결정 경계, 마진, 서포트 벡터',
      xlabel: 'Feature 1 (raw)',
      ylabel: 'Feature 2 (raw, scaled)',
      xlim,
      ylim,
      series
    });
    const high = Math.max(1, ...m.history.map((p) => p[1]));
    const secondary = chart({
      id: 'svm-objectives',
      title: 'SVM 쌍대 갱신별 원 목적값과 쌍대 목적값',
      xlabel: 'Pair updates',
      ylabel: 'Objective value',
      xlim: [0, Math.max(1, m.updates)],
      ylim: [0, high * 1.05],
      series: [
        { points: m.history.map((p) => [p[0], p[1]]), color: colors[1] },
        { points: m.history.map((p) => [p[0], p[2]]), color: colors[0], dash: true }
      ]
    });
    const cm = d.validEval.matrix;
    const details =
      '<div class="plot-panel"><h2>검증 혼동행렬 · 160개</h2><div class="table-wrap"><table><thead><tr><th scope="col">실제 / 예측</th><th scope="col">−1 예측</th><th scope="col">+1 예측</th></tr></thead><tbody><tr><th scope="row">−1 실제</th><td>' +
      cm[0][0] +
      '</td><td>' +
      cm[0][1] +
      '</td></tr><tr><th scope="row">+1 실제</th><td>' +
      cm[1][0] +
      '</td><td>' +
      cm[1][1] +
      '</td></tr></tbody></table></div><p class="muted">위 그래프는 학습 관측만 표시합니다. 검증 관측은 독립 시드로 생성하며 학습·표준화에 사용하지 않습니다.</p></div>';
    const status =
      (m.converged ? '수렴 확인' : '미수렴 · 반복 상한 또는 수치 정체') +
      ' · 쌍대 갱신 ' +
      m.updates +
      '회 · 원/쌍대 차이 ' +
      fmt(m.gap) +
      ' · KKT 위반 ' +
      fmt(m.kkt) +
      ' · ' +
      (d.standardize ? '훈련 통계로 표준화' : '표준화 없음') +
      ' · 목적값 그래프: 주황 실선은 원 목적값, 초록 점선은 쌍대 목적값.';
    return {
      svg,
      secondary,
      details,
      state: m.converged ? '수렴 확인' : '미수렴 · 근사 결과',
      metrics:
        metric('C', fmt(m.C)) +
        metric('학습 정확도', fmt(d.trainEval.accuracy * 100) + '%') +
        metric('검증 정확도', fmt(d.validEval.accuracy * 100) + '%') +
        metric('마진 폭 · 학습 좌표', d.margin === null ? '정의 불가' : fmt(d.margin)) +
        metric('서포트 벡터', m.support.length + ' / ' + d.train.X.length) +
        metric('상대 원·쌍대 차이', fmt(m.relativeGap)),
      status,
      data: d
    };
  }
  const api = { chart, fmt, regression, descent, pca, clustering, svm, svmExperiment };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HDFigures = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
