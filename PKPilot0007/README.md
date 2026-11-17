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
- **Open a file** — `.md 열기` in the FILE bar (or `Ctrl/⌘ + O`) opens a `.md / .markdown / .txt` file;
  dragging a file onto the page works too. UTF-8 is used first and EUC-KR is tried as a fallback. A YAML
  frontmatter block (`--- … ---`) fills title / category / date / slug / tags / summary and only the body
  goes to the editor; without frontmatter the whole file is the body. The FILE bar then shows the file
  name and a `로컬 파일` badge.
- **Load a post from GitHub** — the top of the publish panel lists the repository's posts
  (`GET /repos/{owner}/{repo}/contents/{path}?ref={branch}`, `.md` only, newest first). Picking one loads it
  (`GET` the file, Base64 → UTF-8) and keeps the original `path` + `sha`; the FILE bar shows `수정 중`.
  `새 글로 전환` unbinds the loaded post and goes back to a new file, keeping the body.
- **Image upload** — the toolbar image button (next to link / table) takes PNG · JPEG · WebP · GIF (≤5MB) and
  commits the same bytes twice with the stored PAT: `diary-src/assets/images/<YYYY-MM-DD>-<name>.<ext>` (source)
  and `diary/assets/images/<same name>` (the committed Eleventy output, so `/diary/assets/images/…` serves it at
  once). The file name is lowered to ASCII letters, digits and hyphens; an existing file of that name is
  overwritten with its `sha`. Only after both commits succeed is
  `![<original name>](/diary/assets/images/<file name>)` inserted at the editor caret. Without a PAT the settings
  dialog opens and the upload is refused.
- **Diary publish panel** (collapsed by default) — title / category / date / slug / tags / summary →
  frontmatter + `<date>-<slug>.md` file name preview.
- **GitHub commit** — one click from the panel:
  1. when a post was loaded from GitHub, its original path is the target and the current `sha` is read first,
     so the commit overwrites that file (a confirm dialog asks before overwriting); the new `sha` from the
     response is stored for the next edit,
  2. otherwise `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}` picks up an existing `sha`
     (new file = 404, overwrite = 200),
  3. `PUT /repos/{owner}/{repo}/contents/{path}` with UTF-8 Base64 content.

## GitHub token

The PAT is stored only in this browser (`localStorage['hd2_md_pat_v1']`) and is sent only to
`api.github.com`. A fine-grained token scoped to the target repository with **Contents: Read & Write**
is enough. Reading a post list or a file from a **public** repository needs no token at all
(`Authorization` is only added when a PAT is stored). The settings dialog holds repo / branch / path prefix /
commit message too (`localStorage['hd2_md_github_v1']`).

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
