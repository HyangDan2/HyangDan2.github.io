# Implementation work order

## Authorization boundary

**Phase 1, this order:** read-only analysis of existing site code and the four repositories, seven design deliverables, and, on the user's follow-up instruction, a Web-HQ-only operational harness guide and README link. The seven design documents now live at `Web-HQ/docs/platform-architecture/phase1/` so the project has one reviewable copy. This documentation update changes no site code, catalog, workflow, Pages setting or public deployment. The package remains a proposal for review.

**Phase 2 requires separate approval:** implementation, commits, pushes, deployment and changes beyond this authorized Web-HQ documentation update. Approval should identify allowed repositories and rollout owner. Do not treat older repository-local instructions as approval for this new cross-hub program.

The user's 2026-10-27 instruction separately authorized the Web-HQ home visual redesign and its commit/push. It does not authorize the registry, adapters, or cross-hub Phase 2 work described below.

## Planned Phase 2 sequence and ownership

| Step | Owner / target | Concrete output | Dependency / gate |
| --- | --- | --- | --- |
| 0. Baseline | Platform maintainer, all four repos | Hosted route inventory, screenshots, current Pages settings, artifact file lists, remote revisions and private-link denylist | Use Web-HQ's `docs/HARNESS_GUIDE.md` for the six analysis routes/data pointers; review pre-existing dirty GameHub/TechnicalHub working trees |
| 1. Contract | New registry/spec workspace | Final v1 schema, semantic validator, fixtures and publication review checklist | Sign off public field set and registry repository/URL |
| 2. Hub adapters | Each hub independently | Native-to-manifest adapter, build export `projects.v1.json`, adapter checks | Each hub passes local gates; existing HTML/JSON routes unchanged |
| 3. Artifact gates | Each hub independently | `dist/` allowlist scan and release evidence; Web-HQ clean build; TechnicalHub PR/browser/hosted checks | No private data in artifacts; repo-local Pages deployment only |
| 4. Registry | Separate registry repo | Four-endpoint ingestion, per-source last-good cache, static snapshot and stale reporting | At least one verified deployed feed; no hub workflow dependency |
| 5. TechnicalHub actions | TechnicalHub | Data-driven Launch/Profile/Repository rendering and tests | Current two cards remain profile-first and visual baseline passes |
| 6. Navigation | Each hub independently | Link-map adoption in existing design and navigation tests | Existing URLs, return hierarchy and behavior pass |
| 7. Rollout | One repo at a time | Verified Pages release, then registry refresh | Hosted acceptance for each site; stop only the failed site |

New independent project repositories keep their own build and Pages workflow. The hub metadata registration step references their verified public URL or approved public profile. No central workflow invokes their build or gates unrelated project deployments.

## Work packets

**Web-HQ:** use `docs/HARNESS_GUIDE.md` as the current operating baseline. The home redesign is separately authorized and complete before this platform work; preserve its three equally styled cards and all existing URLs. First capture URLs, screenshots, manifest/data references and current Pages settings. Introduce a build-time export from `analysis/manifest.json`; add clean artifact packaging, path checks, browser checks and public-artifact audit. Review JSON-derived `innerHTML` rendering before automating new data publication. Preserve research-page enrichment, current Chart.js behavior and analysis-page visual design unless a specific safety fix is approved. Make any global discovery surface additive and keep the harness commands synchronized with the implementation.

**EduHub:** map `data/entries.json` only; do not export note bodies into the global feed. Keep `learningUrl` as the course card's main action, intro/detail route and query/hash behavior. Use current Node/lockfile and validation pipeline.

**GameHub:** map `data/games.json`; keep its local public catalog and gameplay/return links. Exclude draft and operational evidence. Verify `unavailable` action behavior. No game repo is modified as part of hub adapter work.

**TechnicalHub:** merge published profile metadata with reviewed legacy link records in one adapter. Preserve published Markdown route generation. Add optional typed public Launch/Profile/Repository fields only after schema/content review. Existing two private-source profiles must continue to expose no repository URL. Keep home and profile visual systems.

**Registry:** consume deployed public feeds with timeouts and deterministic ordering; retain per-source last-good data; publish the static snapshot and provenance hashes. Give it its own build, validation, deployment and rollback. No private credentials.

## Definition of implementation complete

All QA criteria in `QA_ACCEPTANCE_CRITERIA.md` pass with recorded commit/artifact hashes and hosted evidence. A new sample project can be registered by a metadata-only change in its owning hub, then appear in that hub's feed and the next successful registry snapshot. Each site builds and deploys when another project/feed/registry fails. All baseline URLs and user behaviors remain intact. Private-source URLs and internal content are absent from all public artifacts. Only then may the program be reported as implemented.

## Decision log for reviewer

- Confirm the registry repository name and public URL.
- Confirm which person or role approves public profiles, screenshots and repository links.
- Confirm whether all four hubs need a visible global listing; the architecture allows it without making it a Phase 2 prerequisite.
- Confirm the desired stale-feed alert interval. The correctness rule is fixed: temporary failure never deletes last-good records.
