# HD2's Diary (diary-src)

Eleventy source for **HD2's Diary** — the devlog that lives at `/diary/` on `hyangdan2.github.io`.

Everything in this folder is built into `_site/`, and the published copy lives in the repository's
`/diary/` folder (see **Deploy** below).

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
categories-index.njk     /diary/categories/  all four drawers
categories.njk           /diary/categories/<slug>/
write.njk                /diary/write/    client-side editor
posts/*.md               the posts
assets/diary.css         shared theme (mirrors Web-HQ tokens)
assets/write.js          editor logic (markdown preview, draft, export, GitHub URL)
```

## Deploy

The repository still publishes through the **legacy branch build** (Settings → Pages → Source:
Deploy from a branch, `main` / root), which runs Jekyll over the repo and serves it as-is. There is
no workflow in the repo: the GitHub App used here cannot push files under `.github/workflows/`
(`without workflows permission`).

So the build output is **committed**: `diary-src/_site/` is copied to `/diary/` and pushed. After
adding or editing a post, rebuild and commit both sides:

```bash
cd diary-src && npm ci && npm run build
rm -rf ../diary && mkdir -p ../diary && cp -R _site/. ../diary/
cd .. && git add diary diary-src && git commit -m "post: …" && git push
```

`/diary/` is deliberately not in `.gitignore`; `diary-src/_site/` and `diary-src/node_modules/` are.
Jekyll leaves `diary/` alone because those HTML files carry no front matter, and `_config.yml`
excludes `diary-src` (its Nunjucks would fail the Jekyll build).

**Optional — switch to Actions.** Add `.github/workflows/deploy-pages.yml` through the GitHub web
UI (the workflow builds `_site/`, merges it into `_deploy/diary/`, and deploys), then set Settings →
Pages → Build and deployment → Source to **GitHub Actions**. From then on the committed `diary/`
output is no longer needed: CI rebuilds it on every push.
