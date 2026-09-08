#!/usr/bin/env python3
"""HD2Lab 심화 실험: NumPy만으로 실행. 모든 관측은 합성 데이터.
python advanced-experiments.py --chapter 2
python advanced-experiments.py --output-json results.json
함수별 반환 배열로 표와 그림을 재현한다. 시드는 장마다 고정한다.
"""

import argparse
import json
import math
from pathlib import Path
import numpy as np


def mse(y, prediction):
    return float(np.mean((y - prediction) ** 2))


def ridge(X, y, alpha):
    # 잔차 제곱합 + alpha * ||기울기||². 첫 열은 절편.
    penalty = np.eye(X.shape[1])[1:] * np.sqrt(alpha)
    return np.linalg.lstsq(np.vstack([X, penalty]), np.r_[y, np.zeros(len(penalty))], rcond=None)[0]


def data_experiment():
    rng = np.random.default_rng(2101)
    hour = np.arange(200) % 24
    t = np.arange(200)
    signal = 30 + 8 * np.sin(2 * np.pi * hour / 24)
    y = signal + 6 * (t >= 140) + rng.normal(0, 1.5, 200)
    X = np.c_[np.ones(200), np.sin(2 * np.pi * hour / 24), np.cos(2 * np.pi * hour / 24)]
    raw = np.c_[np.ones(200), hour]
    train, valid, test = np.arange(120), np.arange(120, 160), np.arange(160, 200)
    cycle = X @ ridge(X[train], y[train], 0)
    linear = raw @ ridge(raw[train], y[train], 0)
    # 의도적으로 금지된 비교: 타깃이 이미 들어 있는 특징.
    leaked = np.c_[X, y + rng.normal(0, 0.02, 200)]
    oracle = leaked @ ridge(leaked[train], y[train], 0)
    shuffled = rng.permutation(160)
    random_train, random_valid = shuffled[:120], shuffled[120:]
    random_pred = X @ ridge(X[random_train], y[random_train], 0)
    labels = np.r_[np.ones(200, dtype=int), np.zeros(9800, dtype=int)]
    scores = 2 * labels + rng.normal(size=10000)
    thresholds = np.linspace(-1, 4, 101)
    rows = []
    for threshold in thresholds:
        positive = scores >= threshold
        tp = int(np.sum(positive & (labels == 1)))
        fp = int(np.sum(positive & (labels == 0)))
        fn = 200 - tp
        rows.append(
            [
                threshold,
                tp,
                fp,
                fn,
                9800 - fp,
                tp / max(1, tp + fp),
                tp / 200,
                (tp + 9800 - fp) / 10000,
                25 * fn + fp,
            ]
        )
    rows = np.array(rows)
    return dict(
        hour=hour,
        t=t,
        y=y,
        signal=signal,
        X=X,
        cycle=cycle,
        linear=linear,
        thresholds=rows,
        scores=scores,
        labels=labels,
        summary=dict(
            cycle_valid=mse(y[valid], cycle[valid]),
            raw_valid=mse(y[valid], linear[valid]),
            random_valid=mse(y[random_valid], random_pred[random_valid]),
            cycle_test=mse(y[test], cycle[test]),
            leaked_valid=mse(y[valid], oracle[valid]),
            threshold_rows=rows[[30, 50, 70]].tolist(),
            best_threshold=float(rows[np.argmin(rows[:, -1]), 0]),
        ),
    )


