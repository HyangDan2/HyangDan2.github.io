'use strict';
const assert = require('node:assert/strict'),
  S = require('../assets/js/svm-core.js'),
  M = require('../assets/js/math-core.js');
const close = (a, b, tol = 1e-7) =>
  assert.ok(Math.abs(a - b) <= tol * (1 + Math.abs(b)), a + ' != ' + b);
const known = S.fit(
  [
    [-2, 0],
    [-1, 1],
    [1, 1],
    [2, 0]
  ],
  [-1, -1, 1, 1],
  1
);
close(known.w[0], 1);
close(known.w[1], 0);
close(known.b, 0);
close(known.primal, 0.5);
assert.ok(known.converged);
const duplicate = S.fit(
  [
    [0, 0],
    [0, 0]
  ],
  [-1, 1],
  1
);
close(duplicate.primal, 2);
close(duplicate.dual, 2);
assert.ok(duplicate.converged);
const unfinished = S.fit(
  [
    [-2, 0],
    [-1, 1],
    [1, 1],
    [2, 0]
  ],
  [-1, -1, 1, 1],
  1,
  { maxUpdates: 0 }
);
assert.ok(!unfinished.converged && unfinished.gap > 0);
let count = 0,
  converged = 0,
  maxGap = 0;
for (const logC of [-2, 0, 1])
  for (const overlap of [0, 0.65, 1.5])
    for (const seed of [1, 17, 60])
      for (const featureScale of [1, 8])
        for (const standardize of [false, true])
          for (const outlier of [false, true]) {
            const d = S.experiment({ logC, overlap, seed, featureScale, standardize, outlier }),
              m = d.model;
            assert.ok(m.alpha.every((a) => a >= -1e-8 && a <= m.C + 1e-8));
            close(M.dot(m.alpha, d.train.y), 0);
            close(m.w[0], M.sum(m.alpha.map((a, i) => a * d.train.y[i] * d.X[i][0])));
            close(m.w[1], M.sum(m.alpha.map((a, i) => a * d.train.y[i] * d.X[i][1])));
            assert.ok(m.primal >= m.dual - 1e-7);
            assert.ok(m.history.every((h, i) => i === 0 || h[2] >= m.history[i - 1][2] - 1e-6));
            assert.equal(m.converged, m.relativeGap <= 1e-5 && m.kkt <= 1e-3);
            assert.equal(M.sum(d.validEval.matrix.flat()), 160);
            d.train.X.forEach((x, i) => close(M.dot(d.rawW, x) + d.rawB, M.dot(m.w, d.X[i]) + m.b));
            if (standardize) {
              const base = S.experiment({
                logC,
                overlap,
                seed,
                featureScale: 1,
                standardize,
                outlier
              });
              close(d.validEval.accuracy, base.validEval.accuracy);
              close(m.primal, base.model.primal, 1e-4);
            }
            assert.ok([m.b, ...m.w, m.primal, m.dual, m.gap].every(Number.isFinite));
            count++;
            converged += m.converged;
            maxGap = Math.max(maxGap, m.relativeGap);
          }
assert.deepEqual(S.experiment(), S.experiment());
console.log(
  JSON.stringify({
    settings: count,
    converged,
    explicitlyUnconverged: count - converged,
    maxRelativeGap: maxGap,
    status: 'passed'
  })
);
