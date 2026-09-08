[Main edition docs](../../docs/curriculum-map.md) | [Korean edition docs](curriculum-map.md) | [Japanese edition docs](../../ja/docs/curriculum-map.md)

# HD2Lab Curriculum Map

Foundation and advanced content was implemented, verified, and packaged on 2026-09-08. Each chapter contains six foundation sections and three advanced sections, experimental conditions, worked calculations, and comprehension checks. Prose lives in `tools/content.py`, `tools/content_more.py`, and `tools/content_advanced.py`; generating formulas and input ranges are maintained in the lab HTML and `tools/render_site.py`.

## Learning path

Data representation → Regression → Optimization → Probabilistic inference → Compression → Clustering → Classification.

Each chapter introduces the mathematics it needs and links to supplementary derivations in the appendix. Observations are based on actual calculations and are not claims about production performance.

| Chapter / implementation file | Learning objectives and foundations | Implemented examples and experiments | Validation criteria |
| --- | --- | --- | --- |
| 01 `chapters/01-data-and-models.html` | Represent observations as matrices; distinguish models, parameters, loss, and generalization; introduce supervised, unsupervised, and reinforcement learning | Synthetic bicycle rentals: time, weather, and rental counts; compare valid inputs with target leakage | Array dimensions, feature meanings, and separation of training and evaluation |
| 02 `chapters/02-linear-regression.html` | Linear systems, rank, linear combinations, bases, least squares, and polynomial bases | Synthetic storage load and latency; compare low/high degree curves and predictions outside the data range | Reference least-squares solutions, separate training/validation errors, and label extrapolation |
| 03 `chapters/03-optimization.html` | Partial derivatives, gradients, chain rule, Jacobian, gradient descent, and SGD | Learning rates and preconditioning on a quadratic loss with different axis scales | Known minima, finite-difference gradient checks, and divergence detection |
| 04 `chapters/04-probability-and-inference.html` | Random variables, distributions, densities, conditional probability, Bayes, Gaussian models, MLE, MAP, and L2 regularization | Prior strength and estimation from a small synthetic arrival-time sample | Posterior normalization, MLE/MAP conditions, and regularization coefficient derivation |
| 05 `chapters/05-pca-and-svd.html` | Inner products, norms, orthogonality, projection, eigendecomposition, SVD, low-rank approximation, and PCA | Generate multichannel environmental signals from latent factors; compare compression, reconstruction, and noise | Centering/scaling, full-component reconstruction, and error versus discarded eigenvalue sum |
| 06 `chapters/06-gmm-and-em.html` | Mixture densities, latent variables, responsibilities, and E/M steps | Overlapping elliptical distributions of synthetic request size and processing time; compare initializations | Mixing weights and responsibilities sum to one; likelihood changes, numerical stability, and initialization sensitivity |
| 07 `chapters/07-svm.html` | Hyperplanes, normals, distances, margins, constrained optimization, and Lagrange multipliers | Classify synthetic message features; vary overlap, outliers, and feature scales | Decision scores versus distances, margin assumptions, and reference predictions |

## Labs

| Implementation file | Controls | Results | Calculation method |
| --- | --- | --- | --- |
| `labs/regression.html` | Degree, sample count, noise, regularization strength | Prediction curves, residuals, training/validation errors | Stable least squares for small matrices without explicitly forming an inverse |
| `labs/gradient-descent.html` | Learning rate, starting point, axis scale | Trajectory, loss, convergence status | Browser iterations |
| `labs/pca.html` | Signal correlation, noise, component count | Projection, reconstruction, explained variance, error | Small-matrix calculations; distinguish signal reconstruction from geometry |
| `labs/svm.html` | C, overlap, outliers, feature scale, standardization, seed | Boundaries, margins, support vectors, accuracy, confusion matrix, convergence | Two-coordinate updates of the linear SVM dual that preserve constraints |
| `labs/clustering.html` | Initialization, component count, iteration count | Distance-2 ellipses per component, membership probabilities, log-likelihood | Stabilized EM with iteration limits and stopping conditions |

Every experiment provides a reproducible seed and a reset button. Numerical code uses no external browser libraries. Generating equations appear in each lab. Final evaluation data is not reused for slider selection.

## Mathematics appendix

- Linear algebra: row operations, elimination, linear independence, span, bases, rank, linear maps, and coordinate representations.
- Geometry: L1/L2 norms, inner products, angles, distances, orthogonal bases/complements, and orthogonal projection.
- Matrix decomposition: determinants, trace, eigenvalues/eigenvectors, diagonalization conditions, Cholesky decomposition, SVD, and low-rank approximation.
- Differentiation: partial derivatives, gradients, chain rule, Jacobian, and a neural-network backpropagation example.
- Probability: probability spaces, discrete/continuous distributions, PDF/CDF, sum/product rules, Bayes, and Gaussian distributions.
- Optimization: stationary points and minima, learning rates, SGD, constrained optimization, Lagrange multipliers, and a small linear-programming example.

## Finalized implementation specifications