def regression_experiment():
    rng = np.random.default_rng(2202)
    x = rng.normal(size=70)
    X = np.c_[np.ones(70), x, x + 0.015 * rng.normal(size=70)]
    y = 1 + 2 * x + rng.normal(0, 0.4, 70)
    alphas = np.logspace(-5, 2, 60)
    path = np.array([ridge(X, y, a) for a in alphas])
    perturb = np.array(
        [[ridge(X, y + rng.normal(0, 0.05, 70), a) for a in [0, 1]] for _ in range(120)]
    )
    singular = np.linalg.svd(X[:, 1:] - X[:, 1:].mean(0), compute_uv=False)
    xp = rng.uniform(-1, 1, 30)
    truth = lambda v: 1 + 1.8 * v - 2 * v * v + 2.5 * v**3
    yp = truth(xp) + rng.normal(0, 0.45, 30)
    xv = rng.uniform(-1, 1, 240)
    yv = truth(xv) + rng.normal(0, 0.45, 240)
    degrees = np.arange(1, 10)
    grid_alpha = np.array([0, 0.0001, 0.01, 0.1, 1, 10])
    errors = np.array(
        [
            [
                mse(
                    yv,
                    np.polynomial.polynomial.polyvander(xv, d)
                    @ ridge(np.polynomial.polynomial.polyvander(xp, d), yp, a),
                )
                for a in grid_alpha
            ]
            for d in degrees
        ]
    )
    di, ai = np.unravel_index(errors.argmin(), errors.shape)
    degree, alpha = int(degrees[di]), float(grid_alpha[ai])
    xt = rng.uniform(-1, 1, 400)
    yt = truth(xt) + rng.normal(0, 0.45, 400)
    final_w = ridge(np.polynomial.polynomial.polyvander(xp, degree), yp, alpha)
    test_mse = mse(yt, np.polynomial.polynomial.polyvander(xt, degree) @ final_w)
    grid = np.linspace(-1.35, 1.35, 250)
    fits = {
        str(d): np.polynomial.polynomial.polyvander(grid, d)
        @ ridge(np.polynomial.polynomial.polyvander(xp, d), yp, 0)
        for d in [1, 3, 9]
    }
    design = np.polynomial.polynomial.polyvander(xp, degree)
    basis = np.polynomial.polynomial.polyvander(grid, degree)
    boot = []
    for _ in range(350):
        ids = rng.integers(0, len(xp), len(xp))
        boot.append(basis @ ridge(design[ids], yp[ids], alpha))
    boot = np.array(boot)
    # 잡음 표준편차 .45가 알려진 이 합성 문제에서만 가능한 예측 draw.
    predictive = boot + rng.normal(0, 0.45, boot.shape)
    return dict(
        alphas=alphas,
        path=path,
        perturb=perturb,
        singular=singular,
        xp=xp,
        yp=yp,
        grid=grid,
        truth=truth(grid),
        fits=fits,
        degrees=degrees,
        grid_alpha=grid_alpha,
        errors=errors,
        center=basis @ final_w,
        mean_band=np.quantile(boot, [0.025, 0.975], axis=0),
        predict_band=np.quantile(predictive, [0.025, 0.975], axis=0),
        summary=dict(
            singular=singular.tolist(),
            coefficient_sd=perturb[:, :, 1:].std(0).tolist(),
            sum_sd=perturb[:, :, 1:].sum(2).std(0).tolist(),
            degree=degree,
            alpha=alpha,
            validation=float(errors[di, ai]),
            test=test_mse,
        ),
    )


