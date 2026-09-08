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
      title: '記憶装置の負荷に応じた学習の観測、方程式と回帰曲線',
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
      title: '負荷に対する訓練残差',
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
        metric('訓練MSE · ms²', fmt(d.trainMSE)) +
        metric('検証MSE · ms²', fmt(d.validMSE)) +
        metric('訓練標本', d.train.length),
      status:
        '計算完了 · 曲線の表示範囲 ' +
        fmt(ymin) +
        '~' +
        fmt(ymax) +
        ' ms。網掛けは外挿区間で、表示範囲外の曲線は切り取っています。',
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
      title: '二次損失の等高線、および勾配下降曲線',
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
      title: '反復に伴う損失の常用対数',
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
        metric('最終損失', fmt(d.losses.at(-1))) +
        metric('実行した更新', d.path.length - 1) +
        metric('補正前のη上限', fmt(2 / k)),
      status:
        d.status +
        ' · 座標範囲外の経路は切り取っています。損失グラフは実行した全ステップを含みます。',
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
      title: '観測結果とPCAの復元における、最初の2つのチャンネルの比較',
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
      title: '成分数に対する観測当たりの再構成誤差',
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
        metric('保持分散', fmt(d.ratio * 100) + '%') +
        metric('観測当たりの誤差', fmt(d.error)) +
        metric('恒等式の差', fmt(Math.abs(d.error - d.discarded))),
      status:
        '6チャネルで圧縮・再構成した結果のうち最初の2チャネルを表示します。標本内の再構成であり、ノイズ除去性能の評価ではありません。',
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
      title: 'GMM 最大の責任を持つ集団と、成分ごとの距離 2 楕円',
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
      title: 'EM反復に伴う観測の対数尤度',
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
        metric('対数尤度', fmt(d.ll)) +
        metric('更新回数', d.history.length - 1) +
        metric('最大所属確率 &lt; 0.7', uncertain + ' / 240'),
      status:
        d.status +
        ' · 成分 ' +
        d.components.map((c, i) => i + 1 + '：混合比 ' + fmt(c.weight)).join(' / '),
      data: d
    };
  }
  function svm() {
    return chart({
      id: 'svm-manual',
      title: '解析的SVM例：境界x1=0とマージンx1=±1',
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
      title: '訓練観測と線形SVMの決定境界、マージン、サポートベクトル',
      xlabel: 'Feature 1 (raw)',
      ylabel: 'Feature 2 (raw, scaled)',
      xlim,
      ylim,
      series
    });
    const high = Math.max(1, ...m.history.map((p) => p[1]));
    const secondary = chart({
      id: 'svm-objectives',
      title: 'SVM双対更新ごとの主目的値と双対目的値',
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
      '<div class="plot-panel"><h2>検証混同行列 · 160件</h2><div class="table-wrap"><table><thead><tr><th scope="col">実際 / 予測</th><th scope="col">−1と予測</th><th scope="col">+1と予測</th></tr></thead><tbody><tr><th scope="row">実際−1</th><td>' +
      cm[0][0] +
      '</td><td>' +
      cm[0][1] +
      '</td></tr><tr><th scope="row">実際+1</th><td>' +
      cm[1][0] +
      '</td><td>' +
      cm[1][1] +
      '</td></tr></tbody></table></div><p class="muted">グラフは訓練観測だけを表示します。検証観測は独立したシードで生成し、学習や標準化には使いません。</p></div>';
    const status =
      (m.converged ? '収束を確認' : '未収束 · 反復上限または数値的停滞') +
      ' · 双対更新 ' +
      m.updates +
      '回 · 主・双対ギャップ ' +
      fmt(m.gap) +
      ' · KKT違反 ' +
      fmt(m.kkt) +
      ' · ' +
      (d.standardize ? '訓練統計で標準化' : '標準化なし') +
      ' · 目的値グラフ：オレンジの実線が主目的値、緑の破線が双対目的値です。';
    return {
      svg,
      secondary,
      details,
      state: m.converged ? '収束を確認' : '未収束 · 近似結果',
      metrics:
        metric('C', fmt(m.C)) +
        metric('訓練正解率', fmt(d.trainEval.accuracy * 100) + '%') +
        metric('検証の正確さ', fmt(d.validEval.accuracy * 100) + '%') +
        metric('マージン幅 · 学習座標', d.margin === null ? '定義できません' : fmt(d.margin)) +
        metric('サポートベクトル', m.support.length + ' / ' + d.train.X.length) +
        metric('相対的な差・対称的な差', fmt(m.relativeGap)),
      status,
      data: d
    };
  }
  const api = { chart, fmt, regression, descent, pca, clustering, svm, svmExperiment };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HDFigures = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
