# HD2Lab architecture: target design

Status: Phase 1 platform proposal, revised with the Web-HQ operational harness. On 2026-10-27 the user separately authorized and requested a Web-HQ-only home redesign, commit and push. That visual work is distinct from implementation of the platform architecture in this document.

## Decision

Keep four independent repositories, their current Pages bases, and their own catalog/build tools. Define one **public Project Manifest v1** as an interchange format (`PROJECT_MANIFEST_SCHEMA.json`), not as a replacement for each domain catalog. Each hub uses a build-time adapter to export only reviewed public project metadata. A separate, static Global Registry producer collects the four published exports and publishes a versioned JSON snapshot. Browsers never call GitHub APIs and hubs never need a live registry service to build or render.

```text
Web-HQ manifest ──────┐
EduHub catalog ────────┼─ local adapters → public manifests at existing Pages bases
GameHub catalog ───────┤                         │
TechnicalHub profiles ─┘                         ▼
                                  separate registry build → versioned static snapshot
                                            │
                                optional build-time hub consumption
```

The registry workflow is downstream and independent. A failure in one source does not trigger or block another repository's deployment. The registry may keep that source's previously verified records while ingesting successful sources; it marks the source stale. A first-time source with no last-good data remains absent and produces an alert. Registry failure leaves its last published snapshot online. No hub deploy job has `needs` on registry or another project repository.

## Manifest contract and ownership

One record has a globally stable namespaced `id` (`game-hub:particle-beat`), original `sourceId`, owning `hub`, typed `type`, public `title`/`summary`/`tags`/date, publication `status`, `repositoryAccess`, validated `links`, and `primaryAction`. `image` is optional. `published` and `unavailable` are the only exportable states; draft and archived data never enter the public feed. The JSON Schema checks shape. A semantic validator additionally checks the ID/hub relationship, real dates, canonical HTTPS URLs without credentials, an allowed public host/path policy, link reachability in a separate network check, no duplicate IDs or routes, and no private repository URL when `repositoryAccess` is `private` or `none`.

Do not infer a repository link from a project name, filesystem path, or private source origin. Private implementation information is manually reviewed into a public TechnicalHub profile; only the approved public profile metadata is exported. The manifest is safe to publish in full. Internal evidence, source revisions, credentials, unpublished notes, raw research data, and private-repo identifiers stay out of it.

Keep `sourceId` and original URL case and paths. Global IDs are stable even when titles change. A rename requires an explicit mapping review; a changed ID is treated as a migration, never silently deduplicated by repository URL. Two EduHub records may legitimately cite one repository.

## Global Registry contract

Proposed new independent repository: `HD2Lab-Registry` (name to confirm before Phase 2). The producer has a fixed configuration for the four **hub export endpoints**, not a per-project list. A new project needs an approved data record/profile in its owning hub and passes its existing adapter; no new hub rendering code or registry source-list edit is needed. Hub export endpoint proposal: `/<Hub>/data/projects.v1.json` and Web-HQ `/data/projects.v1.json`. Preserve all existing endpoints; these are additive.

Registry output is static JSON: `schemaVersion`, `generatedAt`, `sources[]` (hub, public feed URL, content SHA-256, fetchedAt, stale flag), and `projects[]` sorted by hub and ID. The published snapshot contains only manifests. Keep the previous complete snapshot as the fallback input. A source's records can be removed only after a fresh, valid feed explicitly omits them; fetch errors never imply deletion. Collision, unsafe URL, invalid status, or cross-source duplicate ID fails that source and retains its last-good records. Record freshness and digest in the snapshot and operator report. Give the producer no access to private repositories or secrets.

For consistent releases, fetch deployed feeds with bounded timeouts and verify their content before publishing. A registry update is eventual, never in the critical path of any site deploy. If a hub later wants a global listing, it pins a verified registry snapshot at build time and falls back to its last approved local snapshot. Local catalog pages continue to work if the registry is unavailable.

## TechnicalHub actions

Every normalized TechnicalHub record chooses a `primaryAction` explicitly. `game`/deployable `web-app`: Launch when a verified public launch URL exists. `technical` desktop/private application: Profile. Public library or source-only tool: Repository when the source URL is approved and public, otherwise Profile. A card may expose secondary Profile and Repository links only when present. Never render a disabled link as a live control. Preserve current two profile cards' click target and styles; add secondary actions within the existing visual system only after UI review. `unavailable` records may retain a profile, while Launch is omitted or visibly unavailable. No URL is generated from slug unless the matching output file is verified.

## Navigation and visual contract

Use a shared **link map and behavior contract**, not one cross-site CSS bundle. Each hub renders its own header/footer markup in its existing design. The contract defines labels, accessible names, active-page state, Web-HQ return destination, back behavior, keyboard focus, and same-tab internal navigation. Existing game and course return links remain project-owned; changes to their repositories require separate Phase 2 authorization. Each site can opt into a generated data fragment or local template helper at build time. No runtime network dependency is introduced. Visual regression checks compare key desktop/mobile pages before and after changes.

Web-HQ's [`docs/HARNESS_GUIDE.md`](../../HARNESS_GUIDE.md) is the repository-local operating entry point. It records the current static-server/manual checks and separates them from proposed clean-build, adapter, browser, and artifact-audit commands. The education authoring guide remains scoped to EDPilot0001. When Phase 2 tooling is implemented, update the Web-HQ harness in the same change so its commands match the repository. The Web-HQ home now uses a Server HQ-inspired layout with three identically styled hub cards; this approved exception affects only the Web-HQ home. The six research pages may keep their existing CDN dependency for now; the new registry/navigation layer adds no runtime dependency.

Web-HQ's `analysis/manifest.json` maps into brief `research` manifests. The adapter must validate that each existing dashboard URL and `latest.json` pointer stays inside its analysis folder. The registry must never ingest raw research JSON. Because current analysis rendering uses `innerHTML` with data values, review the public data and add HTML-safe rendering/validation before accepting any new automated data publication path. Preserve the existing page visuals and URLs when applying that fix.

## URL and deployment invariants

- The four Pages bases, existing direct detail URLs, anchors, query behavior, game launch URLs and course launch URL are immutable acceptance baselines.
- Preserve static HTML output, relative paths under Pages project bases, canonical metadata and direct reloads. New export endpoints are additive.
- A project repo builds/deploys independently; a hub builds/deploys independently; registry builds/deploys independently. Their failures can delay only their own output or registry freshness.
- Publication is a deliberate data-review action. In particular, a private source repository is never checked out by a public workflow or linked in a public artifact.

## Tradeoffs and open decisions

There is intentional eventual consistency between a hub release and the registry snapshot. The registry has no runtime availability dependency, but its feed requires a separate publication workflow and stale-source monitoring. Decide the registry repository name/Pages URL and who approves public manifest entries before Phase 2. Confirm hosted Pages settings and baseline URLs before implementation changes in any repository.