def optimization_experiment():
    rng = np.random.default_rng(2303)
    angle = np.pi / 5
    R = np.array([[np.cos(angle), -np.sin(angle)], [np.sin(angle), np.cos(angle)]])
    H = R @ np.diag([1.0, 30.0]) @ R.T
    paths = {}
    losses = {}
    for name, rate, beta in [('GD', 0.06, 0), ('Momentum', 0.07, 0.65), ('Newton', 1, 0)]:
        w = np.array([3.0, -2.0])
        v = np.zeros(2)
        points = [w.copy()]
        for _ in range(80):
            gradient = H @ w
            if name == 'Newton':
                w = w - np.linalg.solve(H, gradient)
            else:
                v = beta * v + gradient
                w = w - rate * v
            points.append(w.copy())
        paths[name] = np.array(points)
        losses[name] = np.einsum('ni,ij,nj->n', paths[name], H, paths[name]) / 2
    noise = {}
    floors = {}
    for batch in [1, 16, 64]:
        w = np.full(2048, 2.0)
        trace = []
        for _ in range(120):
            trace.append(float(2 * np.mean(w * w)))
            w -= 0.1 * (4 * w + rng.normal(0, 2 / np.sqrt(batch), len(w)))
        noise[str(batch)] = trace
        floors[str(batch)] = 0.1 * 4 / (2 * batch * (2 - 0.1 * 4))
    X = np.array(
        [[1, -2, 0.5], [1, -1, 1], [1, -0.5, -1], [1, 0.5, 0.2], [1, 1, -0.7], [1, 2, 1.2]]
    )
    y = np.array([0, 0, 1, 0, 1, 1])
    w = np.array([0.2, -0.3, 0.4])

    def loss(q):
        return float(np.mean(np.logaddexp(0, X @ q) - y * (X @ q)))

    p = 1 / (1 + np.exp(-X @ w))
    grad = X.T @ (p - y) / len(y)
    epsilons = np.logspace(-1, -10, 30)
    errors = []
    for e in epsilons:
        numeric = np.array([(loss(w + e * d) - loss(w - e * d)) / (2 * e) for d in np.eye(3)])
        errors.append(float(np.max(abs(numeric - grad))))
    return dict(
        H=H,
        paths=paths,
        losses=losses,
        noise=noise,
        floors=floors,
        epsilons=epsilons,
        errors=errors,
        gradient=grad,
        summary=dict(
            final_loss={k: float(v[-1]) for k, v in losses.items()},
            gradient=grad.tolist(),
            gradient_error=min(errors),
            noise_floor=floors,
            late_noise={k: float(np.mean(v[-30:])) for k, v in noise.items()},
        ),
    )


def beta_density(p, a, b):
    return np.exp(
        (a - 1) * np.log(p)
        + (b - 1) * np.log1p(-p)
        + math.lgamma(a + b)
        - math.lgamma(a)
        - math.lgamma(b)
    )


def probability_experiment():
    p = np.linspace(0.00001, 0.99999, 4001)
    # 독립 Bernoulli의 고정된 관측 집계: 실패 2/20, 이후 실패 7/80.
    parameters = [(2, 18), (4, 36), (11, 109)]
    densities = np.array([beta_density(p, a, b) for a, b in parameters])
    intervals = []
    for density in densities:
        cdf = np.r_[0, np.cumsum((density[:-1] + density[1:]) / 2 * np.diff(p))]
        cdf /= cdf[-1]
        intervals.append(np.interp([0.025, 0.975], cdf, p))
    prevalence = np.linspace(0.001, 0.2, 200)
    ppv = 0.9 * prevalence / (0.9 * prevalence + 0.04 * (1 - prevalence))
    n = np.array([1, 2, 5, 10, 20, 50, 100, 300])
    variance = 1 / (1 / 9 + n / 4)
    posterior_mean = variance * (n * 2 / 4)  # 각 N에서 표본평균을 2초로 고정한 조건부 비교.
    q = np.linspace(0, 1, 250)
    loss_action = 1 * (1 - q)
    loss_ignore = 25 * q
    return dict(
        p=p,
        densities=densities,
        parameters=parameters,
        intervals=np.array(intervals),
        prevalence=prevalence,
        ppv=ppv,
        n=n,
        variance=variance,
        posterior_mean=posterior_mean,
        q=q,
        loss_action=loss_action,
        loss_ignore=loss_ignore,
        summary=dict(
            beta_means=[a / (a + b) for a, b in parameters],
            intervals=np.array(intervals).tolist(),
            ppv_at_2percent=0.9 * 0.02 / (0.9 * 0.02 + 0.04 * 0.98),
            action_threshold=1 / 26,
            parameter_sd=np.sqrt(variance).tolist(),
            predictive_sd=np.sqrt(4 + variance).tolist(),
        ),
    )


