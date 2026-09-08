[Main edition docs](../../docs/localization.md) | [Korean edition docs](../../ko/docs/localization.md) | [Japanese edition docs](localization.md)

# Languages and display preferences

English is the default edition. Korean lives under `ko/` and Japanese under `ja/`; all three editions contain the same 16 content pages, section IDs, examples, and downloads. Each edition also has an entry page.

The language links in the header open the corresponding page. With JavaScript enabled they preserve the current fragment and query and remember the selected language. `MLStudy/index.html` restores that choice; explicitly opening an edition's `main.html` opens that edition. With JavaScript disabled, ordinary language links still work.

The theme follows the operating system on the first visit. The Dark mode button toggles light/dark, exposes its state with `aria-pressed`, and remembers the choice. Blocked browser storage does not prevent navigation or theme changes. Language and theme are the only saved values; lab inputs are neither stored nor transmitted. Printed pages use the light palette.

Web-HQ links to `MLStudy/index.html`. Each learning page links back to the parent Web-HQ `index.html`. Deploy the bundle at the Web-HQ repository root; it contains `MLStudy/` and the shared `assets/favicon.svg`. Preserve these relative paths.

## Documentation language

All Markdown documentation is English, including `README.md`, `harnessguide.md`, `docs/`, source documents, and override copies under every edition directory. These paths remain available for existing links; their directory names select the website edition, not the documentation language. Edit `i18n/source-docs/` or the maintained guides in `i18n/document-overrides/en/`, then run the generator. It republishes English documentation and synchronizes the other override copies. Website pages, UI strings, and downloadable learning examples retain their three-language behavior.

## Authoring and regeneration

Run commands from the Web-HQ repository root:

```sh
python3 MLStudy/tools/render_site.py
python3 MLStudy/tests/localization_check.py
node MLStudy/tests/math.test.js
node MLStudy/tests/svm.test.js
python3 MLStudy/tests/verify.py
python3 MLStudy/tools/package_site.py
```

- `tools/content*.py` and `tools/render_site.py`: existing Korean authoring content and page structure.
- `i18n/source-js/`: canonical numerical/figure/lab JavaScript. Calculations remain equivalent across editions; UI strings are localized at generation time.
- `i18n/source-docs/`: English documentation sources. `i18n/document-overrides/en/` contains the maintained English guides; the `ko/` and `ja/` override folders are synchronized English mirrors.
- `i18n/source-downloads/`: canonical Python, notebooks, and numerical results. Notebook outputs are preserved; comments and explanatory cells are translated.
- `i18n/strings.json`: stable source-string IDs. `i18n/translations.json`: English/Japanese catalog. `i18n/translations.tsv`: reviewed overrides, one ID and two translations per line, separated by tabs.
- `tools/localize_site.py` and `tools/localize_documents.py`: static compilation; no translation model, external service, or network is required to regenerate with the existing catalog.

After editing authoring content, regenerate the Korean input, collect added strings with `tools/collect_translations.py`, supply both translations, and rerun the generator. Missing translations fail the build rather than silently mixing languages. Do not edit generated localized pages, scripts, or download descriptions directly.

The advanced regeneration tool writes canonical download artifacts. After numerical changes, run `tools/enrich_site.py` before rendering and repeat the numerical checks. Keep executable code and example numbers unchanged during language-only edits.

## Translation provenance and review

English and Japanese use manually written translations plus locally generated drafts from [Tencent HY-MT1.5](https://huggingface.co/tencent/HY-MT1.5-1.8B), through the [MLX conversion](https://huggingface.co/mlx-community/HY-MT1.5-1.8B-4bit). The authoring model is not shipped with the site. Educational files were processed locally. Earlier low-quality draft models were discarded.

UI wording and representative mathematical passages were reviewed. The entire archive has not received independent professional translation review. Source Korean remains available for comparison. Numerical and executable-code parity checks are separate from linguistic review.

## Validation

The current machine-readable browser result is `docs/localization-browser-check.json`. `tests/localization_check.py` checks language codes, corresponding routes, preserved anchors, local files, Web-HQ links, absence of Korean in the English/Japanese body, English-only Markdown throughout MLStudy, Python AST equivalence, and notebook output equivalence.

`tests/localization_browser.py` checks three languages, all five labs, reset behavior, light/dark persistence, same-section language switching, saved entry language, mobile layouts, and JavaScript-disabled content. Set `MLSTUDY_TEST_URL` to the locally served learning folder; optionally set `MLSTUDY_CHROME` to an installed Chrome executable.

Older screenshots and browser reports document the previous Korean/light edition. They are historical evidence, not validation of this change. New screenshots use the `localization-` prefix.


## Verified on 2026-09-08

- Static audit: 51 pages; corresponding language routes, anchors, Web-HQ links, document links, equation/table numerals, Python ASTs, and notebook outputs passed.
- Browser: 15 language/lab combinations, 9 main-page viewport combinations, 60 chapter/appendix viewport combinations, and JavaScript-disabled content in all three languages passed. No JavaScript errors or HTTP failures. System theme and blocked-storage behavior passed.
- Numerical tests: 17,840 core assertions and 216 SVM settings passed. Independent NumPy 2.3.1 references passed.
- Advanced reproduction: seven result sets, five SVM certificates, all nine notebook code cells, matching numerical tables, and 28 regenerated SVG outputs passed (NumPy 2.5.3, Matplotlib 3.11.1). A nonfatal system font-cache warning occurred in the sandbox.
- Packaging: 118 allowlisted files; ZIP integrity and manifest checks passed.

Machine-readable results: `docs/localization-static-check.json`, `docs/localization-browser-check.json`, and `docs/localization-validation.json`. These checks validate behavior and computational integrity; linguistic review remains scoped as described above.

## Source formatting and shared favicon

Every site page uses the Web-HQ root `assets/favicon.svg` through a relative URL. The MLStudy generator preserves that reference in all three editions, including entry pages. The favicon is no longer stored in `MLStudy/assets/images/`.

Install the development-only formatting tools from the Web-HQ repository root:

```sh
npm ci --prefix MLStudy
python3 -m pip install -r MLStudy/requirements-format.txt
```

Run `python3 MLStudy/tools/format_sources.py` to format sources, or add `--check` to verify formatting. Full site generation runs the formatter automatically. HTML uses two-space indentation with whitespace-sensitive elements preserved; CSS, JavaScript, and JSON use two spaces; Python uses four. HTML formatting tolerates existing legacy markup without repairing it. Embedded strings, mathematical content, notebook files, and SVG outputs are preserved. The formatters are authoring dependencies only; visitors need no installation.

## Shared favicon and formatting validation — 2026-09-08

The favicon moved to the Web-HQ root `assets/favicon.svg`. `tests/favicon_check.py` checks all 59 published HTML pages and the 51 learning pages in the new 118-file bundle. Browser checks confirmed successful icon loading on all 59 pages and unchanged rendered text on all 51 learning pages. Source comparisons preserved Python/JavaScript execution, JSON data, notebook files, and SVG outputs; intentional build, packaging, and validation changes are separate. Core numerical tests (17,840 assertions), 216 SVM settings, independent NumPy references, advanced numerical checks, and the multilingual browser suite passed again. Formatting checks and a full rebuild also verify stable output. Existing malformed educational markup is preserved by this formatting task.

The package now uses `output/hd2lab-webhq-site/` and `output/hd2lab-webhq-static.zip`, with `assets/` and `MLStudy/` at its root. Run `python3 MLStudy/tests/favicon_check.py` after packaging to verify both source and bundle paths.
