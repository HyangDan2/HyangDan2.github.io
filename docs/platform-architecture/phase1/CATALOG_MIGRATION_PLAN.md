# Catalog migration and adapter plan

Phase 1 design only. Existing catalogs remain authoritative. Adapters are pure, deterministic build-time transforms with explicit allowlists; they never copy an entire native record into the public format.

## Mapping

| Owner | Input | ID/type | Link mapping | Export rule |
| --- | --- | --- | --- | --- |
| Web-HQ | `analysis/manifest.json` | Lowercase namespaced key, e.g. `web-hq:krx005930`; `research` | `url` → `links.launch`, with current case-sensitive dashboard path preserved. No repository inference. | The six listed analyses become brief public records; omit `latest_json`, raw data and financial metrics. HQ's three hub links are navigation, not project records. Follow `docs/HARNESS_GUIDE.md` for the current URL/data checks. |
| EduHub | `data/entries.json` | `edu-hub:<id>`; course/note/article/video/project → `learning` unless separately classified by reviewed metadata | `learningUrl` → Launch; generated `/EduHub/entries/<id>/` → Profile; public `sources[type=repository]` → Repository only after explicit public-repo verification | Only `published`; keep course card's existing direct Launch and intro action. Do not copy Markdown body/search text into registry. An entry with several repository sources needs an explicit chosen primary repository or none. |
| GameHub | `data/games.json` | `game-hub:<id>`; `game` | `playUrl` → Launch; verified `repositoryUrl` → Repository | `published` or `unavailable`; draft excluded. Omit `sourceRevision`, `evidencePath`, device evidence and internal notes. For unavailable games, retain an approved profile or repository action and do not emit a live launch action unless the destination is still intentionally usable. |
| TechnicalHub | `content/profiles/*.md` plus legacy `data/catalog.json` | `technical-hub:<id>`; `technical` unless explicitly classified | generated `/TechnicalHub/technologies/<slug>/` → Profile; approved public `repositoryUrl` → Repository; optional verified public launch URL requires new reviewed metadata | Published profiles only, plus reviewed legacy entries. Never infer a private source URL. Current two profiles export Profile only. Deduplicate by stable ID and route, not by shared source URL. |

The adapters use the schema's field names but do not force every source to have all three links. `primaryAction` is chosen from links that exist. Images are absolute public URLs only after asset existence and disclosure checks. Tags remain display metadata; no global taxonomy rewrite is required in this migration.

For Web-HQ, the native `key` may contain uppercase ticker letters and must remain unchanged in existing filenames and URLs. The normalized ID lowercases the key only for registry identity. Validate that the relative `url` and `latest_json` resolve inside the intended `analysis/<key>/` tree and that `latest.json` points to a real `raw_data/*.json` file without traversal or symlink escape. This check protects the existing site and must not cause raw JSON to enter the public discovery feed. The current data-to-`innerHTML` rendering is a separate publication-safety issue: test and harden it before automated updates introduce new unreviewed values.

## Registration model

After Phase 2 implementation, add a new project by changing **metadata**, not hub application code: a new game row in `data/games.json`, learning row and optional note in EduHub, TechnicalHub Markdown profile or reviewed link record, or Web-HQ research manifest row. Adapters iterate records and export the normalized feed. For a project type a hub has never supported, add a data-driven manifest file under a predeclared `data/projects/*.json` discovery path. That path and renderer are introduced once in Phase 2; each later project adds a file, not a code branch. A new project repository still builds and deploys through its own workflow.

Keep domain-specific fields in native catalogs. Do not use the common schema to replace gameplay input data, learning notes, profile technologies, or research raw JSON. A common manifest is the public discovery layer only.

## Migration sequence

1. Freeze a read-only baseline: repository revisions, local and hosted URL inventory, screenshot set, public output file lists, link targets, and known private terms. For Web-HQ, include all six analysis URLs and data pointers from its harness guide. Review existing uncommitted GameHub/TechnicalHub work before any Phase 2 edits.
2. Build the semantic validator and example fixtures in a separate planning/test workspace. Validate schema and edge cases: absent links, private repository, duplicate ID, invalid URL, route collision, draft exclusion.
3. Implement adapters behind existing builds without changing rendered pages. Compare each generated normalized record against native metadata; approve public text and links.
4. Add public `projects.v1.json` export to each hub. Keep old JSON endpoints and HTML untouched. Diff deploy artifacts against baseline, scan for secrets/private URLs and verify additive-only URLs.
5. Build the separate registry producer and last-good snapshot behavior. Exercise a failed feed and verify the other three sources still update.
6. Add TechnicalHub's typed action rendering and shared navigation contract in small repository-local changes, preserving present card primary links and design.
7. Run local and hosted QA by repository. Roll out one hub at a time; verify each deployed release before advancing. Publish the registry last, after the feeds exist.

## Example normalized records

GameHub: `game-hub:particle-beat`, `type: game`, `primaryAction: launch`, Launch `https://hyangdan2.github.io/CDXPilot0004/`, public Repository `https://github.com/HyangDan2/CDXPilot0004`.

TechnicalHub private profile: `technical-hub:face-landmark-tracker`, `type: technical`, `repositoryAccess: private`, `primaryAction: profile`, Profile `https://hyangdan2.github.io/TechnicalHub/technologies/face-landmark-tracker/`; no Repository or Launch link.

EduHub course: `edu-hub:edpilot0001`, `type: learning`, `primaryAction: launch`, Launch `https://hyangdan2.github.io/EDPilot0001/`, Profile `https://hyangdan2.github.io/EduHub/entries/edpilot0001/`.

These examples use existing source values. Their actual generated manifests and hosted targets require Phase 2 verification.

## Rollback

Adapter and export releases are additive: revert the affected hub commit and redeploy its last known good `dist/`. Keep the registry's last good per-source block and published snapshot. A schema v1 consumer ignores a future incompatible version until a separately reviewed v2 migration. Never delete or redirect legacy routes as part of rollback.
