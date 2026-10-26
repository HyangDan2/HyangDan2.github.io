# QA and acceptance criteria

These are Phase 2 release gates. Phase 1 acceptance is the seven internally consistent design files, evidence-backed current-state review, and the Web-HQ operating guide at `docs/HARNESS_GUIDE.md`. Documentation was updated on the user's follow-up instruction. No implementation or hosted acceptance is claimed here.

## Functional acceptance matrix

| ID | Criterion | Test evidence required |
| --- | --- | --- |
| F01 | Add one new project through a metadata-only change in its owning hub; no hub application source or registry source-list edit | Diff contains catalog/profile/manifest data and assets/evidence only; hub export and next registry snapshot contain exactly one stable ID |
| F02 | Every existing repository can run its own validation/build/deploy without checking out or waiting for another project repository or registry | Workflow dependency inspection and controlled failure of a separate project build while a healthy site's release succeeds |
| F03 | Failure of one hub feed does not erase its prior registry records or block updates from the other three | Simulate timeout and invalid feed separately; compare per-source digests, stale marker and unchanged last-good block |
| F04 | All four base URLs and every pre-existing deep route remain unchanged and directly reloadable | Before/after URL manifest and hosted HTTP checks; no new redirects or missing paths |
| F05 | Existing user behavior remains: EduHub direct course launch and intro route/query/hash, GameHub play links, TechnicalHub profile-first cards, Web-HQ hub and research links | Browser tests at desktop/mobile widths and keyboard navigation; record screenshots |
| F06 | TechnicalHub primary/secondary actions are correct by type and availability | Matrix tests for launchable web app/game, public source-only tool, private profile, unavailable item and missing link; no fabricated URL |
| F07 | New registry and hub feeds are static and require no runtime GitHub API or private-source access | Network inspection of production pages, workflow permission review and artifact audit |
| F08 | Private source and internal data do not appear in `dist/`, public manifests, registry or HTML metadata | Exact forbidden URL/token fixtures and allowlist scan; human review of public text and images |
| F09 | Existing visual systems remain materially unchanged except the separately approved 2026-10-27 Web-HQ home redesign | Use the redesigned Web-HQ home as its new screenshot baseline; compare EduHub, GameHub, TechnicalHub home/profile and Web-HQ analysis pages against their own existing baselines at desktop/mobile sizes |
| F10 | Publication states map correctly | Draft/archived absent; published present; unavailable visible only with valid non-launch action unless explicitly approved |
| F11 | Web-HQ harness matches implemented commands and its six analysis entries | Compare guide with repository commands; validate each manifest URL, `latest.json` pointer and raw JSON path; direct-load all six pages |
| F12 | Web-HQ's JSON-derived HTML cannot execute unapproved markup after automated data publication is enabled | Inject inert HTML/script-like fixture into permitted data fields; verify browser output is text or sanitized content and no script executes |

## URL baseline checklist

- `https://hyangdan2.github.io/` and `https://hyangdan2.github.io/analysis.html`.
- All six exact `analysis/<key>/<key>.html` routes listed by `Web-HQ/analysis/manifest.json` at baseline.
- Web-HQ's three hub links, About dialog behavior, analysis search/filter/sort, theme and language controls, and the existing Chart.js dependent charts.
- `https://hyangdan2.github.io/EduHub/`, `/EduHub/entries/edpilot0001/`, its `#entry-edpilot0001` return anchor, and `https://hyangdan2.github.io/EDPilot0001/` as course launch.
- `https://hyangdan2.github.io/GameHub/` and the three current `playUrl` values in `GameHub/data/games.json`.
- `https://hyangdan2.github.io/TechnicalHub/` and `/TechnicalHub/technologies/face-landmark-tracker/` and `/TechnicalHub/technologies/general-purpose-video-image-mixer/`.

The Phase 2 baseline must expand this list from the actual deployed site before any change. A local source route is not proof that the hosted route currently works.

## Schema and security cases

Validate the schema with Draft 2020-12 and `format` assertion enabled, then semantic checks. Positive fixtures: game with Launch+Repository, course with Launch+Profile, private technical profile with Profile only, public library with Repository only, research dashboard with Launch only. Negative fixtures: mismatched `id`/`hub`, duplicate ID, duplicate output route, non-HTTPS link, URL credentials, unapproved host/path, malformed date, `primaryAction` without corresponding link, `repositoryAccess: private` plus repository URL, draft in public feed, asset path traversal, hidden evidence or source revision field, and leaked private URL in HTML/JSON/asset metadata.

Artifact gates should fail when injected with a synthetic secret, a private repository URL, a source map, a test file, or a symlink. They should pass a reviewed public profile that states its implementation is private without revealing its location. Review exact output bytes after a clean build, not a repository-wide search alone.

## Release evidence

For each site and registry release, record repository and revision, clean-build command result, schema/semantic/browser/artifact scan results, deployed URL, artifact SHA-256, hosted check timestamp, and any limitation. External link availability and physical-device testing are reported separately from deterministic local and browser checks. Acceptance is per site; failure at one site cannot revoke a healthy site's release.
