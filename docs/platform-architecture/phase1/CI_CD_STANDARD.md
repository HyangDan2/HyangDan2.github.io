# CI/CD and public artifact standard

Proposed contract for later implementation; each repository keeps its own workflow and GitHub Pages deployment. Verify action versions and current Pages requirements during Phase 2. Pin dependencies with the repository lockfile and a declared Node version. No shared release job may require all projects to succeed.

## Required gates per site repository

| Stage | Required result | Failure scope |
| --- | --- | --- |
| Validate | Native catalog/profile checks; Project Manifest JSON Schema **and** semantic checks; status filtering, unique IDs/routes, file paths, HTTPS URL policy | Only that repository's build/deploy |
| Unit/build | Deterministic adapter tests for mapping and privacy; clean build into `dist/`; no write to source in CI | Only that repository's build/deploy |
| Browser | Direct routes, cards, filters, navigation, keyboard focus, mobile viewport, current URL behavior | Only that repository's build/deploy |
| Artifact audit | Enumerate `dist/`, compare allowlist, scan for secrets/private links/internal paths, verify no draft/archived records, symlinks, source maps or unexpected files | Blocks only that repository's artifact upload |
| Deploy | Upload only audited `dist/` after successful main build; least privilege (`contents: read`, deploy job `pages: write`, `id-token: write`); concurrency scoped to site | Only that Pages site |
| Hosted verify | Check deployed base, key deep routes, manifest feed and navigation; record revision and release URL | Report/rollback for that site; never block unrelated deployments |

Pull requests run all local deterministic gates and browser tests without publishing. Main runs the same gates, deploys, then hosted verification. External network link checks are separate from deterministic correctness: a transient third-party outage is reported and reviewed, while unsafe or malformed destinations always fail local validation. Do not give PR jobs deployment credentials.

Web-HQ needs a minimal clean artifact process and workflow before it can meet the shared gate. Its current [`docs/HARNESS_GUIDE.md`](../../HARNESS_GUIDE.md) provides manual checks and explicitly does not claim those automated gates exist. The planned Web-HQ gate must validate all six manifest-to-page and `latest.json`-to-raw-data paths, test the HQ About and analysis controls, guard JSON-derived HTML insertion, and compare old URLs and visuals. The current Chart.js CDN dependency is recorded as existing behavior; this standard introduces no new runtime dependency. EduHub and GameHub can adapt existing `verify` commands. TechnicalHub needs PR verification, browser/hosted checks and artifact audit. The common standard is behavioral; repositories may use different build tools and keep their current designs.

## Registry pipeline

Run in a separate registry repository after hub releases or on a schedule/manual dispatch. Fetch only the four public `projects.v1.json` URLs. Validate each feed separately. On timeout/invalid feed, retain that hub's last-good records and mark the source stale. Valid feeds may add/update/remove their own records. Publish an immutable versioned snapshot plus a stable `registry.v1.json` pointer only after whole-output validation and artifact audit. Do not checkout private project repos, use private tokens or make registry completion a required check on hub PRs/deploys.

The registry workflow's failure affects registry freshness only. Its last published snapshot remains available. An alert/report identifies failed source, retained digest and age. A stale-source policy should flag human review after a defined interval; it must not silently delete records or stop other source updates.

## Public/private boundary

Public inputs: reviewed native catalog fields, approved TechnicalHub profile text/assets and existing public URLs. Private inputs: implementation source, private repository URL/identity, tokens, unpublished claims, internal diagrams, evidence, draft notes, source revisions where not public display data, and raw research payloads not needed for discovery. The adapter uses an allowlist of output fields and a reviewed URL host policy. The public registry job has no private-source checkout. A private implementation may have a public profile with `repositoryAccess: private` and no Repository link.

Artifact audit must inspect **bytes**, not just filenames: JSON/HTML/JS/CSS/text and metadata in images where feasible; known secret formats; `github.com` links to private repos from a maintained denylist held outside public artifacts; absolute local paths; `docs/onboarding`, `.env`, lockfiles, tests, source maps, logs and raw data not intentionally public. Web-HQ's analysis raw JSON is currently an intentional public input to its dashboards, so audit each file's disclosure suitability rather than rejecting that whole directory. Reject symlinks and path traversal in copied assets. Record audit evidence with commit, artifact digest, file count and findings. A scanner cannot prove a text claim is approved, so a human disclosure review remains the publication gate for private-project descriptions and images.

## Release and recovery

Every release records source revision, manifest/schema version, artifact hash, deployed Pages URL, deterministic check results and hosted check result. If hosted verification finds a broken route or leaked data, stop the affected site's further release, remove the exposed artifact through its authorized rollback process, and redeploy a reviewed last-good revision. Other projects continue deploying. Keep rollback instructions repository-local.
