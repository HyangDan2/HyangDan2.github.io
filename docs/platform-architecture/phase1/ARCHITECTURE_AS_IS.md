# HD2Lab architecture: current state

Snapshot: 2026-10-26 (Asia/Seoul). Evidence is the local working trees, not a hosted-site audit. No build, deployment, remote settings inspection, or network check was run. Revisions before this documentation update: Web-HQ `ec70ace17032`, EduHub `bb44b2f10ca2`, GameHub `8529dc867e1a`, TechnicalHub `78fbef7f50cb`. GameHub and TechnicalHub contain pre-existing uncommitted changes; this review did not modify them. Web-HQ documentation was subsequently updated on the user's instruction, without changing its site code.

## Repository and publication map

| Site | Source of truth | Build and public artifact | Current verification and release | Public base |
| --- | --- | --- | --- | --- |
| Web-HQ | Handwritten `index.html`; `analysis/manifest.json` for six research dashboards | Static files served from the repository; no package build or `.github/workflows` in the local tree | No local CI workflow or centralized validation found. `docs/HARNESS_GUIDE.md` now records manual checks and proposed Phase 2 gates. GitHub Pages source/settings were not inspected. | `https://hyangdan2.github.io/` |
| EduHub | `data/entries.json` plus optional `content/notes/<id>.md` | Node build writes `dist/`, static detail pages and `data/search.json`; only `published` entries are emitted | `npm run verify` performs catalog validation, unit tests, build and Playwright; workflow also checks external links, deploys `dist/`, but has no hosted job | `https://hyangdan2.github.io/EduHub/` |
| GameHub | `data/games.json` | Node build writes `dist/` and a sanitized `data/games.json`; draft games are excluded | `npm run verify` plus external link check; Pages workflow deploys `dist/` and runs hosted verification | `https://hyangdan2.github.io/GameHub/` |
| TechnicalHub | `content/profiles/*.md` for profile cards/pages; `data/catalog.json` for legacy link records (currently empty) | Eleventy writes `dist/`, generated `data/catalog.json` and `/technologies/<slug>/` pages | `npm run validate` plus build in Pages workflow; no PR or hosted verification job in the observed workflow | `https://hyangdan2.github.io/TechnicalHub/` |

## Existing records and behavior

- Web-HQ has three hand-maintained hub links. `analysis.html` loads `analysis/manifest.json`, then each dashboard's `latest.json` and raw JSON in the browser. Six analysis URLs use the current `analysis/<key>/<key>.html` shape. This is domain data and must not be copied wholesale into a global directory.
- The existing `docs/education-harness-guide.md` governs EDPilot0001 education authoring, not Web-HQ operations. The new `docs/HARNESS_GUIDE.md` documents Web-HQ's actual local server and manual checks, and labels proposed automation separately. Individual analysis pages currently load Chart.js from a CDN. Analysis JavaScript also inserts JSON-derived values through `innerHTML`; generated or external data therefore needs an explicit HTML-injection review before publication.
- EduHub has one published course, `edpilot0001`. Its card launches `https://hyangdan2.github.io/EDPilot0001/` directly; a separate intro link reaches `/EduHub/entries/edpilot0001/`. Search and filters use URL state, and `#entry-edpilot0001` is a stable card anchor. Draft and archived records do not enter the build.
- GameHub has three published games, `particle-beat`, `valkyrie`, and `chibilink`, with independent project Pages URLs. `unavailable` games remain visible without an active play control; drafts are removed from the public JSON. Source revision and onboarding evidence are removed from the public catalog.
- TechnicalHub has two published Markdown profiles, `face-landmark-tracker` and `general-purpose-video-image-mixer`. Both describe private implementation projects and intentionally omit repository URLs. Their cards currently lead to profile pages. The checked-in legacy JSON catalog is empty, while the generated `dist/data/catalog.json` contains the two profiles.

## Current URL and navigation baseline

Preserve the four base URLs above; `/analysis.html`, each existing `/analysis/<key>/<key>.html`, `/EduHub/entries/edpilot0001/`, `/GameHub/` game play destinations, and both `/TechnicalHub/technologies/<slug>/` routes. Preserve current hash anchors, query-based EduHub filter restoration, direct course launch, game launch, and TechnicalHub card-to-profile action. The exact six analysis keys are in `Web-HQ/analysis/manifest.json`; the game destinations are in `GameHub/data/games.json`. The Phase 2 URL inventory must record every generated route and outgoing link before edits.

Current parent navigation is asymmetric: Web-HQ links to the three hubs; EduHub and TechnicalHub link to Web-HQ in shared navigation; GameHub's existing game return guide defines game-to-GameHub links. Each site's visual system is distinct. TechnicalHub also intentionally has a separate profile-page visual style.

## Gaps against the order

1. Four incompatible metadata shapes and publication states; there is no versioned cross-hub project contract or stable global ID.
2. No build-time public export covering all hubs, no global registry, and no explicit last-good snapshot rule.
3. TechnicalHub supports profile-first or repository-only legacy cards, but has no typed Launch / Profile / Repository action contract. Its private profiles must never acquire inferred repository links.
4. CI parity is incomplete. Web-HQ has no observed workflow or build command; its new harness guide is documentation, not an executable test suite. TechnicalHub lacks observed PR and hosted checks. EduHub and GameHub have richer but different gates.
5. Public artifact boundaries are project-specific. GameHub strips evidence fields, EduHub emits published body text into search JSON, and TechnicalHub publishes reviewed profile text. A shared allowlist and artifact scan are not yet specified.
6. Repository independence exists today, but any future global registry wired as a required upstream build could break that property.

## Evidence paths

`Web-HQ/index.html`, `Web-HQ/analysis-index.js`, `Web-HQ/analysis/manifest.json`, `Web-HQ/docs/HARNESS_GUIDE.md`; `EduHub/package.json`, `data/entries.json`, `scripts/build.mjs`, `.github/workflows/pages.yml`; `GameHub/data/games.json`, `scripts/build.mjs`, `.github/workflows/pages.yml`; `TechnicalHub/content/profiles/`, `data/catalog.json.njk`, `scripts/catalog.mjs`, `scripts/validate.mjs`, `.github/workflows/pages.yml`, `dist/data/catalog.json`.

The local tree cannot establish current GitHub Pages settings, actual hosted content, accessibility on devices, or whether remote HEAD matches the working tree. Those require Phase 2 baseline checks before deployment.
