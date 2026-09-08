#!/usr/bin/env python3
"""HD2Lab 심화 그림 재생성. NumPy, Matplotlib 필요.
advanced-experiments.py와 같은 폴더에 두고 실행:
python advanced-figures.py --output ./hd2lab-figures
"""

from pathlib import Path
import argparse
import json
import runpy
import numpy as np
import matplotlib

matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Ellipse
from cycler import cycler

COLORS = ['#106858', '#b65c27', '#7460a8', '#287caa']
plt.rcParams.update(
    {
        'font.family': ['DejaVu Sans', 'Arial', 'sans-serif'],
        'font.size': 11,
        'axes.spines.top': False,
        'axes.spines.right': False,
        'axes.labelcolor': '#18312e',
        'text.color': '#18312e',
        'xtick.color': '#526964',
        'ytick.color': '#526964',
        'axes.prop_cycle': cycler(color=COLORS),
        'axes.titleweight': 'bold',
        'axes.grid': True,
        'grid.alpha': 0.16,
        'axes.axisbelow': True,
        'legend.frameon': False,
        'legend.fontsize': 9,
        'svg.fonttype': 'none',
        'svg.hashsalt': 'hd2lab-advanced-2026',
        'savefig.facecolor': 'white',
    }
)


def frame(title, panels=1):
    fig, axes = plt.subplots(1, panels, figsize=(9.4, 4.5), layout='constrained', squeeze=False)
    fig.suptitle(title, fontsize=14, x=0.04, ha='left')
    return fig, axes[0]


def finish(ax, xlabel, ylabel):
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)


def classes(ax, X, y):
    for label, marker, color in [(-1, 'o', COLORS[0]), (1, 's', COLORS[1])]:
        ax.scatter(
            *X[y == label].T, c=color, marker=marker, s=24, alpha=0.75, label=f'y = {label:+}'
        )


