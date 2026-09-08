# HD2Lab — Personal Machine Learning Studies

From mathematics to models: explanations, worked examples, and browser experiments. English is the default; the header switches to Korean or Japanese and offers light/dark mode. Language and theme preferences are remembered. All repository documentation is maintained in English, including the copies under `ko/` and `ja/`. Website content and downloadable learning examples still support all three languages.

[Open the learning site](index.html) · [Return to Web-HQ](../index.html)

The archive contains **17 HTML pages per language (51 total)**: an entry page, a main page, seven chapters, five labs, and three appendices. Each chapter retains its six foundation sections, three advanced cases, and four comparative figures: **21 advanced cases and 28 SVG figures** overall. All experimental data are synthetic.

## Run locally

From the Web-HQ repository root:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/MLStudy/`. Direct HTML reading is also supported. JavaScript enables lab controls and preference persistence; static content and language links remain usable without it.

## Curriculum

1. [From Data to Learning](chapters/01-data-and-models.html)
2. [The Mathematics of Prediction](chapters/02-linear-regression.html)
3. [Improving a Model](chapters/03-optimization.html)
4. [Working with Uncertainty](chapters/04-probability-and-inference.html)
5. [Compressing Information](chapters/05-pca-and-svd.html)
6. [Finding Hidden Groups](chapters/06-gmm-and-em.html)
7. [Building Classification Boundaries](chapters/07-svm.html)

Labs: [Regression](labs/regression.html), [Gradient descent](labs/gradient-descent.html), [PCA](labs/pca.html), [GMM](labs/clustering.html), [SVM](labs/svm.html).

Appendices: [Mathematics](appendix/mathematics.html), [Terms and notation](appendix/glossary.html), [References and credits](appendix/references.html).

## Downloads

- [Foundation Python examples](downloads/study-examples.py) and [notebook](downloads/study-examples.ipynb).
- [Advanced notebook with outputs](downloads/advanced-experiments.ipynb), [calculation Python](downloads/advanced-experiments.py), [figure generator](downloads/advanced-figures.py), and [numeric results](downloads/advanced-results.json).

Each language has localized explanatory cells and comments with equivalent executable code and unchanged saved outputs. NumPy is required to run the Python examples; advanced figure regeneration also needs Matplotlib. Browser and Python random generators differ, so identical numeric seeds do not imply identical samples across implementations.

## Editing and verification

The browser uses only static HTML, CSS, JavaScript, and SVG. No API, CDN, downloaded fonts, external runtime library, or visitor-side build is required. Experiments run locally; only language and theme preferences are stored.

```sh
python3 MLStudy/tools/render_site.py
python3 MLStudy/tests/localization_check.py
node MLStudy/tests/math.test.js
node MLStudy/tests/svm.test.js
python3 MLStudy/tests/verify.py
python3 MLStudy/tests/advanced_verify.py
python3 MLStudy/tools/package_site.py
```

The independent Python checks require NumPy. Notebook reproduction with `advanced_verify.py --notebook` also requires Matplotlib and IPython. Browser checks require Playwright and Chromium or an installed Chrome configured through `MLSTUDY_CHROME`. See the language guide for the complete workflow and review scope.

- [Languages, themes, and current validation](docs/localization.md)
- [Authoring and resuming work](harnessguide.md)
- [Curriculum map](docs/curriculum-map.md)
- [Progress and historical validation](docs/progress.md)
- [Deployment](docs/deployment.md)

The package tool creates `output/hd2lab-webhq-site/` and `output/hd2lab-webhq-static.zip`. Copy the bundle contents into the Web-HQ repository root, preserving its `MLStudy/` and `assets/` directories. Internal authoring sources, tests, and historical screenshots are excluded. Local changes do not publish or push the site.

## Source formatting and shared favicon

Every site page uses the Web-HQ root `assets/favicon.svg` through a relative URL. The MLStudy generator preserves that reference in all three editions, including entry pages. The favicon is no longer stored in `MLStudy/assets/images/`.

Install the development-only formatting tools from the Web-HQ repository root:

```sh
npm ci --prefix MLStudy
python3 -m pip install -r MLStudy/requirements-format.txt
```

Run `python3 MLStudy/tools/format_sources.py` to format sources, or add `--check` to verify formatting. Full site generation runs the formatter automatically. HTML uses two-space indentation with whitespace-sensitive elements preserved; CSS, JavaScript, and JSON use two spaces; Python uses four. HTML formatting tolerates existing legacy markup without repairing it. Embedded strings, mathematical content, notebook files, and SVG outputs are preserved. The formatters are authoring dependencies only; visitors need no installation.
