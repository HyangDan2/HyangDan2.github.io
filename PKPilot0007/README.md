# PKPilot0007 — HD2Lab Markdown Editor

Live: <https://hyangdan2.github.io/PKPilot0007/>

A single-page Markdown editor that runs entirely in the browser. No backend, no build step.

## What it does

- **Toolbar** — H1–H3, bold, italic, strikethrough, inline code, fenced code, bullet/numbered list,
  task list, quote, link, table (plus undo and `Ctrl/⌘ + B/I/K/1/2/3/S`).
- **Views** — edit / split / preview on desktop; on narrow screens the split view collapses to a
  single pane and the split tab is hidden.
- **Preview** — markdown-it (GFM tables, strikethrough, linkify) + highlight.js + task-list checkboxes.
  Rendered HTML passes through DOMPurify before it touches the DOM.
- **Autosave** — body, diary fields and view mode in `localStorage['hd2_md_editor_v1']`.
- **Export** — `.md` download, copy Markdown, copy HTML, standalone HTML file download.
- **Diary publish panel** (collapsed by default) — title / category / date / slug / tags / summary →
  frontmatter + `<date>-<slug>.md` file name preview.
- **GitHub commit** — one click from the panel:
  1. `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}` to pick up an existing `sha`
     (new file = 404, overwrite = 200),
  2. `PUT /repos/{owner}/{repo}/contents/{path}` with UTF-8 Base64 content.

## GitHub token

The PAT is stored only in this browser (`localStorage['hd2_md_pat_v1']`) and is sent only to
`api.github.com`. A fine-grained token scoped to the target repository with **Contents: Read & Write**
is enough. The settings dialog holds repo / branch / path prefix / commit message too
(`localStorage['hd2_md_github_v1']`).

A commit to `diary-src/posts/` is not visible on `/diary/` by itself: that route serves the committed
Eleventy build output, so `diary-src` has to be rebuilt and `/diary/` re-committed
(see `diary-src/README.md` → Deploy).

## Files

```
index.html          the page (HD2Lab header, toolbar, panes, publish panel, settings dialog)
style.css           Soft Iris / Navy & Lavender tokens + layout
app.js              markdown-it setup, autosave, export, frontmatter, GitHub REST commit
js/vendor/          markdown-it 14.3.3, highlight.js 11.11.1, DOMPurify 3.2.6 (vendored, no CDN)
```

Theme is the shared one: `/assets/hd2-theme.css` + `/assets/hd2-theme.js` (44px floating toggle).
