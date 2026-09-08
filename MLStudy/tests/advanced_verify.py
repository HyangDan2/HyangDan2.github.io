#!/usr/bin/env python3
"""Independent invariants and references for the published advanced cases.
NumPy required; --notebook also requires Matplotlib and IPython.
"""

from pathlib import Path
import contextlib
import io
import json
import math
import os
import runpy
import sys
import tempfile
import xml.etree.ElementTree as ET
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
engine = runpy.run_path(str(ROOT / 'downloads/advanced-experiments.py'))
results = [fn() for fn in engine['EXPERIMENTS']]
stored = json.loads((ROOT / 'downloads/advanced-results.json').read_text())


def same(actual, expected):
    if isinstance(expected, dict):
        assert actual.keys() == expected.keys()
        for key in expected:
            same(actual[key], expected[key])
    else:
        np.testing.assert_allclose(actual, expected, rtol=1e-8, atol=1e-9)


for i, r in enumerate(results, 1):
    same(r['summary'], stored[str(i)])
# Classification counts and the frozen time model are recalculated independently.
d = results[0]
for threshold, tp, fp, fn, tn, precision, recall, accuracy, cost in d['thresholds']:
    pred = (d['scores'] >= threshold).astype(int)
    y = d['labels']
    confusion = np.bincount(2 * y + pred, minlength=4)
    np.testing.assert_equal(confusion, [tn, fp, fn, tp])
    assert cost == 25 * fn + fp
    assert np.isclose(accuracy, np.mean(pred == y))
np.testing.assert_allclose(
    d['cycle'], d['X'] @ np.linalg.lstsq(d['X'][:120], d['y'][:120], rcond=None)[0]
)
# Augmented least squares independently agrees with the centered SVD ridge formula.
rng = np.random.default_rng(319)
features = rng.normal(size=(40, 3))
response = 3 + features @ np.array([1.0, -2, 0.3]) + rng.normal(0, 0.2, 40)
X = np.c_[np.ones(40), features]
xc = features - features.mean(0)
yc = response - response.mean()
u, s, vt = np.linalg.svd(xc, full_matrices=False)
for alpha in [0, 0.01, 1, 100]:
    w = vt.T @ ((s / (s * s + alpha)) * (u.T @ yc))
    b = response.mean() - features.mean(0) @ w
    np.testing.assert_allclose(engine['ridge'](X, response, alpha), np.r_[b, w], atol=1e-10)
# Newton, the heavy-ball spectral recurrence and the SGD stationary variance.
d = results[2]
eigen = np.linalg.eigvalsh(d['H'])
np.testing.assert_allclose(eigen, [1, 30], atol=1e-12)
assert np.linalg.norm(d['paths']['Newton'][1]) < 1e-12
for lam in eigen:
    assert np.max(abs(np.roots([1, -(1 + 0.65 - 0.07 * lam), 0.65]))) < 1
assert min(d['errors']) < 1e-8
for batch in [1, 16, 64]:
    eta = 0.1
    noisevar = 4 / batch
    var = eta * eta * noisevar / (1 - (1 - eta * 4) ** 2)
    assert np.isclose(2 * var, d['floors'][str(batch)])
    assert np.isclose(np.mean(d['noise'][str(batch)][-30:]), 2 * var, rtol=0.04)
# Integer beta CDF via a binomial tail: independent of quadrature and log-gamma PDF.
d = results[3]
for (a, b), density, interval in zip(d['parameters'], d['densities'], d['intervals']):
    np.testing.assert_allclose(np.trapezoid(density, d['p']), 1, atol=3e-6)
    for p, target in zip(interval, [0.025, 0.975]):
        cdf = sum(
            math.comb(a + b - 1, j) * p**j * (1 - p) ** (a + b - 1 - j) for j in range(a, a + b)
        )
        assert abs(cdf - target) < 5e-6, (a, b, p, cdf, target)
assert np.isclose(d['summary']['ppv_at_2percent'], 180 / 572)
np.testing.assert_allclose(
    (1 - d['summary']['action_threshold']), 25 * d['summary']['action_threshold']
)
# PCA eigensystem and training reconstruction identity. Exact label-pair counterexample.
d = results[4]
xc = d['X'] - d['X'].mean(0)
np.testing.assert_allclose(np.linalg.eigvalsh(xc.T @ xc / len(xc))[::-1], d['eigen'], atol=1e-12)
for k in range(7):
    np.testing.assert_allclose(d['errors'][k, 0], d['eigen'][k:].sum(), atol=1e-12)
