# Integrating with Web-HQ / GitHub Pages

The repository already links Web-HQ to `MLStudy/index.html`, and every learning page links back to the parent `index.html`. This change is local; it does not push or publish a site.

## Build and package

From the repository root:

```sh
python3 MLStudy/tools/render_site.py
python3 MLStudy/tests/localization_check.py
python3 MLStudy/tools/package_site.py
```

The package contains `index.html`, `main.html`, the English chapters/labs/appendices, `ko/`, `ja/`, shared assets, and localized downloads. Output paths are `output/hd2lab-webhq-site/` and `output/hd2lab-webhq-static.zip`. File hashes are recorded in `manifest.json`.

The allowlist excludes source PDFs, editing tools, tests, internal documents, and screenshots. It refuses unexpected files in its managed output folder instead of deleting them.

## Install beneath the existing site

Copy the contents of the generated folder into the existing Web-HQ repository root, preserving the `MLStudy/` and `assets/` directories. The shared favicon is `assets/favicon.svg`; it is included in the bundle alongside `MLStudy/`. The parent portfolio HTML is not included. Older `output/hd2lab-site/` bundles use the previous layout and are not regenerated. Use the existing GitHub Pages deployment configuration. The parent Web-HQ supplies `../index.html`; the learning-only ZIP is intended for this integration and does not include the parent portfolio.

The Web-HQ entry link is:

```html
<a href="MLStudy/index.html">Open MLStudy</a>
```

Relative URLs support both a user site and a project site beneath a repository path. Use `index.html` to restore a visitor's saved language; use a specific edition's `main.html` to explicitly open that edition. Without JavaScript, the entry page provides an ordinary English link.

## Updating and checking

Replace localized HTML, scripts, and assets together. For numerical changes, regenerate canonical advanced artifacts with `tools/enrich_site.py` before rendering. The authoring model is not needed to build from the checked-in translation catalog.

Serve the repository root locally and check direct links to nested chapters and labs, all language switches, preference persistence, downloads, mobile layout, and the Web-HQ return route. See [the language guide](localization.md) for tests and current validation. Internal documentation is English in every edition directory; it is intentionally outside the public runtime bundle.