- Regression: x ~ U(0,1), y=3+2x+7x³+noise. Seeds 1729/1730; 12–100 training observations and 120 validation observations. Shifted polynomial basis, degree 1–9, α 0–5, unpenalized intercept, Householder QR.
- Gradient descent: J=(u²+κv²)/2, κ 1–12, η .01–.6, iteration limit 5–100. Adjustable starting point, optional diagonal preconditioning, convergence/divergence stopping conditions.
- PCA: 180 observations across six channels from two latent factors. Seed 431; correlation 0–.95; noise 0–1. Covariance denominator N, Jacobi eigendecomposition, 1–6 components. Report within-sample reconstruction error.
- GMM: 240 observations from overlapping elliptical distributions with proportions .45/.35/.20; data seed 812. Full-covariance EM, K 1–4, initialization seed 1–60, 0–60 updates. Log-sum-exp and covariance diagonal stabilization.
- SVM: margin and dual derivations, an exact four-point linear separation example, and NumPy primal/dual objective comparisons. The lab exposes C, overlap, outliers, scale, standardization, and seed, and reports boundaries, support vectors, validation confusion matrices, and convergence certificates.
- Equations: HTML superscripts/subscripts and Unicode; no additional library or CDN.
- Code: Python examples for all seven chapters in `.py` and `.ipynb`. Python and browser random generators differ; independent numerical comparisons use browser arrays.

## Page sections and connections

| Chapter | Section sequence | Connections |
| --- | --- | --- |
| 01 | Prediction time → Vectors → Models → Loss → Evaluation → Comprehension checks | 02, mathematics appendix |
| 02 | Latency example → Least squares → Derivation/projection → Bases → Regularization → Experiment | Regression lab, 03 |
| 03 | Valleys → Gradients → Chain rule → Learning rate → Preconditioning/SGD → Validation | Gradient descent lab, 04 |
| 04 | Variation → Probability/density → Bayes → MLE → MAP → Regularization | 05, probability appendix |
| 05 | Sensors → Projection → Eigenvalues → Reconstruction error → SVD → Compression/noise | PCA lab, 06 |
| 06 | Requests → Density → Responsibilities → EM → Likelihood → Implementation/observations | GMM lab, 07 |
| 07 | Boundaries → Distance → Hard margin → Soft margin → Dual → Kernels | SVM lab, mathematics appendix |

Content pages provide static previous/next links, a collapsible table of contents, and printing. The main page presents the introduction, learning path, labs, and reading instructions in that order.

## Advanced expansion — 21 cases and 28 figures

| Chapter | Advanced cases A / B / C | Four new figures | Reproduction function |
| --- | --- | --- | --- |
| 01 | Cyclical features and time shifts / Target leakage / Imbalance costs | Time representation, temporal split, leakage error, threshold/cost | data_experiment |
| 02 | SVD and coefficient sensitivity / Degree × α selection / Bootstrap and prediction intervals | Ridge paths/perturbations, validation heatmap, extrapolation curves, uncertainty bands | regression_experiment |
| 03 | Rotated curvature, momentum, Newton / Logistic finite differences / SGD stationary variance | Trajectories, loss convergence, finite-difference error, batch noise floors | optimization_experiment |
| 04 | Sequential Beta updates / Base rates and asymmetric costs / Posterior prediction | Beta densities, base rate/PPV, mean/observation SD, expected loss | probability_experiment |
| 05 | Independent signal reconstruction / Scales and loadings / Loss of label information | Eigenvalues/cumulative variance, three reconstruction errors, loading comparison, PCA classification counterexample | pca_experiment |
| 06 | Multiple initializations and K / Responsibility entropy / Covariance collapse | EM paths, BIC/validation density, memberships/entropy, collapse density | mixture_experiment |
| 07 | Outliers and C / KKT and dual certificates / XOR product features | Three boundaries, accuracy, hinge/α, nonlinear feature boundary | svm_experiment |

Functions are in `downloads/advanced-experiments.py`; figures are generated by `downloads/advanced-figures.py`. Foundation and advanced examples use their own formulas and conditions. Each advanced chapter links to the complete notebook, calculation code, figure code, and numerical JSON.

## Languages, themes, and documentation (2026-09-08)

English is the default website language. Korean and Japanese use the same page structure under `ko/` and `ja/`. Header switching preserves the page and section; the default entry restores the selected language. The first visit follows the system theme, and manual light/dark preferences are remembered.

The Web-HQ project card opens the learning site, and each learning page links back to Web-HQ. Content and ordinary links work without JavaScript; lab controls and theme switching use JavaScript.

Run `python3 MLStudy/tools/render_site.py` from the repository root. Source IDs are in `i18n/strings.json`, translation data in `i18n/translations.json`, and reviewed overrides in `i18n/translations.tsv`. Missing translations fail generation. Translations combine offline model drafts and manually written text; further linguistic review is possible. Equations and executable code are preserved.

All Markdown documents, including sources and edition copies, are maintained in English. Historical validation records and screenshots describe the earlier Korean/light edition. See [languages and current validation](localization.md) for the subsequent multilingual/theme checks.