assert d['errors'][2, 2] < d['errors'][6, 2]
np.testing.assert_allclose(d['projected'][::2], d['projected'][1::2], atol=1e-12)
assert np.all(d['label'][::2] == -d['label'][1::2])
# Gaussian densities against a direct inverse/determinant reference and BIC count.
d = results[5]
m = d['model']
X = d['X']
joint = []
for weight, mu, cov in zip(m['weights'], m['means'], m['covs']):
    delta = X - mu
    density = (
        weight
        * np.exp(-0.5 * np.einsum('ni,ij,nj->n', delta, np.linalg.inv(cov), delta))
        / (2 * np.pi * np.sqrt(np.linalg.det(cov)))
    )
    joint.append(density)
joint = np.array(joint).T
np.testing.assert_allclose(m['r'], joint / joint.sum(1, keepdims=True), atol=1e-12)
np.testing.assert_allclose(m['history'][-1], np.log(joint.sum(1)).sum(), atol=1e-10)
assert np.min(np.linalg.eigvalsh(m['covs'])) > 0
for history in d['starts']:
    assert np.diff(history).min() > -1e-7
for k, ll, bic, val in d['rows']:
    assert np.isclose(bic, -2 * ll + (6 * k - 1) * np.log(210))
single = engine['fit_gmm'](X, 1, 3)
np.testing.assert_allclose(single['means'][0], X.mean(0), atol=1e-12)
# Feasible primal / dual bounds independently certify all five displayed SVM fits.
d = results[6]
Z = (d['X'] - d['mu']) / d['sd']
cases = [(Z, d['y'], m) for m in d['models']]
cases += [
    (d['xy'], d['labels'], d['linear']),
    (np.c_[d['xy'], d['xy'][:, 0] * d['xy'][:, 1]], d['labels'], d['nonlinear']),
]
for X, y, m in cases:
    a = m['alpha']
    w = m['w']
    C = m['C']
    margin = y * (X @ w + m['b'])
    assert abs(a @ y) < 1e-8 and a.min() > -1e-8 and a.max() < C + 1e-8
    np.testing.assert_allclose(w, (a * y) @ X, atol=1e-10)
    primal = 0.5 * (w @ w) + C * np.maximum(0, 1 - margin).sum()
    dual = a.sum() - 0.5 * ((a * y) @ (X @ X.T) @ (a * y))
    assert -1e-8 <= (primal - dual) / max(1, primal) < 1e-5
    free = (a > 1e-6) & (a < C - 1e-6)
    np.testing.assert_allclose(margin[free], 1, atol=1e-4)
    assert np.all(margin[a < 1e-6] >= 1 - 1e-4)
    assert np.all(margin[a > C - 1e-6] <= 1 + 1e-4)
known = engine['fit_svm'](
    np.array([[-2.0, 0], [-1, 1], [1, 1], [2, 0]]), np.array([-1.0, -1, 1, 1]), 10
)
np.testing.assert_allclose(known['w'], [1, 0], atol=1e-6)
assert abs(known['primal'] - 0.5) < 1e-6
# Complete topology: every chapter has three cases and four generated figures.
for page in sorted((ROOT / 'chapters').glob('*.html')):
    html = page.read_text()
    for key in ['advanced-a', 'advanced-b', 'advanced-c']:
        assert f'<section id="{key}">' in html
    assert html.count('class="advanced-figure"') == 4
figures = list((ROOT / 'assets/images/advanced').glob('*.svg'))
assert len(figures) == 28
for path in figures:
    root = ET.parse(path).getroot()
    assert root.tag.endswith('svg')
    assert 'HD2LAB' in path.read_text()
print(
    'Advanced: seven result sets, numerical references, five SVM certificates, 21 cases and 28 SVG files OK'
)
if '--notebook' in sys.argv:
    os.environ.setdefault('MPLCONFIGDIR', str(Path(tempfile.gettempdir()) / 'hd2lab-matplotlib'))
    notebook = json.loads((ROOT / 'downloads/advanced-experiments.ipynb').read_text())
    ns = {}
    count = 0
    outputs = []
    for cell in notebook['cells']:
        if cell['cell_type'] != 'code':
            continue
        stream = io.StringIO()
        with contextlib.redirect_stdout(stream):
            exec(''.join(cell['source']), ns)
        # Capture display after the plot helpers import IPython.display.
        if 'display' in ns:
            ns['display'] = lambda obj: outputs.append(obj.data)
        count += 1
        if cell['outputs']:
            saved = next(o for o in cell['outputs'] if o['output_type'] == 'stream')
            same(json.loads(stream.getvalue()), json.loads(''.join(saved['text'])))
    assert count == 9 and len(outputs) == 28
    for svg in outputs:
        assert ET.fromstring(svg).tag.endswith('svg')
    print(
        'Advanced notebook: all 9 code cells executed; all result tables match; 28 SVG outputs recreated'
    )
