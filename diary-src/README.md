# HD2's Diary (diary-src)

Eleventy source for **HD2's Diary** — the devlog that lives at `/diary/` on `hyangdan2.github.io`.

The site is assembled at deploy time: everything in this folder is built into `_site/`, and the
GitHub Actions workflow copies that output to `_deploy/diary/` next to the root static site.

## Commands

```bash
cd diary-src
npm install          # once
npm run build        # writes _site/  (Eleventy)
npm run serve        # local preview at http://localhost:8080/ (pathPrefix /diary/)
```

Local preview is served under the `/diary/` prefix, so `npm run serve` opens the diary at
`http://localhost:8080/diary/`.

## Writing a post

Two ways, both end with a Markdown file in `posts/`:

1. **In the browser** — `/diary/write/` (no backend). Fill in title, category, date, summary, tags
   and the body; then either commit straight from GitHub (the page opens the new-file screen with
   the whole file prefilled) or download `<YYYY-MM-DD>-<slug>.md` and add it here.
2. **By hand** — create `posts/<YYYY-MM-DD>-<slug>.md`:

```yaml
---
title: "제목"
date: 2026-11-16
category: Devlog          # Devlog | Architecture | Troubleshooting | Notes | anything custom
summary: "한두 문장 요약"
tags: [eleventy, github-pages]
layout: post
---
```

`posts.11tydata.js` fills in the permalink (`/posts/<file-name>/`) and the category name/slug, so a
post never needs those in its frontmatter. A brand-new category value automatically appears as its
own category page and card.

## Structure

```
eleventy.config.js       markdown-it + highlight.js, filters, collections
lib/utils.js             slug/date helpers
lib/categories.js        the four default categories
_data/site.js            site name, repo, post directory
_includes/base.njk       header (HD2Lab | HD2's Diary), footer, shell
_includes/post.njk       post layout
_includes/parts/…        post list + empty state macros
index.njk                /diary/          category cards + recent posts
categories.njk           /diary/categories/<slug>/
write.njk                /diary/write/    client-side editor
posts/*.md               the posts
assets/diary.css         shared theme (mirrors Web-HQ tokens)
assets/write.js          editor logic (markdown preview, draft, export, GitHub URL)
```

## Deploy

`.github/workflows/deploy-pages.yml` runs on every push to `main`: `npm ci` → `npm run build` →
assemble `_deploy/` (root statics + `_deploy/diary/`) → upload → deploy.

GitHub Pages must be set to **Source: GitHub Actions** (Settings → Pages → Build and deployment).
Until that is switched, the workflow deploys nothing and the site stays on the legacy branch build.