def pca_experiment():
    rng = np.random.default_rng(2505)
    A = np.array([[1, 0.2], [0.8, -0.4], [-0.6, 0.7], [0.2, 1], [0.7, 0.5], [-0.5, -0.8]])
    clean = rng.normal(size=(180, 2)) @ A.T
    X = clean + rng.normal(0, 0.55, clean.shape)
    test_clean = rng.normal(size=(400, 2)) @ A.T
    test = test_clean + rng.normal(0, 0.55, test_clean.shape)
    mean = X.mean(0)
    _, s, Vt = np.linalg.svd(X - mean, full_matrices=False)
    eigen = s * s / len(X)
    errors = []
    for k in range(7):
        B = Vt[:k].T
        train_rest = (X - mean) @ B @ B.T + mean
        test_rest = (test - mean) @ B @ B.T + mean
        errors.append(
            [
                np.mean(np.sum((X - train_rest) ** 2, axis=1)),
                np.mean(np.sum((test - test_rest) ** 2, axis=1)),
                np.mean(np.sum((test_clean - test_rest) ** 2, axis=1)),
            ]
        )
    scaled = X * np.array([1, 1, 20, 1, 1, 1])
    sd = scaled.std(0)
    _, sr, Vr = np.linalg.svd(scaled - scaled.mean(0), full_matrices=False)
    _, ss, Vs = np.linalg.svd((scaled - scaled.mean(0)) / sd, full_matrices=False)
    # 정확한 반례: 큰 분산 x1과 라벨이 독립, 작은 분산 x2가 라벨을 결정.
    base = np.linspace(-8, 8, 100)
    label = np.tile([-1, 1], 100)
    counter = np.c_[np.repeat(base, 2), 0.2 * label]
    _, sc, Vc = np.linalg.svd(counter - counter.mean(0), full_matrices=False)
    projected = counter @ Vc[:1].T @ Vc[:1]
    return dict(
        X=X,
        eigen=eigen,
        errors=np.array(errors),
        loadings=np.vstack([Vr[0] ** 2, Vs[0] ** 2]),
        counter=counter,
        label=label,
        projected=projected,
        summary=dict(
            eigen=eigen.tolist(),
            errors=np.array(errors).tolist(),
            best_clean_k=int(np.argmin(np.array(errors)[:, 2])),
            raw_loading=(Vr[0] ** 2).tolist(),
            standard_loading=(Vs[0] ** 2).tolist(),
            counter_preserved=float(sc[0] ** 2 / np.sum(sc * sc)),
            counter_accuracy_full=float(np.mean((counter[:, 1] > 0) == (label > 0))),
            counter_accuracy_pc1=0.5,
        ),
    )


def logsumexp(a, axis=1):
    top = np.max(a, axis=axis, keepdims=True)
    return np.squeeze(top + np.log(np.exp(a - top).sum(axis=axis, keepdims=True)), axis=axis)


def gmm_logp(X, weights, means, covs):
    columns = []
    for weight, mu, cov in zip(weights, means, covs):
        delta = X - mu
        columns.append(
            np.log(weight)
            - np.log(2 * np.pi)
            - np.linalg.slogdet(cov)[1] / 2
            - np.sum(delta * np.linalg.solve(cov, delta.T).T, axis=1) / 2
        )
    return np.array(columns).T


def fit_gmm(X, k, seed, steps=100):
    rng = np.random.default_rng(seed)
    means = X[rng.choice(len(X), k, replace=False)].copy()
    covs = np.repeat(np.cov(X.T, bias=True)[None, :, :], k, axis=0)
    weights = np.ones(k) / k
    history = []
    for step in range(steps + 1):
        logp = gmm_logp(X, weights, means, covs)
        norm = logsumexp(logp)
        history.append(float(norm.sum()))
        r = np.exp(logp - norm[:, None])
        if step == steps:
            break
        counts = r.sum(0)
        weights = counts / len(X)
        means = (r.T @ X) / counts[:, None]
        covs = np.array(
            [
                ((X - mu).T * column) @ (X - mu) / count + np.eye(2) * 1e-6
                for mu, column, count in zip(means, r.T, counts)
            ]
        )
    return dict(weights=weights, means=means, covs=covs, r=r, history=np.array(history))


