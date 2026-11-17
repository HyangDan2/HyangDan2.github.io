# PKPilot0008 — HD2Lab Markdown Viewer

Live: <https://hyangdan2.github.io/PKPilot0008/>

A read-only Markdown viewer that runs entirely in the browser. No backend, no build step.

## Input

- `.md` / `.markdown` / `.txt` file picker, and drag & drop anywhere on the page.
- Paste text into the paste dialog (also `Ctrl/⌘ + Enter` to render).
- `?url=https://…` — fetches the file and renders it. When the host does not send CORS headers the
  page explains the failure instead of silently doing nothing.
- `#md=…` / `?md=…` — share links. The document is compressed with lz-string and encoded for a URL;
  opening the link restores the same document. `공유 링크 복사` writes the link to the clipboard and
  updates the address bar with `history.replaceState`.

## Render

- markdown-it (GFM tables, strikethrough, linkify) + highlight.js, `- [ ]` / `- [x]` checkboxes.
- YAML frontmatter is parsed into the document header (title, category · date, summary, tags) and the
  first `#` heading becomes the document title. A collapsible **frontmatter meta card** lists every
  key/value pair of the block, so custom fields stay visible without entering the source.
- Every code block gets a header with a language badge and a one-click copy button.
- Headings get stable ids and feed the sticky TOC (sidebar on desktop, toggle panel on mobile).
- **Every rendered document is sanitized with DOMPurify** (`script`, `style`, `iframe`, `form`,
  `object`, `embed`, inline event handlers and `javascript:` URLs are removed).

## Output

- `인쇄 / PDF` uses `window.print()` with a dedicated `@media print` stylesheet (chrome hidden,
  paper colours, page-break hints).
- `HTML 저장` exports a standalone HTML file with the rendered document and an embedded stylesheet.

## Files

```
index.html          the page (HD2Lab header, input bar, doc layout, dialogs)
style.css           Soft Iris / Navy & Lavender tokens + document, TOC and print styles
app.js              parsing, rendering, TOC, share links, export, input handling
js/vendor/          markdown-it 14.3.3, highlight.js 11.11.1, DOMPurify 3.2.6, lz-string 1.5.0
```

Theme is the shared one: `/assets/hd2-theme.css` + `/assets/hd2-theme.js` (44px floating toggle).
