# HD2Lab Progress Record

Last updated: 2026-09-08.

The records below describe the earlier Korean/light edition and its advanced expansion. File counts and environments belong to those historical checks. See [current language and theme validation](localization.md) for the subsequent three-language implementation.

## Completed implementation

P0–P6 and the advanced expansion were completed: 17 HTML pages, five labs, 21 advanced cases, 28 new figures, Python/notebook downloads, a distribution directory, and a ZIP. No external GitHub deployment or push was performed.

| Phase | Status | Outputs |
| --- | --- | --- |
| P0 Guidelines | Complete | Authoring guide, README, curriculum map, progress record |
| P1 Content design | Complete | Seven chapters with six foundation and three advanced sections each; five labs; generating formulas, input ranges, and evaluation criteria |
| P2 Site structure | Complete | HD2Lab main/index, shared CSS, table of contents, previous/next navigation |
| P3 Representative chapter | Complete | Regression explanation, synthetic data, QR, and interactions |
| P4 Complete curriculum | Complete | Seven chapters; mathematics, glossary, and references appendices; Python/notebook examples |
| P5 Lab expansion | Complete | Gradient descent, PCA, GMM, and SVM calculations and SVG plots |
| P6 Deployment checks | Complete | Numerical, interface, accessibility, and path checks; distribution folder and ZIP |
| P7 Advanced expansion | Complete | Three advanced cases and four new SVG figures per chapter; reproduction code, executed notebook, independent checks, and browser validation |

## Key outputs

Paths are relative to the Web-HQ repository root.

- `MLStudy/main.html`: learning archive main page.
- `MLStudy/chapters/`: seven chapters and 63 sections (42 foundation + 21 advanced), equations, examples, and comprehension checks.
- `MLStudy/labs/`: regression, gradient descent, PCA, GMM, and SVM experiments.
- `MLStudy/appendix/`: mathematical derivations, 25 terms and symbols, references, and reproduction information.
- `MLStudy/downloads/`: seven foundation NumPy examples and notebook; advanced calculation code, figure code, numerical JSON, and notebook with saved outputs.
- `MLStudy/assets/images/advanced/`: four comparative figures per chapter, 28 SVGs total.
- `output/hd2lab-site/`: the historical 60-file distribution bundle.
- `output/hd2lab-static.zip`: ZIP distribution with verified integrity.
- `MLStudy/README.md` and `MLStudy/docs/deployment.md`: running, editing, testing, and integration instructions.

The public bundle excludes source PDFs, internal guides, tests, authoring tools, and local screenshots. Relevant official references and reproduction scope appear in the public references appendix.

## Historical validation

### Numerical checks and execution

- `node MLStudy/tests/math.test.js`: passed 226 setting combinations (108 regression, 54 PCA, 64 GMM), totaling 17,840 assertions.
- Regression: analytical least squares, noiseless equations, input/regularization ranges, and finite coefficients/errors.
- Optimization: central-difference gradients, loss reduction for stable steps, oscillation, and convergence with diagonal preconditioning.
- PCA: orthogonal bases, reconstruction error versus discarded eigenvalue sums, and full-component reconstruction.
- GMM: mixing weights and responsibilities sum to one, positive-definite covariances, finite log-likelihood, and monotonicity within numerical tolerance.
- `python3 MLStudy/tests/verify.py`: passed independent NumPy comparisons using the same browser arrays, including six QR/ridge conditions, SVD/PCA, Gaussian log densities, and responsibilities.
- SVM: four-point optimality checked through primal/dual objectives and constraints.
- Downloaded Python examples and all foundation notebook code cells executed successfully.

### Pages and browsers

- Checked internal file links, anchors, duplicate IDs, Korean `lang`, and one `h1` per page across 17 HTML files; checked local Markdown links.
- Chromium: 17 pages at 1440, 390, and 320 px, totaling 51 page/viewport combinations.
- No page-wide horizontal overflow; mobile graphs use their own scroll containers.
- Checked regression degree/reset, gradient descent controls, all PCA components, and GMM iteration/seed/reset behavior.
- Checked keyboard skip navigation, collapsible answers, and the five static lab plots/formulas without JavaScript.
- Zero JavaScript errors and zero HTTP 4xx/5xx failures. Desktop/mobile main and lab screenshots were reviewed.
- Results: [browser-check.json](browser-check.json).

The in-app browser was unavailable because of connection issues. After checking its initialization and troubleshooting instructions, validation used standalone local Playwright/Chromium. Sandbox browser restrictions were resolved through approved extended permissions.

### Distribution

- The historical `package_site.py` allowlist contained 60 files: the existing 28 files, 28 advanced SVGs, and four advanced downloads.
- ZIP integrity and SHA-256 parity between source files, the distribution folder, and ZIP entries passed.
- The bundle entry and labs loaded beneath `/output/hd2lab-site/` over HTTP. All five labs also opened and calculated through `file://`.
- GitHub-hosted deployment and Safari/Firefox validation were not performed.

## Resolved issues

- Small mobile graph labels: added a separate horizontal scroll area, usage guidance, and keyboard focus.
- Skip-navigation focus: added `tabindex=-1` to the content target.
- JavaScript-disabled behavior: controls start disabled and become active after initialization.
- Browser breakpoint assertions: aligned checks with the actual displayed text.

## Resuming work

The seven foundation cases, 21 advanced cases, 28 figures, reproduction code, executed notebook, and distribution bundle were complete at this handoff. Read `harnessguide.md` and this record, then verify the actual files before new work.