def mixture_experiment():
    rng = np.random.default_rng(2606)
    means = np.array([[-1.2, 0], [1.1, 0.7], [0.3, -0.9]])
    maps = np.array([[[0.7, 0], [0.35, 0.55]], [[0.7, 0], [-0.2, 0.5]], [[0.45, 0], [0, 0.6]]])

    def sample(n):
        group = rng.choice(3, n, p=[0.4, 0.35, 0.25])
        return means[group] + np.einsum('nij,nj->ni', maps[group], rng.normal(size=(n, 2)))

    X = sample(210)
    valid = sample(400)
    models = []
    rows = []
    starts = []
    for k in range(1, 6):
        attempts = [fit_gmm(X, k, seed) for seed in [3, 11, 29, 47]]
        model = max(attempts, key=lambda m: m['history'][-1])
        models.append(model)
        ll = model['history'][-1]
        parameters = 6 * k - 1
        val = logsumexp(gmm_logp(valid, model['weights'], model['means'], model['covs'])).mean()
        rows.append([k, ll, -2 * ll + parameters * np.log(len(X)), val])
        if k == 3:
            starts = attempts
    best = models[2]
    entropy = -np.sum(best['r'] * np.log(np.maximum(best['r'], 1e-300)), axis=1) / np.log(3)
    sigma = np.logspace(-5, 0, 100)
    peak = 1 / (2 * np.pi * sigma * sigma)
    return dict(
        X=X,
        model=best,
        rows=np.array(rows),
        starts=[a['history'] for a in starts],
        entropy=entropy,
        sigma=sigma,
        peak=peak,
        summary=dict(
            selection=rows,
            bic_k=int(np.argmin(np.array(rows)[:, 2]) + 1),
            valid_k=int(np.argmax(np.array(rows)[:, 3]) + 1),
            initial_ll=[float(a['history'][-1]) for a in starts],
            ambiguous=int(np.sum(best['r'].max(1) < 0.7)),
            min_cov_eigen=float(np.linalg.eigvalsh(best['covs']).min()),
            minimum_ll_step=float(min(np.diff(a['history']).min() for a in starts)),
        ),
    )


def fit_svm(X, y, C=1.0, steps=20000):
    # 두 변수의 쌍대 좌표 갱신을 벡터화. beta = alpha * y.
    n = len(y)
    beta = np.zeros(n)
    low = np.where(y > 0, 0, -C)
    high = np.where(y > 0, C, 0)
    K = X @ X.T
    curvature = np.maximum(np.diag(K)[:, None] + np.diag(K)[None, :] - 2 * K, 1e-15)
    for _ in range(steps):
        gradient = y - K @ beta
        lo = np.maximum(low[:, None] - beta[:, None], beta[None, :] - high[None, :])
        hi = np.minimum(high[:, None] - beta[:, None], beta[None, :] - low[None, :])
        slope = gradient[:, None] - gradient[None, :]
        delta = np.clip(slope / curvature, lo, hi)
        gains = slope * delta - 0.5 * curvature * delta * delta
        np.fill_diagonal(gains, 0)
        i, j = np.unravel_index(gains.argmax(), gains.shape)
        if gains[i, j] < 1e-13:
            break
        beta[i] += delta[i, j]
        beta[j] -= delta[i, j]
    w = beta @ X
    alpha = beta * y
    free = (alpha > 1e-6) & (alpha < C - 1e-6)
    if np.any(free):
        b = float(np.mean(y[free] - X[free] @ w))
    else:
        scores = y - X @ w
        lower = ((y > 0) & (alpha < C - 1e-7)) | ((y < 0) & (alpha > 1e-7))
        upper = ((y > 0) & (alpha > 1e-7)) | ((y < 0) & (alpha < C - 1e-7))
        b = float((scores[lower].max() + scores[upper].min()) / 2)
    margins = y * (X @ w + b)
    primal = 0.5 * (w @ w) + C * np.maximum(0, 1 - margins).sum()
    dual = alpha.sum() - 0.5 * (w @ w)
    return dict(
        w=w,
        b=b,
        alpha=alpha,
        C=C,
        margins=margins,
        primal=float(primal),
        dual=float(dual),
        relative_gap=float((primal - dual) / max(1, primal)),
    )


