/* HD2Lab numerical experiments. No dependencies. Node and browser compatible. */
(function (root) {
  'use strict';
  const sum = (xs) => xs.reduce((a, b) => a + b, 0);
  const dot = (a, b) => sum(a.map((v, i) => v * b[i]));
  const mean = (xs) => sum(xs) / xs.length;
  const mse = (a, b) => mean(a.map((v, i) => (v - b[i]) ** 2));
  const zeros = (m, n) => Array.from({ length: m }, () => Array(n).fill(0));
  function rng(seed) {
    let state = seed >>> 0;
    const uniform = () => {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      uniform,
      normal: () =>
        Math.sqrt(-2 * Math.log(Math.max(uniform(), 1e-15))) * Math.cos(2 * Math.PI * uniform())
    };
  }
  // Householder QR: stable least squares without forming X^T X.
  function leastSquares(design, target, ridge = 0) {
    const n = design[0].length;
    const a = design.map((row) => row.slice()),
      b = target.slice();
    if (ridge > 0)
      for (let j = 1; j < n; j++) {
        const row = Array(n).fill(0);
        row[j] = Math.sqrt(ridge);
        a.push(row);
        b.push(0);
      }
    const m = a.length;
    if (m < n) throw new Error('계수보다 관측값이 적습니다.');
    for (let k = 0; k < n; k++) {
      const v = a.slice(k).map((row) => row[k]);
      const norm = Math.hypot(...v);
      if (norm < 1e-12) throw new Error('독립적인 특징이 부족합니다.');
      v[0] += (v[0] >= 0 ? 1 : -1) * norm;
      const scale = Math.hypot(...v);
      v.forEach((_, i) => {
        v[i] /= scale;
      });
      for (let j = k; j < n; j++) {
        let proj = 0;
        for (let i = k; i < m; i++) proj += v[i - k] * a[i][j];
        for (let i = k; i < m; i++) a[i][j] -= 2 * v[i - k] * proj;
      }
      let proj = 0;
      for (let i = k; i < m; i++) proj += v[i - k] * b[i];
      for (let i = k; i < m; i++) b[i] -= 2 * v[i - k] * proj;
    }
    const w = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let right = b[i];
      for (let j = i + 1; j < n; j++) right -= a[i][j] * w[j];
      w[i] = right / a[i][i];
    }
    return w;
  }
  const basis = (x, degree) => Array.from({ length: degree + 1 }, (_, j) => (2 * x - 1) ** j);
  const latency = (x) => 3 + 2 * x + 7 * x ** 3;
  function regression({ degree = 3, n = 32, noise = 0.7, ridge = 0, seed = 1729 } = {}) {
    const make = (count, s) => {
      const random = rng(s);
      return Array.from({ length: count }, () => {
        const x = random.uniform();
        return [x, latency(x) + noise * random.normal()];
      });
    };
    const train = make(n, seed),
      valid = make(120, seed + 1);
    const design = train.map((p) => basis(p[0], degree));
    const w = leastSquares(
      design,
      train.map((p) => p[1]),
      ridge
    );
    const predict = (x) => dot(w, basis(x, degree));
    return {
      train,
      valid,
      w,
      trainMSE: mse(
        train.map((p) => p[1]),
        train.map((p) => predict(p[0]))
      ),
      validMSE: mse(
        valid.map((p) => p[1]),
        valid.map((p) => predict(p[0]))
      ),
      curve: Array.from({ length: 161 }, (_, i) => {
        const x = -0.15 + (1.3 * i) / 160;
        return [x, predict(x)];
      })
    };
  }
  function descent({ rate = 0.15, curvature = 6, x = 3, y = 2, steps = 45, scaled = false } = {}) {
    const path = [[x, y]],
      losses = [0.5 * (x * x + curvature * y * y)];
    let status = '반복 상한 도달';
    for (let i = 0; i < steps; i++) {
      x -= rate * x;
      y -= rate * (scaled ? y : curvature * y);
      const loss = 0.5 * (x * x + curvature * y * y);
      if (!Number.isFinite(loss) || loss > 1e12) {
        status = '발산: 학습률을 줄여 주세요';
        break;
      }
      path.push([x, y]);
      losses.push(loss);
      if (loss < 1e-10) {
        status = '수렴';
        break;
      }
    }
    if (status === '반복 상한 도달' && losses.at(-1) > losses[0] * 1.01)
      status = '손실 증가: 발산 경향';
    return { path, losses, status };
  }
  // Symmetric Jacobi eigensolver. Eigenvectors are columns, sorted descending.
  function eigenSymmetric(matrix) {
    const n = matrix.length,
      a = matrix.map((r) => r.slice()),
      vectors = zeros(n, n);
    for (let i = 0; i < n; i++) vectors[i][i] = 1;
    for (let iter = 0; iter < 100 * n * n; iter++) {
      let p = 0,
        q = 1,
        big = 0;
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++)
          if (Math.abs(a[i][j]) > big) {
            big = Math.abs(a[i][j]);
            p = i;
            q = j;
          }
      if (big < 1e-12) break;
      const angle = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]);
      const c = Math.cos(angle),
        s = Math.sin(angle),
        pp = a[p][p],
        qq = a[q][q],
        pq = a[p][q];
      for (let i = 0; i < n; i++)
        if (i !== p && i !== q) {
          const ip = a[i][p],
            iq = a[i][q];
          a[i][p] = a[p][i] = c * ip - s * iq;
          a[i][q] = a[q][i] = s * ip + c * iq;
        }
      a[p][p] = c * c * pp - 2 * c * s * pq + s * s * qq;
      a[q][q] = s * s * pp + 2 * c * s * pq + c * c * qq;
      a[p][q] = a[q][p] = 0;
      for (let i = 0; i < n; i++) {
        const ip = vectors[i][p],
          iq = vectors[i][q];
        vectors[i][p] = c * ip - s * iq;
        vectors[i][q] = s * ip + c * iq;
      }
    }
    const order = Array.from({ length: n }, (_, i) => i).sort((i, j) => a[j][j] - a[i][i]);
    return {
      values: order.map((i) => a[i][i]),
      vectors: vectors.map((row) => order.map((i) => row[i]))
    };
  }
  function pcaFit(data) {
    const n = data.length,
      d = data[0].length;
    const mu = Array.from({ length: d }, (_, j) => mean(data.map((row) => row[j])));
    const centered = data.map((row) => row.map((v, j) => v - mu[j]));
    const covariance = zeros(d, d);
    for (let j = 0; j < d; j++)
      for (let k = 0; k < d; k++) covariance[j][k] = mean(centered.map((row) => row[j] * row[k]));
    return { mu, centered, covariance, ...eigenSymmetric(covariance) };
  }
  function reconstruct(data, model, k) {
    return data.map((row) => {
      const centered = row.map((v, j) => v - model.mu[j]);
      const z = Array.from({ length: k }, (_, i) =>
        sum(centered.map((v, j) => v * model.vectors[j][i]))
      );
      return centered.map((_, j) => model.mu[j] + sum(z.map((v, i) => v * model.vectors[j][i])));
    });
  }
  function pcaExperiment({ k = 2, noise = 0.35, correlation = 0.8, seed = 431 } = {}) {
    const random = rng(seed),
      data = [];
    const loadings = [
      [1, 0.1],
      [0.8, 0.4],
      [-0.4, 0.9],
      [0.2, -0.8],
      [0.6, 0.6],
      [-0.7, 0.2]
    ];
    for (let i = 0; i < 180; i++) {
      const a = random.normal(),
        b = correlation * a + Math.sqrt(1 - correlation ** 2) * random.normal();
      data.push(loadings.map(([u, v]) => 2 * u * a + v * b + noise * random.normal()));
    }
    const model = pcaFit(data),
      restored = reconstruct(data, model, k);
    const error = mean(data.map((row, i) => sum(row.map((v, j) => (v - restored[i][j]) ** 2))));
    return {
      data,
      restored,
      model,
      error,
      discarded: sum(model.values.slice(k)),
      ratio: sum(model.values.slice(0, k)) / sum(model.values)
    };
  }
  const logSumExp = (xs) => {
    const m = Math.max(...xs);
    return m + Math.log(sum(xs.map((v) => Math.exp(v - m))));
  };
  function logGaussian(point, component) {
    const [a, b, c] = component.cov,
      det = a * c - b * b,
      dx = point[0] - component.mu[0],
      dy = point[1] - component.mu[1];
    return (
      -Math.log(2 * Math.PI) -
      0.5 * Math.log(det) -
      (0.5 * (c * dx * dx - 2 * b * dx * dy + a * dy * dy)) / det
    );
  }
  function responsibilities(data, components) {
    let ll = 0;
    const r = data.map((point) => {
      const logp = components.map((c) => Math.log(c.weight) + logGaussian(point, c));
      const total = logSumExp(logp);
      ll += total;
      return logp.map((v) => Math.exp(v - total));
    });
    return { r, ll };
  }
  function mixtureData(seed = 812) {
    const random = rng(seed);
    return Array.from({ length: 240 }, () => {
      const which = random.uniform(),
        a = random.normal(),
        b = random.normal();
      if (which < 0.45) return [-1.4 + 0.65 * a, -0.5 + 0.5 * a + 0.6 * b];
      if (which < 0.8) return [1.2 + 0.7 * a, 1.1 - 0.35 * a + 0.45 * b];
      return [0.7 + 0.4 * a, -1.35 + 0.7 * b];
    });
  }
  function gmm({ k = 3, steps = 20, seed = 29, data = mixtureData() } = {}) {
    const random = rng(seed),
      overall = pcaFit(data).covariance;
    let components = Array.from({ length: k }, () => ({
      mu: data[Math.floor(random.uniform() * data.length)].slice(),
      cov: [overall[0][0], overall[0][1], overall[1][1]],
      weight: 1 / k
    }));
    let result = responsibilities(data, components),
      history = [result.ll],
      status = '설정한 반복 완료';
    for (let iteration = 0; iteration < steps; iteration++) {
      const next = components.map((old, j) => {
        const count = sum(result.r.map((r) => r[j]));
        if (count < 1e-8) return old;
        const mu = [0, 1].map((d) => sum(data.map((p, i) => result.r[i][j] * p[d])) / count);
        const a = sum(data.map((p, i) => result.r[i][j] * (p[0] - mu[0]) ** 2)) / count;
        const b = sum(data.map((p, i) => result.r[i][j] * (p[0] - mu[0]) * (p[1] - mu[1]))) / count;
        const c = sum(data.map((p, i) => result.r[i][j] * (p[1] - mu[1]) ** 2)) / count;
        // Tiny diagonal regularization for numerical stability.
        return { mu, cov: [a + 1e-6, b, c + 1e-6], weight: count / data.length };
      });
      const weightSum = sum(next.map((c) => c.weight));
      next.forEach((c) => {
        c.weight /= weightSum;
      });
      const updated = responsibilities(data, next);
      if (!Number.isFinite(updated.ll)) {
        status = '수치 오류로 중단';
        break;
      }
      if (updated.ll < result.ll - 1e-5) {
        status = '안정화를 위해 갱신 중단';
        break;
      }
      const gain = updated.ll - result.ll;
      components = next;
      result = updated;
      history.push(result.ll);
      if (Math.abs(gain) < 1e-6) {
        status = '수렴';
        break;
      }
    }
    return { data, components, ...result, history, status };
  }
  const api = {
    rng,
    sum,
    dot,
    mean,
    mse,
    leastSquares,
    basis,
    latency,
    regression,
    descent,
    eigenSymmetric,
    pcaFit,
    reconstruct,
    pcaExperiment,
    logSumExp,
    logGaussian,
    responsibilities,
    mixtureData,
    gmm
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HDMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