def draw_chapter(ch, d):
    out = []

    def add(key, title, panels=1):
        f, a = frame(f'HD2LAB / {ch:02}     ' + title, panels)
        out.append((f'{ch:02}-{key}', f))
        return a

    if ch == 1:
        (a,) = add('cycle', 'A clock needs a circular representation')
        t = np.arange(24)
        a.plot(t, 30 + 8 * np.sin(2 * np.pi * t / 24), 'o-', label='Generating mean')
        order = np.argsort(d['hour'][:24])
        a.plot(t, d['linear'][:24][order], 's--', label='Raw hour feature')
        a.plot(t, d['cycle'][:24][order], 'x:', label='sin / cos features')
        finish(a, 'Hour of day (h)', 'Synthetic demand (count)')
        a.legend()
        (a,) = add('drift', 'Past performance does not remove future drift')
        a.axvspan(0, 119, color=COLORS[0], alpha=0.06, label='Train: 0–119')
        a.axvspan(120, 159, color=COLORS[1], alpha=0.09, label='Validation: 120–159')
        a.axvspan(160, 199, color=COLORS[2], alpha=0.09, label='Test: 160–199')
        a.plot(d['t'], d['y'], '.', ms=4, color='#526964', label='Observation')
        a.plot(d['t'], d['cycle'], '-', label='Frozen model')
        a.axvline(140, color=COLORS[1], ls='--', label='Shift: +6')
        finish(a, 'Time step (h)', 'Synthetic demand (count)')
        a.legend(ncol=3, fontsize=8)
        (a,) = add('leakage', 'A suspiciously low error can be an invalid evaluation')
        vals = [
            d['summary'][k] for k in ['random_valid', 'cycle_valid', 'cycle_test', 'leaked_valid']
        ]
        bars = a.bar(
            ['Shuffled validation', 'Future validation', 'Future test', 'Target leaked'],
            vals,
            color=[*COLORS[:3], '#abb6b1'],
        )
        a.bar_label(bars, labels=[f'{v:.4f}' for v in vals], padding=4)
        a.set_ylim(0, max(vals) * 1.22)
        finish(a, 'Evaluation protocol (different held-out periods)', 'MSE (count²)')
        a, b = add('threshold', 'A higher accuracy can hide a higher decision cost', 2)
        r = d['thresholds']
        a.plot(r[:, 0], r[:, 5], label='Precision')
        a.plot(r[:, 0], r[:, 6], '--', label='Recall')
        a.plot(r[:, 0], r[:, 7], ':', label='Accuracy')
        finish(a, 'Score threshold (unitless)', 'Fraction')
        a.legend()
        b.plot(r[:, 0], r[:, 8], label='25 × FN + FP')
        b.axvline(
            d['summary']['best_threshold'],
            ls='--',
            color=COLORS[1],
            label='Best on this validation set',
        )
        finish(b, 'Score threshold (unitless)', 'Total cost (cost units)')
        b.legend()
    elif ch == 2:
        a, b = add('ridge', 'Near-collinearity makes individual coefficients unstable', 2)
        a.semilogx(d['alphas'], d['path'][:, 1], label='w1')
        a.semilogx(d['alphas'], d['path'][:, 2], '--', label='w2')
        a.semilogx(d['alphas'], d['path'][:, 1:].sum(1), ':', label='w1 + w2')
        finish(a, 'Ridge alpha (sum-loss convention)', 'Coefficient (unitless)')
        a.legend()
        b.scatter(
            d['perturb'][:, 0, 1],
            d['perturb'][:, 0, 2],
            s=13,
            alpha=0.5,
            label='OLS, 120 perturbations',
        )
        b.scatter(d['perturb'][:, 1, 1], d['perturb'][:, 1, 2], marker='x', label='Ridge alpha = 1')
        finish(b, 'w1 (unitless)', 'w2 (unitless)')
        b.legend()
        (a,) = add('selection', 'Choose degree and regularization together')
        im = a.imshow(np.log10(d['errors']), aspect='auto', origin='lower', cmap='YlGnBu')
        a.grid(False)
        a.set_xticks(range(6), [f'{v:g}' for v in d['grid_alpha']])
        a.set_yticks(range(9), d['degrees'])
        for i in range(9):
            for j in range(6):
                a.text(
                    j,
                    i,
                    f'{d["errors"][i, j]:.2f}',
                    ha='center',
                    va='center',
                    fontsize=9,
                    color='white' if np.log10(d['errors'][i, j]) > 0.3 else '#18312e',
                )
        a.figure.colorbar(im, ax=a, label='log10(validation MSE)')
        finish(a, 'Ridge alpha', 'Polynomial degree')
        (a,) = add('curves', 'Similar training fits can imply different extrapolations')
        a.scatter(d['xp'], d['yp'], s=20, c='#526964', label='Train: N = 30')
        a.plot(d['grid'], d['truth'], color='black', ls=':', label='Generating function')
        for (key, v), style in zip(d['fits'].items(), ['-', '--', '-.']):
            a.plot(d['grid'], v, style, label=f'Degree {key}, alpha = 0')
        a.axvspan(-1.35, -1, color='#bbb', alpha=0.25)
        a.axvspan(1, 1.35, color='#bbb', alpha=0.25)
        a.set_ylim(-8, 7)
        finish(
            a,
            'Input x (unitless); shaded = outside training domain',
            'Response (unitless; view clipped to −8 … 7)',
        )
        a.legend(ncol=2)
        (a,) = add('bootstrap', 'Uncertainty in the mean is not uncertainty in a new observation')
        a.fill_between(
            d['grid'],
            *d['predict_band'],
            color=COLORS[1],
            alpha=0.18,
            label='95% predictive simulation interval',
        )
        a.fill_between(
            d['grid'],
            *d['mean_band'],
            color=COLORS[0],
            alpha=0.25,
            label='95% bootstrap mean interval',
        )
        a.plot(d['grid'], d['center'], label='Selected model')
        a.scatter(d['xp'], d['yp'], s=12, c='#526964', label='Train observations')
        a.axvline(-1, color='#777', ls=':')
        a.axvline(1, color='#777', ls=':')
        finish(a, 'Input x (unitless)', 'Response (unitless)')
        a.legend(fontsize=8)
    elif ch == 3:
        (a,) = add('paths', 'Rotating the valley couples the coordinates')
        u, v = np.meshgrid(np.linspace(-3.5, 3.5, 180), np.linspace(-3, 3, 180))
        Z = np.stack([u, v], axis=-1)
        loss = np.einsum('...i,ij,...j->...', Z, d['H'], Z) / 2
        a.contour(u, v, loss, levels=[0.3, 1, 4, 16, 64, 180], colors='#bac9bf', linewidths=0.8)
        for (k, path), sty in zip(d['paths'].items(), ['o-', 's--', 'x:']):
            a.plot(*path[:25].T, sty, ms=3, label=k)
        finish(a, 'w1 (unitless)', 'w2 (unitless)')
        a.legend()
        a.set_aspect('equal', adjustable='box')
        (a,) = add('convergence', 'Compare progress at the same iteration budget')
        for (k, l), sty in zip(d['losses'].items(), ['-', '--', ':']):
            a.semilogy(np.maximum(l, 1e-16), sty, label=k)
        finish(a, 'Update count', 'J(w), logarithmic; display floor = 1e−16')
        a.legend()
        (a,) = add('gradient', 'Central differences have truncation and round-off error')
        a.loglog(d['epsilons'], d['errors'], 'o-', ms=4, label='Max absolute gradient discrepancy')
        finish(a, 'Finite difference step h (unitless)', 'Absolute gradient error (unitless)')
        a.legend()
        (a,) = add('noise', 'A fixed learning rate leaves a stochastic noise floor')
        for (batch, trace), sty, color in zip(d['noise'].items(), ['-', '--', '-.'], COLORS):
            a.semilogy(trace, sty, color=color, label=f'Batch {batch}: 2,048-run mean')
            a.axhline(d['floors'][batch], color=color, ls=':', lw=1)
        finish(a, 'SGD update count', 'Mean loss; dotted lines = stationary expectation')
        a.legend()
    elif ch == 4:
        (a,) = add('posterior', 'Sequential evidence changes a distribution, not just a point')
        for (ab, pdf), sty, label in zip(
            zip(d['parameters'], d['densities']),
            [':', '--', '-'],
            ['Prior', 'After 20 trials', 'After 100 trials'],
        ):
            a.plot(d['p'], pdf, sty, label=f'{label}: Beta{ab}')
        a.set_xlim(0, 0.4)
        finish(a, 'Failure probability p (unitless)', 'Probability density (per unit p)')
        a.legend()
        (a,) = add('base-rate', 'Sensitivity alone does not determine a positive result')
        a.plot(d['prevalence'] * 100, d['ppv'] * 100, label='Sensitivity = 90%, specificity = 96%')
        a.scatter(
            [2],
            [d['summary']['ppv_at_2percent'] * 100],
            c=COLORS[1],
            s=50,
            label='Prevalence 2%: PPV 31.5%',
        )
        finish(a, 'Failure prevalence (%)', 'P(failure | alert) (%)')
        a.legend()
        (a,) = add('predictive', 'More observations reduce parameter uncertainty, not sensor noise')
        a.semilogx(d['n'], np.sqrt(d['variance']), 'o-', label='Posterior SD of mean')
        a.semilogx(d['n'], np.sqrt(4 + d['variance']), 's--', label='Posterior predictive SD')
        a.axhline(2, ls=':', color='#777', label='Known observation noise SD = 2 s')
        finish(a, 'Observation count N (log scale)', 'Standard deviation (s)')
        a.legend()
        (a,) = add('decision', 'Act when expected loss, not probability alone, favors action')
        a.plot(d['q'], d['loss_action'], label='Action: 1 × (1 − q)')
        a.plot(d['q'], d['loss_ignore'], '--', label='Ignore: 25 × q')
        a.axvline(1 / 26, ls=':', color='#777', label='Decision threshold = 1/26')
        a.set_xlim(0, 0.2)
        a.set_ylim(0, 5)
        finish(
            a,
            'Calibrated failure probability q (unitless)',
            'Expected loss per decision (cost units)',
        )
        a.legend()
    elif ch == 5:
        a, b = add('spectrum', 'The spectrum measures training variance', 2)
        eigen = d['eigen']
        a.bar(np.arange(1, 7), eigen, color=COLORS[0])
        finish(a, 'Principal component index', 'Eigenvalue (unitless²)')
        b.plot(np.arange(1, 7), np.cumsum(eigen) / eigen.sum() * 100, 'o-')
        b.axhline(90, color=COLORS[1], ls='--', label='90% reference')
        finish(b, 'Retained components k', 'Training variance retained (%)')
        b.legend()
        (a,) = add(
            'reconstruction', 'Reconstructing noise is different from recovering a clean signal'
        )
        for i, label, sty in zip(
            range(3),
            ['Train → noisy train', 'Held-out → noisy held-out', 'Held-out → clean signal'],
            ['-', '--', '-.'],
        ):
            a.plot(range(7), d['errors'][:, i], sty, marker='o', ms=4, label=label)
        finish(
            a,
            'Retained components k (0 = training mean only)',
            'Mean squared norm of residual (unitless²)',
        )
        a.legend()
        (a,) = add('scaling', 'A change of units can dominate an unscaled PCA')
        index = np.arange(1, 7)
        a.bar(index - 0.18, d['loadings'][0], width=0.36, label='Raw: channel 3 multiplied by 20')
        a.bar(
            index + 0.18,
            d['loadings'][1],
            width=0.36,
            label='Standardized by training SD',
            hatch='//',
            alpha=0.7,
        )
        finish(a, 'Channel index', 'Squared loading in the corresponding fitted space')
        a.legend()
        a, b = add(
            'counterexample', '99.8% preserved variance can retain zero label information', 2
        )
        classes(a, d['counter'], d['label'])
        a.set_ylim(-0.35, 0.35)
        finish(a, 'High-variance x1 (unitless)', 'Low-variance x2 (unitless)')
        a.legend()
        for label, marker, dy in [(-1, 'o', -0.015), (1, 's', 0.015)]:
            ids = d['label'] == label
            b.scatter(
                d['projected'][ids, 0],
                d['projected'][ids, 1] + dy,
                marker=marker,
                s=16,
                label=f'y={label:+}; visual offset {dy:+}',
            )
        b.axhline(0, color='#777', ls=':')
        b.set_ylim(-0.35, 0.35)
        finish(b, 'PC1 reconstruction x1 (unitless)', 'Reconstruction x2 (visual offsets only)')
        b.legend(fontsize=8)
    elif ch == 6:
        (a,) = add('initialization', 'EM can settle at different local solutions')
        for trace, seed, style in zip(d['starts'], [3, 11, 29, 47], ['-', '--', ':', '-.']):
            a.plot(trace, style, label=f'Initialization seed {seed}')
        finish(a, 'EM update count', 'Training log-likelihood (natural log)')
        a.legend()
        a, b = add(
            'model-selection', 'Training fit rewards complexity; model selection also prices it', 2
        )
        r = d['rows']
        a.plot(r[:, 0], r[:, 2], 'o-', label='BIC: lower is better')
        finish(a, 'Component count K', 'BIC (unitless)')
        a.set_xticks(range(1, 6))
        a.legend()
        b.plot(r[:, 0], r[:, 3], 's--', label='Validation: higher is better')
        finish(b, 'Component count K', 'Mean validation log-density')
        b.set_xticks(range(1, 6))
        b.legend()
        a, b = add('responsibility', 'A hard assignment discards uncertainty', 2)
        X = d['X']
        m = d['model']
        groups = m['r'].argmax(1)
        for k, marker in enumerate(['o', 's', '^']):
            a.scatter(*X[groups == k].T, s=17, marker=marker, label=f'Component {k + 1}')
        for mu, cov in zip(m['means'], m['covs']):
            eig, V = np.linalg.eigh(cov)
            angle = np.degrees(np.arctan2(V[1, -1], V[0, -1]))
            a.add_patch(
                Ellipse(
                    mu,
                    4 * np.sqrt(eig[-1]),
                    4 * np.sqrt(eig[0]),
                    angle=angle,
                    fill=False,
                    lw=1.3,
                    edgecolor='#18312e',
                )
            )
        a.legend(fontsize=8)
        finish(a, 'Feature 1 (unitless)', 'Feature 2 (unitless)')
        im = b.scatter(*X.T, c=d['entropy'], s=20, cmap='YlOrBr', vmin=0, vmax=1)
        b.figure.colorbar(im, ax=b, label='Entropy / log(3)')
        finish(b, 'Feature 1 (unitless)', 'Feature 2 (unitless)')
        (a,) = add('collapse', 'An unbounded density is not a useful cluster')
        a.loglog(d['sigma'], d['peak'], label='2D peak density = 1 / (2πσ²)')
        a.axvline(0.001, color=COLORS[1], ls='--', label='Covariance floor ε = 1e−6 → σ = 1e−3')
        finish(
            a,
            'Isotropic standard deviation σ (unitless)',
            'Density at component mean (per area unit)',
        )
        a.legend()
    elif ch == 7:
        axes = add('boundaries', 'C changes the margin and the cost of an outlier', 3)
        grid = np.linspace(-3, 3, 100)
        for a, m in zip(axes, d['models']):
            classes(a, d['X'], d['y'])
            w = m['w'] / d['sd']
            b = m['b'] - w @ d['mu']
            u, v = np.meshgrid(grid, grid)
            cs = a.contour(
                u,
                v,
                w[0] * u + w[1] * v + b,
                levels=[-1, 0, 1],
                colors='#18312e',
                linestyles=['--', '-', '--'],
                linewidths=1,
            )
            sv = m['alpha'] > 1e-6
            a.scatter(*d['X'][sv].T, s=65, facecolors='none', edgecolors='#18312e', lw=0.6)
            a.scatter(*d['X'][-1], s=120, facecolors='none', edgecolors=COLORS[2], lw=2)
            a.set_title(f'C = {m["C"]:g}', fontsize=12)
            finish(a, 'Feature 1 (unitless)', 'Feature 2 (unitless)')
            a.set_xlim(-3, 3)
            a.set_ylim(-3, 3)
        (a,) = add('cost', 'Training accuracy alone does not select C')
        r = d['rows']
        a.semilogx(r[:, 0], r[:, 1] * 100, 'o-', label='Training accuracy (37 points)')
        a.semilogx(r[:, 0], r[:, 2] * 100, 's--', label='Validation accuracy (400 points)')
        a.set_ylim(80, 100)
        finish(a, 'C (log scale)', 'Accuracy (%)')
        a.legend()
        a, b = add('kkt', 'Margin, hinge loss and dual coefficients tell different stories', 2)
        x = d['hinge_grid']
        a.plot(x, np.maximum(0, 1 - x), label='Hinge: max(0, 1 − margin)')
        a.axvline(0, color='#777', ls=':')
        a.axvline(1, color='#777', ls='--')
        finish(a, 'Functional margin y f(x) (unitless)', 'Hinge loss (unitless)')
        a.legend()
        m = d['models'][1]
        groups = [
            m['alpha'] < 1e-6,
            (m['alpha'] >= 1e-6) & (m['alpha'] < m['C'] - 1e-6),
            m['alpha'] >= m['C'] - 1e-6,
        ]
        for ids, marker, label in zip(
            groups, ['o', 's', '^'], ['alpha = 0', '0 < alpha < C', 'alpha = C']
        ):
            b.scatter(m['margins'][ids], m['alpha'][ids], marker=marker, s=35, label=label)
        b.axvline(1, color='#777', ls='--')
        finish(b, 'Functional margin y f(x) (unitless)', 'Dual coefficient alpha')
        b.legend()
        a, b = add('feature-map', 'A nonlinear feature can separate an XOR pattern', 2)
        u, v = np.meshgrid(np.linspace(-1.7, 1.7, 170), np.linspace(-1.7, 1.7, 170))
        for ax, m, nonlinear in [(a, d['linear'], False), (b, d['nonlinear'], True)]:
            scores = m['w'][0] * u + m['w'][1] * v + m['b']
            if nonlinear:
                scores += m['w'][2] * u * v
            ax.contourf(u, v, scores, levels=[-100, 0, 100], colors=['#e0eee6', '#faeadf'])
            ax.contour(u, v, scores, levels=[0], colors='#18312e')
            classes(ax, d['xy'], d['labels'])
            finish(ax, 'x1 (unitless)', 'x2 (unitless)')
            ax.set_title('φ(x) = [x1, x2, x1x2]' if nonlinear else 'φ(x) = [x1, x2]', fontsize=12)
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path('hd2lab-figures'))
    parser.add_argument('--results', type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    engine = runpy.run_path(str(Path(__file__).with_name('advanced-experiments.py')))
    summaries = {}
    for ch, fn in enumerate(engine['EXPERIMENTS'], 1):
        data = fn()
        summaries[str(ch)] = data['summary']
        for name, fig in draw_chapter(ch, data):
            fig.savefig(
                args.output / (name + '.svg'),
                metadata={'Date': None, 'Creator': 'HD2Lab / Matplotlib'},
            )
            plt.close(fig)
    if args.results:
        args.results.write_text(
            json.dumps(summaries, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
        )
    print('Generated 28 SVG figures.')


if __name__ == '__main__':
    main()
