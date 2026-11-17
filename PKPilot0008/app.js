/* ==========================================================================
   HD2Lab · PKPilot0008 — Markdown Viewer
   File / paste / URL input · GFM render · TOC · code copy · print · share
   ========================================================================== */
(function () {
    'use strict';

    const SAMPLE_NAME = 'sample-markdown.md';
    const SAMPLE = [
        '---',
        'title: "Markdown Viewer 사용법"',
        'date: 2026-11-17',
        'category: notes',
        'summary: ".md 파일을 열고, 목차로 넘나들고, 코드를 복사하고, 링크 하나로 공유하기까지."',
        'tags: [markdown, viewer, hd2lab]',
        '---',
        '',
        '# 한 파일로 끝내는 기록',
        '',
        'HD2Lab의 문서는 **마크다운 한 파일**이다. 쓰는 도구는 따로, 읽는 도구는 따로 — 여기서는 읽는 쪽을 맡는다.',
        '',
        '## 이 뷰어가 하는 일',
        '',
        '- `.md` · `.markdown` · `.txt` 파일 열기와 드래그&드롭',
        '- GFM 표·체크리스트·취소선 렌더링',
        '- 제목 기반 목차와 코드 블록 복사 버튼',
        '- [x] 인쇄 / PDF 저장',
        '- [ ] 아직 안 해 본 것: 이미지 갤러리',
        '',
        '> 읽기 도구는 조용해야 한다. 문서가 앞에 있고, 기능은 뒤에 있으면 충분하다.',
        '',
        '### 지원하는 문법',
        '',
        '| 문법 | 결과 | 비고 |',
        '| --- | --- | --- |',
        '| 표 | GFM 파이프 표 | 가로 스크롤 지원 |',
        '| 체크리스트 | `- [x]` | 읽기 전용 |',
        '| 취소선 | ~~지운 문장~~ | `~~` |',
        '',
        '### 코드',
        '',
        '```js',
        "const viewer = new MarkdownViewer({ sanitize: true });",
        "viewer.render('# hello');",
        '```',
        '',
        '```css',
        '.markdown-body { line-height: 1.95; }',
        '```',
        '',
        '## 공유와 인쇄',
        '',
        '`공유 링크 복사`를 누르면 문서가 압축되어 URL에 담긴다. 같은 링크를 열면 같은 문서가 그대로 복원된다. 인쇄는 브라우저의 PDF 저장으로 이어진다.',
        '',
        '---',
        '',
        '끝.',
    ].join('\n');

    const $ = (id) => document.getElementById(id);
    const el = {
        article: $('article'),
        doc: $('doc'),
        docHead: $('docHead'),
        docTitle: $('docTitle'),
        docEyebrow: $('docEyebrow'),
        docSummary: $('docSummary'),
        docTags: $('docTags'),
        fmCard: $('fmCard'),
        fmList: $('fmList'),
        fmHint: $('fmHint'),
        fileName: $('fileName'),
        docSource: $('docSource'),
        statWords: $('statWords'),
        statChars: $('statChars'),
        statRead: $('statRead'),
        tocPanel: $('tocPanel'),
        tocNav: $('tocNav'),
        btnToc: $('btnToc'),
        btnTocClose: $('btnTocClose'),
        fileInput: $('fileInput'),
        urlInput: $('urlInput'),
        dropHint: $('dropHint'),
        pasteDialog: $('pasteDialog'),
        pasteArea: $('pasteArea'),
        toast: $('toast'),
        srStatus: $('srStatus'),
    };

    const state = {
        name: SAMPLE_NAME,
        source: '',
        markdown: '',
        observer: null,
    };

    /* ---------------------------------------------------------------- markdown */
    const md = window.markdownit({
        html: true,
        linkify: true,
        typographer: true,
        highlight(code, language) {
            const lang = String(language || '').trim().toLowerCase();
            if (lang && window.hljs && window.hljs.getLanguage(lang)) {
                try {
                    return wrapCode(window.hljs.highlight(code, { language: lang, ignoreIllegals: true }).value, lang);
                } catch (error) { /* fall through */ }
            }
            return wrapCode(md.utils.escapeHtml(code), lang || 'text');
        },
    });

    function wrapCode(inner, lang) {
        const label = md.utils.escapeHtml(lang || 'text');
        return `<pre class="code-block" data-lang="${label}"><code class="hljs language-${label}">${inner}</code></pre>`;
    }

    function taskLists(instance) {
        instance.core.ruler.after('inline', 'gfm-task-lists', (mdState) => {
            const tokens = mdState.tokens;
            for (let i = 2; i < tokens.length; i += 1) {
                const token = tokens[i];
                if (token.type !== 'inline') continue;
                if (!tokens[i - 1] || tokens[i - 1].type !== 'paragraph_open') continue;
                if (!tokens[i - 2] || tokens[i - 2].type !== 'list_item_open') continue;
                const match = /^\[([ xX])\][ \t]+/.exec(token.content);
                if (!match) continue;
                const checked = match[1].toLowerCase() === 'x';
                token.content = token.content.slice(match[0].length);
                const parsed = instance.parseInline(token.content, mdState.env);
                token.children = parsed[0] ? parsed[0].children : [];
                const box = new mdState.Token('html_inline', '', 0);
                box.content = `<input type="checkbox" disabled${checked ? ' checked' : ''}> `;
                token.children.unshift(box);
                tokens[i - 2].attrJoin('class', 'task-item');
                for (let j = i - 3; j >= 0; j -= 1) {
                    if (tokens[j].type === 'bullet_list_open') { tokens[j].attrJoin('class', 'task-list'); break; }
                }
            }
        });
    }
    md.use(taskLists);
    md.renderer.rules.table_open = () => '<div class="table-wrap"><table>';
    md.renderer.rules.table_close = () => '</table></div>';
    const linkOpen = md.renderer.rules.link_open;
    md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
        const href = tokens[idx].attrGet('href') || '';
        if (/^https?:/i.test(href)) {
            tokens[idx].attrSet('target', '_blank');
            tokens[idx].attrSet('rel', 'noopener noreferrer');
        }
        return linkOpen ? linkOpen(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
    };

    function sanitize(html) {
        if (!window.DOMPurify) return html;
        return window.DOMPurify.sanitize(html, {
            ADD_ATTR: ['target', 'checked', 'disabled'],
            FORBID_TAGS: ['style', 'form', 'iframe', 'object', 'embed', 'base', 'link', 'meta'],
            FORBID_ATTR: ['onerror', 'onload', 'onclick', 'style'],
        });
    }

    /* ---------------------------------------------------------------- frontmatter */
    function parseFrontmatter(text) {
        const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
        if (!match) return { data: null, body: text };
        const data = {};
        match[1].split(/\r?\n/).forEach((line) => {
            const hit = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
            if (!hit) return;
            let value = hit[2].trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (/^\[.*\]$/.test(value)) {
                value = value.slice(1, -1).split(',').map((item) => item.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
            }
            data[hit[1]] = value;
        });
        return { data, body: text.slice(match[0].length) };
    }

    /* ---------------------------------------------------------------- utils */
    function slug(text) {
        return String(text || '')
            .toLowerCase()
            .trim()
            .replace(/[^\w가-힣\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-{2,}/g, '-')
            .slice(0, 60) || 'section';
    }

    function toast(message, kind) {
        el.toast.innerHTML = message;
        el.toast.className = 'toast' + (kind === 'err' ? ' is-err' : kind === 'ok' ? ' is-ok' : '');
        el.toast.hidden = false;
        window.clearTimeout(toast._timer);
        toast._timer = window.setTimeout(() => { el.toast.hidden = true; }, 4200);
    }

    function announce(message) {
        el.srStatus.textContent = message;
    }

    async function copyText(text, message) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                const helper = document.createElement('textarea');
                helper.value = text;
                helper.setAttribute('readonly', '');
                helper.style.position = 'fixed';
                helper.style.top = '-1000px';
                document.body.appendChild(helper);
                helper.select();
                document.execCommand('copy');
                helper.remove();
            }
            toast(message, 'ok');
        } catch (error) {
            toast('복사에 실패했다. 브라우저 권한을 확인해 달라.', 'err');
        }
    }

    function download(name, content, type) {
        const blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    /* ---------------------------------------------------------------- render */
    function renderDocument(text, name, source) {
        const parsed = parseFrontmatter(String(text || ''));
        const data = parsed.data || {};
        const html = sanitize(md.render(parsed.body));

        el.article.innerHTML = html;
        state.markdown = text;
        state.name = name || SAMPLE_NAME;
        state.source = source || '';

        /* first h1 becomes the document title */
        const firstHeading = el.article.querySelector('h1');
        let bodyTitle = '';
        if (firstHeading) {
            bodyTitle = firstHeading.textContent.trim();
            firstHeading.remove();
        }

        const title = (typeof data.title === 'string' && data.title.trim()) || bodyTitle || state.name;
        el.docTitle.textContent = title;
        document.title = `${title} · HD2Lab Markdown Viewer`;

        const eyebrowParts = [];
        if (data.category) eyebrowParts.push(String(data.category).toUpperCase());
        if (data.date) eyebrowParts.push(String(data.date));
        if (!eyebrowParts.length) eyebrowParts.push('MARKDOWN');
        el.docEyebrow.textContent = eyebrowParts.join(' · ');

        const summary = typeof data.summary === 'string' ? data.summary : '';
        el.docSummary.textContent = summary;
        el.docSummary.hidden = !summary;

        const tags = Array.isArray(data.tags) ? data.tags : (data.tags ? String(data.tags).split(',').map((t) => t.trim()) : []);
        el.docTags.innerHTML = tags.filter(Boolean).map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join('');

        paintFrontmatterCard(data);

        el.fileName.textContent = state.name;
        el.docSource.textContent = state.source ? sourceLabel(state.source) : '';

        /* code blocks → header bar with language + copy */
        el.article.querySelectorAll('pre.code-block').forEach((pre) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'md-code';
            const head = document.createElement('div');
            head.className = 'md-code-head';
            const lang = pre.getAttribute('data-lang') || 'text';
            head.innerHTML = `<span class="md-code-lang">${escapeHtml(lang)}</span><button type="button" class="md-copy" data-copy="${escapeHtml(pre.textContent)}">복사</button>`;
            pre.removeAttribute('data-lang');
            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(head);
            wrapper.appendChild(pre);
        });
        el.article.querySelectorAll('.md-copy').forEach((button) => {
            button.addEventListener('click', async () => {
                await copyText(button.dataset.copy || '', '코드를 복사했다.');
                button.textContent = '복사됨';
                button.classList.add('is-done');
                window.setTimeout(() => { button.textContent = '복사'; button.classList.remove('is-done'); }, 1800);
            });
        });

        buildToc();
        paintStats(parsed.body);
        highlightActive();

        /* a new document replaces whatever the share link pointed to */
        if (location.hash.indexOf('#md=') === 0 && source !== '공유 링크') {
            try { history.replaceState(null, '', location.pathname + location.search); } catch (error) { /* ignore */ }
        }
    }

    function paintFrontmatterCard(data) {
        const keys = Object.keys(data || {}).filter((key) => {
            const value = data[key];
            return value !== '' && value != null && !(Array.isArray(value) && value.length === 0);
        });
        if (!keys.length) {
            el.fmCard.hidden = true;
            el.fmList.innerHTML = '';
            el.fmHint.textContent = '';
            return;
        }
        el.fmList.innerHTML = keys.map((key) => {
            const value = data[key];
            const text = Array.isArray(value) ? value.join(', ') : String(value);
            return `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(text)}</dd>`;
        }).join('');
        el.fmHint.textContent = `${keys.length} field${keys.length === 1 ? '' : 's'}`;
        el.fmCard.hidden = false;
        el.fmCard.open = false;
    }

    function sourceLabel(source) {
        try {
            const url = new URL(source);
            return url.hostname + url.pathname.slice(0, 40);
        } catch (error) {
            return source;
        }
    }

    function escapeHtml(value) {
        return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function paintStats(body) {
        const text = String(body || '');
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        el.statWords.textContent = words.toLocaleString('ko-KR');
        el.statChars.textContent = text.length.toLocaleString('ko-KR');
        el.statRead.textContent = String(Math.max(1, Math.round(words / 350)));
    }

    /* ---------------------------------------------------------------- toc */
    function buildToc() {
        if (state.observer) state.observer.disconnect();
        const headings = Array.from(el.article.querySelectorAll('h1, h2, h3, h4'));
        if (!headings.length) {
            el.tocNav.innerHTML = '<p class="toc-empty">제목이 없어 목차가 비어 있다.</p>';
            return;
        }
        const used = new Set();
        const items = headings.map((heading) => {
            let id = slug(heading.textContent);
            let candidate = id;
            let index = 2;
            while (used.has(candidate)) { candidate = `${id}-${index}`; index += 1; }
            used.add(candidate);
            heading.id = candidate;
            return { id: candidate, level: Number(heading.tagName.slice(1)), text: heading.textContent.trim() };
        });

        const list = document.createElement('ul');
        list.className = 'toc-list';
        const stack = [{ level: 0, list }];
        items.forEach((item) => {
            while (stack.length > 1 && item.level < stack[stack.length - 1].level) stack.pop();
            if (item.level > stack[stack.length - 1].level && stack[stack.length - 1].list.lastElementChild) {
                const sub = document.createElement('ul');
                sub.className = 'toc-list';
                stack[stack.length - 1].list.lastElementChild.appendChild(sub);
                stack.push({ level: item.level, list: sub });
            }
            const li = document.createElement('li');
            const link = document.createElement('a');
            link.className = 'toc-link';
            link.href = `#${item.id}`;
            link.dataset.level = String(item.level);
            link.dataset.target = item.id;
            link.textContent = item.text;
            link.addEventListener('click', () => {
                if (window.matchMedia('(max-width: 1000px)').matches) el.tocPanel.classList.remove('is-open');
            });
            li.appendChild(link);
            stack[stack.length - 1].list.appendChild(li);
        });
        el.tocNav.innerHTML = '';
        el.tocNav.appendChild(list);

        if ('IntersectionObserver' in window) {
            state.observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    document.querySelectorAll('.toc-link').forEach((link) => {
                        link.classList.toggle('is-active', link.dataset.target === entry.target.id);
                    });
                });
            }, { rootMargin: '-96px 0px -70% 0px', threshold: 0 });
            headings.forEach((heading) => state.observer.observe(heading));
        }
    }

    function highlightActive() {
        const first = document.querySelector('.toc-link');
        if (first) first.classList.add('is-active');
    }

    /* ---------------------------------------------------------------- inputs */
    function readFile(file) {
        if (!file) return;
        const okName = /\.(md|markdown|mdown|txt)$/i.test(file.name);
        const okType = /^text\//i.test(file.type || '');
        if (!okName && !okType) {
            toast('.md · .markdown · .txt 파일만 열 수 있다.', 'err');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            renderDocument(String(reader.result || ''), file.name, '');
            announce(`${file.name} 문서를 열었다.`);
            toast(`${file.name} 열기 완료`, 'ok');
        };
        reader.onerror = () => toast('파일을 읽지 못했다.', 'err');
        reader.readAsText(file, 'utf-8');
    }

    async function loadFromUrl(rawUrl) {
        const value = String(rawUrl || '').trim();
        if (!value) { toast('불러올 URL을 입력해 달라.', 'err'); return; }
        if (!/^https?:\/\//i.test(value)) { toast('http(s) URL만 불러올 수 있다.', 'err'); return; }
        toast('불러오는 중…');
        try {
            const response = await fetch(value, { mode: 'cors' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            const name = decodeURIComponent((new URL(value).pathname.split('/').pop() || 'remote.md'));
            renderDocument(text, name, value);
            el.urlInput.value = value;
            toast('URL 문서를 열었다.', 'ok');
            announce('URL 문서를 열었다.');
        } catch (error) {
            toast(`불러오지 못했다 (${escapeHtml(error.message)}). 이 사이트가 CORS를 허용하지 않으면 파일로 내려받아 열거나 본문을 붙여넣어 달라.`, 'err');
        }
    }

    /* ---------------------------------------------------------------- share */
    function buildShareLink() {
        if (!window.LZString) return null;
        const packed = window.LZString.compressToEncodedURIComponent(state.markdown || '');
        return { url: `${location.origin}${location.pathname}#md=${packed}`, length: packed.length };
    }

    async function shareLink() {
        const link = buildShareLink();
        if (!link) { toast('공유 링크를 만들 수 없다 (압축 라이브러리 없음).', 'err'); return; }
        if (link.length > 12000) {
            toast('문서가 너무 커서 URL에 담기 어렵다. 파일이나 .md로 공유해 달라.', 'err');
            return;
        }
        try {
            history.replaceState(null, '', link.url);
        } catch (error) { /* ignore */ }
        await copyText(link.url, '공유 링크를 복사했다.');
        announce('공유 링크를 복사했다.');
    }

    function readShareParams() {
        const hash = location.hash || '';
        if (hash.startsWith('#md=')) {
            const packed = hash.slice(4);
            if (window.LZString) {
                const text = window.LZString.decompressFromEncodedURIComponent(packed);
                if (text) return { text, name: 'shared-document.md', source: '공유 링크' };
            }
        }
        const params = new URLSearchParams(location.search);
        if (params.get('md') && window.LZString) {
            const text = window.LZString.decompressFromEncodedURIComponent(params.get('md'));
            if (text) return { text, name: 'shared-document.md', source: '공유 링크' };
        }
        if (params.get('url')) return { url: params.get('url') };
        return null;
    }

    /* ---------------------------------------------------------------- export */
    function exportHtml() {
        const clone = el.article.cloneNode(true);
        clone.querySelectorAll('.md-code-head').forEach((node) => node.remove());
        const title = el.docTitle.textContent || 'HD2Lab Document';
        const html = standalone(title, clone.innerHTML);
        download(`${slug(title) || 'document'}.html`, html, 'text/html;charset=utf-8');
        toast('HTML 파일을 내려받았다.', 'ok');
    }

    function standalone(title, bodyHtml) {
        const safeTitle = escapeHtml(title);
        return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
<style>
:root{color-scheme:light dark;--bg:#FAFAFD;--fg:#1D192B;--body:#3F3950;--accent:#8B6CE8;--line:#E8E4F2;--soft:#F7F5FE}
@media (prefers-color-scheme:dark){:root{--bg:#0B1020;--fg:#EEF2FF;--body:#C6D0E9;--accent:#A78BFA;--line:#253154;--soft:#1A2340}}
*{box-sizing:border-box}
body{margin:0;padding:48px 20px 72px;background:var(--bg);color:var(--body);font:16px/1.9 system-ui,-apple-system,"Pretendard","Segoe UI","Apple SD Gothic Neo",sans-serif}
main{max-width:760px;margin:0 auto}
h1,h2,h3,h4{color:var(--fg);line-height:1.3;letter-spacing:-.03em;margin:34px 0 12px}
h1{font-size:30px}h2{font-size:23px;padding-top:16px;border-top:1px solid var(--line)}h3{font-size:19px}
p{margin:0 0 15px}a{color:var(--accent)}
ul,ol{padding-left:22px}li{margin-bottom:6px}
blockquote{margin:20px 0;padding:4px 0 4px 16px;border-left:3px solid var(--accent);color:var(--fg)}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.86em;padding:2px 6px;border:1px solid var(--line);border-radius:4px;background:var(--soft)}
pre{margin:20px 0;padding:16px;border:1px solid var(--line);border-radius:6px;background:var(--soft);overflow-x:auto;font-size:12.5px;line-height:1.7}
pre code{padding:0;border:none;background:none}
.md-code{margin:20px 0;border:1px solid var(--line);border-radius:6px;overflow:hidden}
.md-code .code-block{margin:0;border:none;border-radius:0}
img{max-width:100%;height:auto;border:1px solid var(--line);border-radius:6px}
table{width:100%;border-collapse:collapse;font-size:13px;margin:20px 0}
th,td{padding:9px 12px;border-bottom:1px solid var(--line);text-align:left}
th{color:var(--accent);font-size:11px;letter-spacing:.08em;text-transform:uppercase}
.table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:6px}
hr{border:0;height:1px;background:var(--line);margin:28px 0}
input[type=checkbox]{accent-color:var(--accent)}
footer{margin:56px auto 0;max-width:760px;color:#8B8598;font-size:11px;letter-spacing:.14em;text-transform:uppercase;border-top:1px solid var(--line);padding-top:18px}
@media print{body{padding:0;background:#fff;color:#000}footer{display:none}pre,table{break-inside:avoid}}
</style>
</head>
<body>
<main>
${bodyHtml}
</main>
<footer>HD2Lab · Markdown Viewer</footer>
</body>
</html>
`;
    }

    /* ---------------------------------------------------------------- view controls */
    function clearDocument() {
        state.markdown = '';
        state.name = '문서 없음';
        state.source = '';
        el.article.innerHTML = '<p class="toc-empty" style="color:var(--text-secondary);font-size:13px">열린 문서가 없다. <strong>파일 열기</strong>로 .md를 고르거나, <strong>텍스트 붙여넣기</strong>로 본문을 넣어 달라.</p>';
        el.docTitle.textContent = '문서 없음';
        el.docEyebrow.textContent = 'MARKDOWN';
        el.docSummary.hidden = true;
        el.docTags.innerHTML = '';
        el.fmCard.hidden = true;
        el.fmList.innerHTML = '';
        el.fmHint.textContent = '';
        el.fileName.textContent = '문서 없음';
        el.docSource.textContent = '';
        el.tocNav.innerHTML = '<p class="toc-empty">제목이 있는 문서를 열면 목차가 만들어진다.</p>';
        el.statWords.textContent = '0';
        el.statChars.textContent = '0';
        el.statRead.textContent = '0';
        document.title = 'HD2Lab | Markdown Viewer';
        try { history.replaceState(null, '', location.pathname); } catch (error) { /* ignore */ }
        toast('문서를 닫았다.');
    }

    function wireEvents() {
        $('btnOpenFile').addEventListener('click', () => el.fileInput.click());
        el.fileInput.addEventListener('change', (event) => {
            readFile(event.target.files && event.target.files[0]);
            event.target.value = '';
        });
        $('btnSample').addEventListener('click', () => {
            renderDocument(SAMPLE, SAMPLE_NAME, '');
            toast('샘플 문서를 열었다.', 'ok');
        });
        $('btnPaste').addEventListener('click', () => {
            if (typeof el.pasteDialog.showModal === 'function') el.pasteDialog.showModal();
            else el.pasteDialog.setAttribute('open', '');
            el.pasteArea.focus();
        });
        $('btnPasteRender').addEventListener('click', () => {
            const text = el.pasteArea.value;
            if (!text.trim()) { toast('붙여넣은 내용이 없다.', 'err'); return; }
            renderDocument(text, 'pasted.md', '');
            if (el.pasteDialog.open) el.pasteDialog.close();
            toast('붙여넣은 문서를 읽었다.', 'ok');
        });
        el.pasteArea.addEventListener('keydown', (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                $('btnPasteRender').click();
            }
        });
        $('btnLoadUrl').addEventListener('click', () => loadFromUrl(el.urlInput.value));
        el.urlInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') { event.preventDefault(); loadFromUrl(el.urlInput.value); }
        });
        $('btnShare').addEventListener('click', shareLink);
        $('btnPrint').addEventListener('click', () => window.print());
        $('btnExport').addEventListener('click', exportHtml);
        $('btnClear').addEventListener('click', clearDocument);
        el.btnToc.addEventListener('click', () => {
            const open = el.tocPanel.classList.toggle('is-open');
            el.btnToc.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (open) el.tocPanel.scrollIntoView({ block: 'start', behavior: 'smooth' });
        });
        el.btnTocClose.addEventListener('click', () => el.tocPanel.classList.remove('is-open'));

        /* drag & drop anywhere */
        let depth = 0;
        window.addEventListener('dragenter', (event) => {
            if (!event.dataTransfer || !Array.from(event.dataTransfer.types || []).includes('Files')) return;
            depth += 1;
            el.dropHint.hidden = false;
        });
        window.addEventListener('dragover', (event) => {
            if (event.dataTransfer) event.preventDefault();
        });
        window.addEventListener('dragleave', () => {
            depth = Math.max(0, depth - 1);
            if (!depth) el.dropHint.hidden = true;
        });
        window.addEventListener('drop', (event) => {
            if (!event.dataTransfer) return;
            event.preventDefault();
            depth = 0;
            el.dropHint.hidden = true;
            const file = event.dataTransfer.files && event.dataTransfer.files[0];
            readFile(file);
        });
    }

    function boot() {
        if (!window.markdownit) {
            el.article.innerHTML = '<p>렌더러를 불러오지 못했다. 새로고침해 달라.</p>';
            return;
        }
        wireEvents();
        const shared = readShareParams();
        if (shared && shared.text) {
            renderDocument(shared.text, shared.name, shared.source);
            toast('공유 링크의 문서를 복원했다.', 'ok');
        } else if (shared && shared.url) {
            el.urlInput.value = shared.url;
            loadFromUrl(shared.url);
        } else {
            renderDocument(SAMPLE, SAMPLE_NAME, '');
        }
        el.btnToc.setAttribute('aria-expanded', 'false');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    /* exposed for tests */
    window.HD2Viewer = {
        renderDocument,
        parseFrontmatter,
        buildShareLink,
        sanitize,
        readFile,
        loadFromUrl,
        clearDocument,
        state,
    };
})();
