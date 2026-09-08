'use strict';
const assert = require('node:assert/strict');
const M = require('../assets/js/math-core.js');
let checks = 0;
function close(a, b, tol = 1e-8) {
  assert.ok(Math.abs(a - b) <= tol * (1 + Math.abs(b)), a + ' != ' + b);
  checks++;
}
assert.deepEqual(M.regression(), M.regression());
checks++;
const ls = M.leastSquares(
  [
    [1, 0],
    [1, 1],
    [1, 2]
  ],
  [2, 3, 5]
);
close(ls[0], 11 / 6);
close(ls[1], 1.5);
for (const degree of [1, 3, 6, 9])
  for (const n of [12, 32, 100])
    for (const noise of [0, 0.7, 2])
      for (const ridge of [0, 0.1, 5]) {
        const d = M.regression({ degree, n, noise, ridge });
        assert.ok([...d.w, d.trainMSE, d.validMSE].every(Number.isFinite));
        checks++;
        if (noise === 0 && degree === 3 && ridge === 0) close(d.validMSE, 0);
      }
const grad = (x, y, k) => [x, k * y],
  h = 1e-5,
  f = (x, y) => 0.5 * (x * x + 6 * y * y);
close(grad(3, 2, 6)[0], (f(3 + h, 2) - f(3 - h, 2)) / (2 * h));
close(grad(3, 2, 6)[1], (f(3, 2 + h) - f(3, 2 - h)) / (2 * h));
const gd = M.descent({ rate: 0.15, curvature: 6, steps: 100 });
assert.ok(gd.losses.every((v, i) => i === 0 || v <= gd.losses[i - 1] + 1e-10));
checks++;
assert.match(M.descent({ rate: 0.6, curvature: 12, steps: 100 }).status, /Divergence/);
checks++;
assert.ok(M.descent({ rate: 0.6, curvature: 12, steps: 100, scaled: true }).losses.at(-1) < 1e-9);
checks++;
for (const k of [1, 2, 3, 4, 5, 6])
  for (const noise of [0, 0.35, 1])
    for (const correlation of [0, 0.8, 0.95]) {
      const p = M.pcaExperiment({ k, noise, correlation });
      close(p.error, p.discarded);
      const v = p.model.vectors;
      for (let i = 0; i < 6; i++)
        for (let j = 0; j < 6; j++) close(M.sum(v.map((r) => r[i] * r[j])), i === j ? 1 : 0);
      if (k === 6) close(p.error, 0);
    }
for (const k of [1, 2, 3, 4])
  for (const seed of [1, 7, 29, 60])
    for (const steps of [0, 1, 20, 60]) {
      const g = M.gmm({ k, seed, steps });
      assert.ok(Number.isFinite(g.ll));
      checks++;
      close(M.sum(g.components.map((c) => c.weight)), 1);
      for (const r of g.r) close(M.sum(r), 1);
      assert.ok(g.history.every((v, i) => i === 0 || v >= g.history[i - 1] - 1e-5));
      checks++;
      g.components.forEach((c) => {
        assert.ok(c.cov[0] * c.cov[2] - c.cov[1] ** 2 > 0);
        checks++;
      });
    }
close(M.logSumExp([-900, -902]), -900 + Math.log1p(Math.exp(-2)));
const pc = M.pcaFit([
  [3, 1],
  [1, 3],
  [-1, -3],
  [-3, -1]
]);
assert.ok(pc.values[0] >= pc.values[1]);
checks++;
console.log(
  JSON.stringify({ status: 'passed', checks, regressionCases: 108, pcaCases: 54, gmmCases: 64 })
);
