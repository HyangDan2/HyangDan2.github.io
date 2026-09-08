[Main edition docs](../harnessguide.md) | [Korean edition docs](../ko/harnessguide.md) | [Japanese edition docs](harnessguide.md)

# HD2Lab authoring and resume guide

## Project contract

Maintain an English-default static machine learning archive with complete Korean and Japanese editions. Preserve the seven chapters, five labs, three appendices, 21 advanced cases, 28 figures, and reproducible downloads. Each language has 17 HTML pages, including its entry page. All Markdown documentation, including authoring sources and edition copies, must remain English. Website and download localization is separate from this documentation policy. User instructions take precedence over this guide.

Visitors need no server API, database, key, CDN, external font, or build step. Content and ordinary links work without JavaScript; browser experiments and remembered display preferences enhance that static baseline. The current scope is local editing and verification. Publishing is a separate action.

## Resume work

Read `docs/localization.md`, `docs/progress.md`, and `docs/curriculum-map.md`, then compare their claims with the actual files. Historical reports describe their recorded versions. Reuse the approved source material in this repository; request new references only when a new claim depends on material that is not available.

## Sources and regeneration

- Foundation and advanced prose: `tools/content.py`, `tools/content_more.py`, `tools/content_advanced.py`.
- Common structure and lab specifications: `tools/render_site.py`.
- Canonical calculation, plot, and lab scripts: `i18n/source-js/`.
- Documentation: English sources in `i18n/source-docs/`; maintained guides in `i18n/document-overrides/en/`. The generator synchronizes English mirrors in the `ko/` and `ja/` override folders.
- Downloads: `i18n/source-downloads/`. The basic example generator and advanced enrichment tool write here.
- Translation source IDs: `i18n/strings.json`. Translations: `i18n/translations.json`; reviewed overrides: `i18n/translations.tsv` and `i18n/reviewed.json` (also supports multiline code comments).
- Generated Korean HTML input: `i18n/source-html/`, an ignored intermediate folder. Published English HTML lives at the learning root, with Korean/Japanese in `ko/` and `ja/`.

Run from the Web-HQ repository root:

```sh
python3 MLStudy/tools/render_site.py --source-only
python3 MLStudy/tools/collect_translations.py
# Add English and Japanese translations for newly collected source IDs.
python3 MLStudy/tools/render_site.py
```

After installing the authoring formatters, existing catalogs regenerate offline with Python 3 and Node.js; translation models are not required. Do not edit generated localized HTML, JavaScript, or download descriptions directly. Keep language IDs and anchor IDs stable. Use relative URLs so the site works beneath a repository path. Entry pages must retain an ordinary fallback link.

After changing advanced computations, run `python3 MLStudy/tools/enrich_site.py` first. It updates canonical results, notebooks, and SVGs using NumPy and Matplotlib. Never manually alter numerical results just to match prose.

## Content and mathematical integrity

Write explanations and examples from learning goals. Do not copy third-party pages, exercises, code templates, or traced diagrams. Standard equations and definitions must remain correct. Attribute relevant official references in the references appendix. Do not invent personal experiences or production performance claims.

Document synthetic generation formulas, seeds, sample sizes, units, and evaluation splits. Fit preprocessing only on training observations. Distinguish validation used for selection from final testing. Keep PCA normalization and reconstruction identities consistent. Check GMM responsibility sums, finite likelihood, and covariance stability. Preserve the SVM equality/box constraints and its convergence thresholds; label unconverged results as approximate. Retain assumptions and limits in every translation.

## Display and interaction

Every page includes the learning navigation, language links, theme toggle, and Web-HQ return link. Preserve the current page and fragment when changing languages with JavaScript. Default to English on a new visit and to the system theme until a manual theme is saved. Store only language and theme, never experiment inputs.

Use the existing responsive layout, visible keyboard focus, meaningful headings, correct page `lang`, input labels, graph alternatives, and horizontally scrollable mathematical content. Maintain contrast for light/dark modes and the light print palette. Preserve the authored plot palette and readable plot canvas.

## Validation and handoff

Run `tests/localization_check.py`, the math/SVM Node tests, `tests/verify.py`, and relevant advanced checks. Python reference tests need NumPy; notebook reproduction also needs Matplotlib and IPython. Run `tests/localization_browser.py` against the local site for all languages, five labs, mobile widths, theme behavior, and JavaScript-disabled pages. Report only checks actually run.

Package using `python3 MLStudy/tools/package_site.py`. The allowlist excludes authoring sources, tests, and historical screenshots. Install its `MLStudy/` and `assets/` directories at the Web-HQ repository root; the parent site supplies the return destination. Update the current validation report and disclose any remaining language-review limitations before handing off.

## Source formatting and shared favicon

Every site page uses the Web-HQ root `assets/favicon.svg` through a relative URL. The MLStudy generator preserves that reference in all three editions, including entry pages. The favicon is no longer stored in `MLStudy/assets/images/`.

Install the development-only formatting tools from the Web-HQ repository root:

```sh
npm ci --prefix MLStudy
python3 -m pip install -r MLStudy/requirements-format.txt
```

Run `python3 MLStudy/tools/format_sources.py` to format sources, or add `--check` to verify formatting. Full site generation runs the formatter automatically. HTML uses two-space indentation with whitespace-sensitive elements preserved; CSS, JavaScript, and JSON use two spaces; Python uses four. HTML formatting tolerates existing legacy markup without repairing it. Embedded strings, mathematical content, notebook files, and SVG outputs are preserved. The formatters are authoring dependencies only; visitors need no installation.