- Prose: edit `tools/content.py`, `tools/content_more.py`, or `tools/content_advanced.py`; render, run relevant checks, and package.
- Advanced calculations/figures: use `tools/enrich_site.py` and the canonical download sources; render, run `tests/advanced_verify.py --notebook` and relevant browser checks, then package.
- Layout: edit `assets/css/base.css` or `tools/render_site.py`, validate in browsers, and package.
- Labs: edit canonical scripts in `i18n/source-js/`, render, run numerical/reference/browser checks, and package.
- Integration: follow `docs/deployment.md` for the existing Web-HQ learning subfolder.

Reuse approved reference material. Do not interrupt independent work to request files that are not needed. The current authoring paths and documentation policy are maintained in `harnessguide.md` and `docs/localization.md`.

## SVM lab addition (2026-09-08)

- Added `labs/svm.html` and linked it from the main page and chapter seven; preserved the analytical four-point example.
- Controls: C, overlap, feature scale, standardization, outliers, seed. Results: boundaries, margins, support vectors, training/validation accuracy, confusion matrix, convergence certificate.
- Standardization uses training statistics only. Boundaries are converted back to original coordinates; margin levels refer to training coordinates.
- Checked 216 settings: 210 converged, six correctly marked unconverged; maximum relative primal-dual gap approximately 0.000456. All settings passed finite-value and dual-constraint checks.
- Independent NumPy checks covered four configurations, primal/dual bounds, coefficient constraints, reconstructed w, known optima, coincident points with overlapping classes, and a zero-iteration convergence case.
- The 51 page/viewport combinations passed, along with C, outlier, standardization, scaling, seed, reset, and confusion-matrix interactions.
- Convergence is also shown in the result heading. Objective history records the initial 20 iterations, then every 20 iterations.
- The SVM-stage bundle had 28 files, including `svm-core.js`; advanced expansion later increased it to 60. No browser library dependency was added.

## Advanced expansion (2026-09-08)

- Seven chapters each gained three advanced cases and four SVG figures, producing nine sections per chapter and 63 sections overall.
- Data: cyclical features, future distribution shifts, target leakage, and imbalance costs. Regression: multicollinearity, SVD/ridge, 54 degree × α candidates, bootstrap, and prediction intervals.
- Optimization: rotated curvature, momentum, Newton, logistic finite differences, and SGD noise floors. Probability: sequential Beta updates, base rates, asymmetric costs, and posterior prediction.
- PCA: independent signal reconstruction, unit changes, and a counterexample that loses classification information while preserving 99.8% of variance. GMM: multiple initializations, BIC, validation log density, entropy, and covariance collapse.
- SVM: outliers and C, KKT/dual certificates, and explicit XOR product features. The browser lab remains a linear SVM; the advanced product-feature demonstration is separate.
- Prose uses computed JSON values and specifies principles, assumptions, equations, seeds, units, and data splits. All 21 cases include worked solutions, code excerpts, and comprehension explanations.
- Calculations use NumPy; figure generation uses Matplotlib. HTML reading needs no installation. The advanced notebook contains nine code cells and 28 saved SVG outputs, reproducible by rerunning it.
- Foundation NumPy references, links across 17 pages, and foundation Python/notebook execution passed.
- `python MLStudy/tests/advanced_verify.py --notebook` passed: confusion-matrix recalculation, centered SVD/ridge references, optimization spectra/stationary variance, independent Beta CDF checks, PCA error identities/counterexample, Gaussian densities, BIC, and five advanced SVM primal/dual certificates with analytical optima.
- All nine advanced notebook code cells executed; stored numerical values matched reruns; 28 SVGs regenerated. Historical environment: NumPy 2.2.6, Matplotlib 3.10.5.
- Browser validation passed 51 page/viewport combinations and all five lab interactions, with zero JavaScript errors and HTTP failures.
- Advanced browser checks passed seven chapters × three widths plus seven JavaScript-disabled checks (28 cases), 84 image loads, mobile keyboard scrolling, code disclosure, advanced anchors, and downloads. Results: [advanced-browser-check.json](advanced-browser-check.json).
- Final bundle smoke tests passed for the main page and five labs over nested HTTP and `file://`; latest desktop/mobile main-page outputs were reviewed.
- Advanced package checks passed seven mobile `file://` chapters, seven JavaScript-disabled chapters, and seven nested-HTTP chapters (21 cases). Results: [advanced-package-check.json](advanced-package-check.json).
- All 28 figures were visually reviewed. No clipped titles or axis labels were found in Matplotlib renders. Desktop/mobile regression screenshots were reviewed; mobile scrolling was made explicit.
- A JavaScript-disabled auto-scroll timeout assertion was replaced with direct checks of scrolling and image loading.
- The historical ZIP contained 60 files, approximately 511 KiB. SHA-256 parity across source, bundle, and ZIP, ZIP integrity, the allowlist, and local Markdown links passed.

External GitHub deployment and Safari/Firefox validation were not performed. Follow the current authoring guide for subsequent edits.

## Language, theme, and documentation updates (2026-09-08)

English is the default website language. Korean and Japanese editions use matching paths under `ko/` and `ja/`. Header switching preserves the page and section; the default entry restores the saved language. The first visit follows the system theme, and a manual light/dark choice is remembered.

The Web-HQ project card opens the learning site, and all learning pages link back to Web-HQ. Text and ordinary links work without JavaScript; lab controls and theme buttons use JavaScript.

Run `python3 MLStudy/tools/render_site.py` from the repository root. Source IDs are in `i18n/strings.json`, translations in `i18n/translations.json`, and reviewed overrides in `i18n/translations.tsv`. Missing translations fail generation. Website translations combine offline model drafts and manually written text; technical terms and long explanations can receive further review. Equations and executable code are preserved.

All Markdown documentation is maintained in English, including source documents and the copies under `ko/` and `ja/`. Website and downloadable learning examples retain their language switching/localization. See [current validation](localization.md) for the multilingual and theme checks; the earlier records above describe the historical Korean/light edition.
