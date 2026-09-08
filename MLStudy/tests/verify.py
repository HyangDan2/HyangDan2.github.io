#!/usr/bin/env python3
"""Independent NumPy references, static document checks, executable snippets."""

import json, subprocess, re, sys
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import numpy as np

ROOT = Path(__file__).resolve().parents[1]


class Parser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.links = []
        self.h1 = 0
        self.language = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a:
            self.ids.append(a['id'])
        if tag in ['a', 'link'] and 'href' in a:
            self.links.append(a['href'])
        if tag in ['script', 'img'] and 'src' in a:
            self.links.append(a['src'])
        if tag == 'h1':
            self.h1 += 1
        if tag == 'html':
            self.language = a.get('lang')


pages = {}
for path in ROOT.rglob('*.html'):
    if 'site-dist' in path.parts or 'i18n' in path.parts:
        continue
    parser = Parser()
    parser.feed(path.read_text())
    pages[path.resolve()] = parser
    assert len(parser.ids) == len(set(parser.ids)), f'duplicate ID {path}'
    assert parser.language in ('en', 'ko', 'ja'), path
    if path.name != 'index.html':
        assert parser.h1 == 1, path
for path, parser in pages.items():
    for link in parser.links:
        u = urlsplit(link)
        if u.scheme or u.netloc:
            continue
        assert not u.path.startswith('/'), (path, link)
        target = (path.parent / unquote(u.path)).resolve() if u.path else path
        assert target.exists(), (path, link)
        if u.fragment and target in pages:
            assert unquote(u.fragment) in pages[target].ids, (path, link)
print(f'Static audit: {len(pages)} pages; links, anchors, language, headings OK')
js = """const m=require('./assets/js/math-core.js');
const regression=[1,3,9].flatMap(degree=>[0,.5].map(ridge=>({degree,ridge,...m.regression({degree,ridge,n:32})})));
const pca=m.pcaExperiment({k:2});
const gmm=m.gmm({k:3,steps:60});
console.log(JSON.stringify({regression,pca,gmm}));"""
d = json.loads(subprocess.check_output(['node', '-e', js], cwd=ROOT, text=True))
for reg in d['regression']:
    train = np.array(reg['train'])
    a = np.polynomial.polynomial.polyvander(2 * train[:, 0] - 1, reg['degree'])
    b = train[:, 1]
    if reg['ridge']:
        penalty = np.eye(reg['degree'] + 1)[1:] * np.sqrt(reg['ridge'])
        a = np.vstack([a, penalty])
        b = np.r_[b, np.zeros(reg['degree'])]
    w = np.linalg.lstsq(a, b, rcond=None)[0]
    np.testing.assert_allclose(w, reg['w'], rtol=1e-7, atol=1e-8)
pca = d['pca']
x = np.array(pca['data'])
xc = x - x.mean(0)
u, s, vt = np.linalg.svd(xc, full_matrices=False)
np.testing.assert_allclose(s * s / len(x), pca['model']['values'], rtol=1e-9, atol=1e-10)
restored = (xc @ vt[:2].T) @ vt[:2] + x.mean(0)
np.testing.assert_allclose(restored, pca['restored'], atol=1e-9)
g = d['gmm']
x = np.array(g['data'])
logp = []
for c in g['components']:
    a, b, e = c['cov']
    cov = np.array([[a, b], [b, e]])
    delta = x - np.array(c['mu'])
    logp.append(
        np.log(c['weight'])
        - np.log(2 * np.pi)
        - np.linalg.slogdet(cov)[1] / 2
        - np.sum((delta @ np.linalg.inv(cov)) * delta, axis=1) / 2
    )
logp = np.array(logp).T
shift = logp.max(1)
normalizer = shift + np.log(np.exp(logp - shift[:, None]).sum(1))
np.testing.assert_allclose(normalizer.sum(), g['ll'], rtol=1e-10)
np.testing.assert_allclose(np.exp(logp - normalizer[:, None]), g['r'], atol=1e-10)
print(
    'Independent NumPy reference: QR/Ridge 6 cases, PCA/SVD, Gaussian log-density/responsibilities OK'
)
# SVM analytic example: primal and dual objectives match (weak duality certificate).
x = np.array([[-2.0, 0], [-1, 1], [1, 1], [2, 0]])
y = np.array([-1, -1, 1, 1])
alpha = np.array([0, 0.5, 0.5, 0])
w = (alpha * y) @ x
assert np.all(y * (x @ w) >= 1) and abs(alpha @ y) < 1e-12
assert np.isclose(0.5 * (w @ w), alpha.sum() - 0.5 * (w @ w))
print('SVM: matching primal/dual objective certifies the worked optimum')
subprocess.run(
    [sys.executable, str(ROOT / 'downloads/study-examples.py')], check=True, capture_output=True
)
nb = json.loads((ROOT / 'downloads/study-examples.ipynb').read_text())
ns = {}
for cell in nb['cells']:
    if cell['cell_type'] == 'code':
        exec(''.join(cell['source']), ns)
print('Python download and all notebook code cells executed successfully')


# Independent certificates: a feasible primal upper bound and dual lower bound.
svm_js = """const s=require('./assets/js/svm-core.js');console.log(JSON.stringify([{}, {logC:-2,overlap:1.5}, {logC:1,outlier:true}, {standardize:false,featureScale:8,logC:1,outlier:true}].map(o=>s.experiment(o))));"""
svms = json.loads(subprocess.check_output(['node', '-e', svm_js], cwd=ROOT, text=True))
for d in svms:
    x = np.array(d['X'])
    y = np.array(d['train']['y'])
    m = d['model']
    a = np.array(m['alpha'])
    w = np.array(m['w'])
    assert np.min(a) >= -1e-9 and np.max(a) <= m['C'] + 1e-9 and abs(a @ y) < 1e-8
    np.testing.assert_allclose((a * y) @ x, w, atol=1e-8)
    primal = 0.5 * (w @ w) + m['C'] * np.maximum(0, 1 - y * (x @ w + m['b'])).sum()
    dual = a.sum() - 0.5 * ((a * y) @ (x @ x.T) @ (a * y))
    np.testing.assert_allclose([primal, dual], [m['primal'], m['dual']], atol=1e-7)
    assert dual <= primal + 1e-7
    if m['converged']:
        assert (primal - dual) / max(1, primal) <= 1.01e-5
print('Trained SVM: NumPy independently verifies primal/dual certificates on four conditions')