def svm_experiment():
    rng = np.random.default_rng(2707)

    def sample(n):
        y = np.tile([-1.0, 1.0], n // 2)
        return np.c_[y + rng.normal(0, 0.6, n), 0.4 * y + rng.normal(0, 0.7, n)], y

    X, y = sample(36)
    valid, vy = sample(400)
    X = np.vstack([X, [-2.2, -1.2]])
    y = np.r_[y, 1.0]
    mu = X.mean(0)
    sd = X.std(0)
    Z = (X - mu) / sd
    models = [fit_svm(Z, y, C) for C in [0.03, 0.3, 3]]
    rows = []
    for m in models:
        rows.append(
            [
                m['C'],
                np.mean((Z @ m['w'] + m['b'] >= 0) == (y > 0)),
                np.mean(((valid - mu) / sd @ m['w'] + m['b'] >= 0) == (vy > 0)),
                np.sum(m['alpha'] > 1e-6),
                m['relative_gap'],
            ]
        )
    hinge_grid = np.linspace(-1.5, 2.5, 200)
    base = np.array([[-1, -1], [-1, 1], [1, -1], [1, 1]], dtype=float)
    xy = np.repeat(base, 18, axis=0) + rng.normal(0, 0.16, (72, 2))
    labels = np.repeat([1.0, -1, -1, 1], 18)
    transformed = np.c_[xy, xy[:, 0] * xy[:, 1]]
    linear = fit_svm(xy, labels, 1)
    nonlinear = fit_svm(transformed, labels, 1)
    return dict(
        X=X,
        y=y,
        mu=mu,
        sd=sd,
        models=models,
        rows=np.array(rows),
        hinge_grid=hinge_grid,
        xy=xy,
        labels=labels,
        linear=linear,
        nonlinear=nonlinear,
        summary=dict(
            comparison=np.array(rows).tolist(),
            xor_linear=float(np.mean((xy @ linear['w'] + linear['b'] >= 0) == (labels > 0))),
            xor_feature=float(
                np.mean((transformed @ nonlinear['w'] + nonlinear['b'] >= 0) == (labels > 0))
            ),
            xor_gap=[linear['relative_gap'], nonlinear['relative_gap']],
            free_support=int(
                np.sum((models[1]['alpha'] > 1e-6) & (models[1]['alpha'] < 0.3 - 1e-6))
            ),
            bounded_support=int(np.sum(models[1]['alpha'] >= 0.3 - 1e-6)),
        ),
    )


EXPERIMENTS = [
    data_experiment,
    regression_experiment,
    optimization_experiment,
    probability_experiment,
    pca_experiment,
    mixture_experiment,
    svm_experiment,
]

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chapter', type=int, choices=range(1, 8))
    parser.add_argument('--output-json', type=Path)
    args = parser.parse_args()
    results = {
        str(i): fn()['summary'] for i, fn in enumerate(EXPERIMENTS, 1) if args.chapter in (None, i)
    }
    text = json.dumps(results, ensure_ascii=False, indent=2)
    if args.output_json:
        args.output_json.write_text(text + '\n', encoding='utf-8')
    else:
        print(text)
