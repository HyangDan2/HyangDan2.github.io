/* HD2Lab linear soft-margin SVM. Pairwise exact dual coordinate ascent. */
(function (root) {
  'use strict';
  const M =
    typeof module !== 'undefined' && module.exports ? require('./math-core.js') : root.HDMath;
  function fit(X, y, C = 1, { maxUpdates = 8000, tolerance = 1e-5 } = {}) {
    const n = X.length,
      beta = Array(n).fill(0),
      w = [0, 0],
      lower = y.map((v) => (v > 0 ? 0 : -C)),
      upper = y.map((v) => (v > 0 ? C : 0));
    const distances = X.map((a) => X.map((b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2));
    const history = [];
    let updates = 0,
      b = 0,
      primal = 0,
      dual = 0,
      gap = Infinity,
      kkt = Infinity,
      converged = false;
    function certificate() {
      const g = X.map((x, i) => y[i] - M.dot(w, x));
      const eps = 1e-10 * Math.max(1, C);
      const low = Math.max(...g.filter((_, i) => beta[i] < upper[i] - eps));
      const high = Math.min(...g.filter((_, i) => beta[i] > lower[i] + eps));
      b = (low + high) / 2;
      kkt = Math.max(0, low - high);
      const norm = M.dot(w, w);
      primal = 0.5 * norm + C * M.sum(X.map((x, i) => Math.max(0, 1 - y[i] * (M.dot(w, x) + b))));
      dual = M.dot(beta, y) - 0.5 * norm;
      gap = Math.max(0, primal - dual);
      converged = gap / Math.max(1, primal) <= tolerance && kkt <= 1e-3;
      history.push([updates, primal, dual]);
      return g;
    }
    let g = certificate();
    while (updates < maxUpdates && !converged) {
      let best = 0,
        chosen = null;
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
          const lo = Math.max(lower[i] - beta[i], beta[j] - upper[j]);
          const hi = Math.min(upper[i] - beta[i], beta[j] - lower[j]);
          if (hi - lo < 1e-14) continue;
          const gradient = g[i] - g[j],
            eta = distances[i][j];
          const t =
            eta > 1e-14 ? Math.max(lo, Math.min(hi, gradient / eta)) : gradient > 0 ? hi : lo;
          const gain = gradient * t - 0.5 * eta * t * t;
          if (gain > best) {
            best = gain;
            chosen = [i, j, t];
          }
        }
      if (!chosen || best < 1e-16) break;
      const [i, j, t] = chosen;
      beta[i] += t;
      beta[j] -= t;
      w[0] += t * (X[i][0] - X[j][0]);
      w[1] += t * (X[i][1] - X[j][1]);
      updates++;
      if (updates <= 20 || updates % 20 === 0) g = certificate();
      else g = X.map((x, i) => y[i] - M.dot(w, x));
    }
    // Always recompute and certify the final iterate, including early stops.
    w[0] = M.sum(beta.map((v, i) => v * X[i][0]));
    w[1] = M.sum(beta.map((v, i) => v * X[i][1]));
    if (history.at(-1)[0] === updates) history.pop();
    certificate();
    const alpha = beta.map((v, i) => v * y[i]),
      support = alpha.map((a, i) => (a > 1e-7 ? i : -1)).filter((i) => i >= 0);
    return {
      w,
      b,
      alpha,
      support,
      updates,
      primal,
      dual,
      gap,
      relativeGap: gap / Math.max(1, primal),
      kkt,
      converged,
      history,
      C
    };
  }
  function experiment({
    logC = 0,
    overlap = 0.65,
    featureScale = 1,
    standardize = true,
    outlier = false,
    seed = 17
  } = {}) {
    const make = (n, s) => {
      const r = M.rng(s),
        X = [],
        y = [];
      for (let i = 0; i < n; i++) {
        const label = i % 2 ? 1 : -1,
          a = r.normal(),
          b = r.normal();
        X.push([1.15 * label + overlap * a, featureScale * (0.55 * label + 0.3 * a + 0.8 * b)]);
        y.push(label);
      }
      return { X, y };
    };
    const train = make(48, seed),
      valid = make(160, seed + 10000);
    if (outlier) {
      train.X.push([-2.6, -1.6 * featureScale]);
      train.y.push(1);
    }
    const mu = standardize ? [0, 1].map((j) => M.mean(train.X.map((x) => x[j]))) : [0, 0];
    const scale = standardize
      ? [0, 1].map((j) =>
          Math.max(1e-12, Math.sqrt(M.mean(train.X.map((x) => (x[j] - mu[j]) ** 2))))
        )
      : [1, 1];
    const transform = (x) => x.map((v, j) => (v - mu[j]) / scale[j]);
    const X = train.X.map(transform),
      V = valid.X.map(transform),
      C = 10 ** logC,
      model = fit(X, train.y, C);
    const predict = (x) => (M.dot(model.w, x) + model.b >= 0 ? 1 : -1);
    function evaluate(data, labels) {
      const matrix = [
        [0, 0],
        [0, 0]
      ];
      data.forEach((x, i) => matrix[labels[i] > 0 ? 1 : 0][predict(x) > 0 ? 1 : 0]++);
      return { matrix, accuracy: (matrix[0][0] + matrix[1][1]) / labels.length };
    }
    const rawW = model.w.map((v, j) => v / scale[j]),
      rawB = model.b - M.dot(rawW, mu);
    return {
      train,
      valid,
      X,
      V,
      mu,
      scale,
      model,
      rawW,
      rawB,
      trainEval: evaluate(X, train.y),
      validEval: evaluate(V, valid.y),
      margin: Math.hypot(...model.w) > 1e-10 ? 2 / Math.hypot(...model.w) : null,
      standardize,
      outlier
    };
  }
  const api = { fit, experiment };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HDSVM = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
