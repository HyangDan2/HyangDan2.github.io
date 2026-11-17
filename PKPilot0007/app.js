/* ==========================================================================
   HD2Lab · PKPilot0007 — Markdown Editor
   GFM preview · autosave · export · Diary frontmatter · GitHub commit
   ========================================================================== */
(function () {
    'use strict';

    /* ---------------------------------------------------------------- constants */
    const DRAFT_KEY = 'hd2_md_editor_v1';
    const GH_KEY = 'hd2_md_github_v1';
    const PAT_KEY = 'hd2_md_pat_v1';
    const DEFAULT_GH = {
        repo: 'HyangDan2/HyangDan2.github.io',
        branch: 'main',
        path: 'diary-src/posts/',
        message: 'post: HD2Lab diary',
    };
    const CATEGORIES = ['devlog', 'architecture', 'troubleshooting', 'notes'];

    const SAMPLE = [
        '# 마크다운으로 기록하기',
        '',
        'HD2Lab의 글은 **마크다운 한 파일**로 끝납니다. 여기서 쓰고, 확인하고, 그대로 커밋합니다.',
        '',
        '## 왜 브라우저에서 쓸까요',
        '',
        '- 서버가 없습니다 — 모든 변환이 이 페이지 안에서 일어납니다',
        '- 초안은 자동 저장됩니다',
        '- [x] 실시간 미리보기',
        '- [ ] Diary frontmatter 자동 생성',
        '',
        '> 문장은 짧게, 근거는 길게.',
        '',
        '| 항목 | 값 |',
        '| --- | --- |',
        '| 렌더러 | markdown-it 14 |',
        '| 하이라이트 | highlight.js 11 |',
        '',
        '```js',
        "const md = markdownit({ html: true, linkify: true });",
        "console.log(md.render('# hello'));",
        '```',
    ].join('\n');

    /* ---------------------------------------------------------------- dom */
    const $ = (id) => document.getElementById(id);
    const el = {
        editor: $('editor'),
        preview: $('preview'),
        panes: $('panes'),
        docFileName: $('docFileName'),
        wordCount: $('wordCount'),
        charCount: $('charCount'),
        saveState: $('saveState'),
        toast: $('toast'),
        publishPanel: $('publishPanel'),
        fmTitle: $('fmTitle'),
        fmCategory: $('fmCategory'),
        fmDate: $('fmDate'),
        fmSlug: $('fmSlug'),
        fmTags: $('fmTags'),
        fmSummary: $('fmSummary'),
        fmFilename: $('fmFilename'),
        fmFrontmatter: $('fmFrontmatter'),
        publishStatus: $('publishStatus'),
        ghNewFile: $('ghNewFile'),
        ghDialog: $('ghSettings'),
        ghRepo: $('ghRepo'),
        ghBranch: $('ghBranch'),
        ghPath: $('ghPath'),
        ghMessage: $('ghMessage'),
        ghToken: $('ghToken'),
        ghState: $('ghState'),
    };

    const state = {
        mode: 'split',
        savedAt: 0,
        saving: false,
        dirty: false,
        committing: false,
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

    /* GFM task lists (markdown-it has tables + strikethrough built in; checkboxes do not) */
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
                    if (tokens[j].type === 'bullet_list_open') {
                        tokens[j].attrJoin('class', 'task-list');
                        break;
                    }
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

    function renderMarkdown(text) {
        const raw = md.render(text || '');
        if (window.DOMPurify) {
            return window.DOMPurify.sanitize(raw, { ADD_ATTR: ['target', 'checked', 'disabled'] });
        }
        return raw;
    }

    /* ---------------------------------------------------------------- utils */
    function pad(value) { return String(value).padStart(2, '0'); }

    function todayKst() {
        const now = new Date();
        return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    }

    function timeLabel(date) {
        return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    function slugify(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/['"’`]/g, '')
            .replace(/[^a-z0-9가-힣]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .replace(/-{2,}/g, '-')
            .slice(0, 60);
    }

    function tagList() {
        return el.fmTags.value
            .split(',')
            .map((tag) => tag.trim().replace(/^#/, ''))
            .filter(Boolean);
    }

    function yamlString(value) {
        return '"' + String(value == null ? '' : value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n+/g, ' ').trim() + '"';
    }

    function currentSlug() {
        const typed = slugify(el.fmSlug.value);
        if (typed) return typed;
        return slugify(el.fmTitle.value) || `post-${(el.fmDate.value || todayKst()).replace(/-/g, '')}`;
    }

    function currentFileName() {
        return `${el.fmDate.value || todayKst()}-${currentSlug()}.md`;
    }

    function hasDiaryFields() {
        return Boolean(el.fmTitle.value.trim() || el.fmSlug.value.trim());
    }

    function buildFrontmatter() {
        const tags = tagList();
        const lines = [
            '---',
            `title: ${yamlString(el.fmTitle.value.trim() || '제목 없음')}`,
            `date: ${el.fmDate.value || todayKst()}`,
            `category: ${yamlString(el.fmCategory.value || CATEGORIES[0])}`,
        ];
        const summary = el.fmSummary.value.trim();
        if (summary) lines.push(`summary: ${yamlString(summary)}`);
        lines.push(`tags: [${tags.map(yamlString).join(', ')}]`);
        lines.push('layout: post');
        lines.push('---');
        return lines.join('\n');
    }

    function bodyText() {
        return el.editor.value.replace(/\s+$/, '');
    }

    function fullMarkdown() {
        const body = bodyText();
        if (!hasDiaryFields()) return body ? `${body}\n` : '';
        return `${buildFrontmatter()}\n\n${body}\n`;
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
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    async function copyText(text, okMessage) {
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
            toast(okMessage || '복사했습니다.');
        } catch (error) {
            toast('복사에 실패했습니다. 브라우저 권한을 확인해 주세요.', 'err');
        }
    }

    let toastTimer = 0;
    function toast(message, kind) {
        el.toast.innerHTML = message;
        el.toast.className = 'toast' + (kind === 'err' ? ' is-err' : kind === 'ok' ? ' is-ok' : '');
        el.toast.hidden = false;
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => { el.toast.hidden = true; }, 4200);
    }

    function setStatus(node, message, kind) {
        node.innerHTML = message;
        node.classList.toggle('is-ok', kind === 'ok');
        node.classList.toggle('is-warn', kind === 'warn');
        node.classList.toggle('is-err', kind === 'err');
    }

    /* ---------------------------------------------------------------- preview + counters */
    let renderTimer = 0;
    function scheduleRender() {
        window.clearTimeout(renderTimer);
        renderTimer = window.setTimeout(paintPreview, 120);
    }

    function paintPreview() {
        el.preview.innerHTML = renderMarkdown(el.editor.value);
    }

    function paintCounts() {
        const text = el.editor.value;
        /* count prose tokens, not markdown punctuation */
        const prose = text
            .replace(/^\s{0,3}(#{1,6}|[-*+]|\d+[.)])\s+/gm, '')
            .replace(/\[[ xX]\]/g, ' ')
            .replace(/[>*_`~|]/g, ' ')
            .trim();
        const words = prose ? prose.split(/\s+/).filter(Boolean).length : 0;
        el.wordCount.textContent = words.toLocaleString('ko-KR');
        el.charCount.textContent = text.length.toLocaleString('ko-KR');
    }

    function paintFileName() {
        el.docFileName.textContent = hasDiaryFields() ? currentFileName() : 'untitled.md';
    }

    /* ---------------------------------------------------------------- autosave */
    let saveTimer = 0;
    function scheduleSave() {
        state.dirty = true;
        el.saveState.textContent = '저장 중…';
        el.saveState.classList.remove('is-ok');
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(saveDraft, 520);
    }

    function saveDraft() {
        const payload = {
            body: el.editor.value,
            updatedAt: Date.now(),
            diary: {
                title: el.fmTitle.value,
                category: el.fmCategory.value,
                date: el.fmDate.value,
                slug: el.fmSlug.value,
                tags: el.fmTags.value,
                summary: el.fmSummary.value,
            },
            mode: state.mode,
        };
        try {
            window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
            state.savedAt = Date.now();
            state.dirty = false;
            el.saveState.textContent = `자동 저장됨 · ${timeLabel(new Date(state.savedAt))}`;
            el.saveState.classList.add('is-ok');
        } catch (error) {
            el.saveState.textContent = '자동 저장할 수 없습니다 (저장 공간 부족)';
            el.saveState.classList.add('is-warn');
        }
    }

    function loadDraft() {
        let stored = null;
        try {
            stored = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
        } catch (error) {
            stored = null;
        }
        el.fmDate.value = todayKst();
        if (stored && typeof stored.body === 'string' && stored.body.trim()) {
            el.editor.value = stored.body;
            const diary = stored.diary || {};
            el.fmTitle.value = diary.title || '';
            if (CATEGORIES.indexOf(diary.category) !== -1) el.fmCategory.value = diary.category;
            el.fmDate.value = diary.date || todayKst();
            el.fmSlug.value = diary.slug || '';
            el.fmTags.value = diary.tags || '';
            el.fmSummary.value = diary.summary || '';
            if (stored.updatedAt) {
                el.saveState.textContent = `초안 복원됨 · ${timeLabel(new Date(stored.updatedAt))}`;
                el.saveState.classList.add('is-ok');
            }
        } else {
            el.editor.value = SAMPLE;
            el.saveState.textContent = '샘플 문서로 시작했습니다. 지우고 쓰면 됩니다.';
        }
    }

    /* ---------------------------------------------------------------- view modes */
    function setMode(mode) {
        const narrow = window.matchMedia('(max-width: 900px)').matches;
        let next = mode;
        if (narrow && next === 'split') next = 'edit';
        state.mode = next;
        el.panes.className = 'panes mode-' + next;
        document.querySelectorAll('.view-tab').forEach((tab) => {
            const active = tab.dataset.view === mode || (narrow && tab.dataset.view === next);
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        const splitTab = $('tab-split');
        if (splitTab) splitTab.hidden = narrow;
    }

    /* ---------------------------------------------------------------- editing helpers */
    function focusEditor() {
        el.editor.focus();
    }

    function replaceSelection(before, after, placeholder) {
        const textarea = el.editor;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        const selected = value.slice(start, end) || placeholder || '';
        const insert = before + selected + (after || '');
        textarea.value = value.slice(0, start) + insert + value.slice(end);
        const caretStart = start + before.length;
        textarea.selectionStart = caretStart;
        textarea.selectionEnd = caretStart + selected.length;
        focusEditor();
        onInput();
    }

    function prefixLines(prefix, numbered) {
        const textarea = el.editor;
        const value = textarea.value;
        let start = value.lastIndexOf('\n', textarea.selectionStart - 1) + 1;
        let end = value.indexOf('\n', textarea.selectionEnd);
        if (end === -1) end = value.length;
        const block = value.slice(start, end);
        const lines = block.split('\n');
        const changed = lines
            .map((line, index) => (numbered ? `${index + 1}. ${line.replace(/^\s*(\d+[.)]|[-*+])\s+/, '')}` : `${prefix}${line.replace(/^\s*([-*+]|\d+[.)])\s+/, '')}`))
            .join('\n');
        textarea.value = value.slice(0, start) + changed + value.slice(end);
        textarea.selectionStart = start;
        textarea.selectionEnd = start + changed.length;
        focusEditor();
        onInput();
    }

    function insertBlock(text) {
        const textarea = el.editor;
        const start = textarea.selectionStart;
        const value = textarea.value;
        const needsLeading = start > 0 && value[start - 1] !== '\n';
        const snippet = (needsLeading ? '\n' : '') + text;
        textarea.value = value.slice(0, start) + snippet + value.slice(textarea.selectionEnd);
        const caret = start + snippet.length;
        textarea.setSelectionRange(caret, caret);
        focusEditor();
        onInput();
    }

    const ACTIONS = {
        h1: () => prefixLines('# '),
        h2: () => prefixLines('## '),
        h3: () => prefixLines('### '),
        bold: () => replaceSelection('**', '**', '굵게'),
        italic: () => replaceSelection('*', '*', '기울임'),
        strike: () => replaceSelection('~~', '~~', '취소선'),
        code: () => replaceSelection('`', '`', 'code'),
        codeblock: () => insertBlock("```js\nconsole.log('hello');\n```\n"),
        ul: () => prefixLines('- '),
        ol: () => prefixLines('', true),
        task: () => prefixLines('- [ ] '),
        quote: () => prefixLines('> '),
        link: () => replaceSelection('[', '](https://)', '링크 텍스트'),
        table: () => insertBlock('| 항목 | 값 |\n| --- | --- |\n| 예시 | 내용 |\n'),
        undo: () => {
            focusEditor();
            try { document.execCommand('undo'); } catch (error) { /* native undo only */ }
        },
    };

    /* ---------------------------------------------------------------- diary preview */
    function paintDiary() {
        el.fmFilename.textContent = currentFileName();
        el.fmFrontmatter.textContent = buildFrontmatter();
        el.ghNewFile.href = newFileUrl();
        paintFileName();
    }

    function githubSettings() {
        let stored = {};
        try {
            stored = JSON.parse(window.localStorage.getItem(GH_KEY) || '{}') || {};
        } catch (error) {
            stored = {};
        }
        return {
            repo: stored.repo || DEFAULT_GH.repo,
            branch: stored.branch || DEFAULT_GH.branch,
            path: stored.path || DEFAULT_GH.path,
            message: stored.message || DEFAULT_GH.message,
        };
    }

    function getToken() {
        try { return window.localStorage.getItem(PAT_KEY) || ''; } catch (error) { return ''; }
    }

    function newFileUrl() {
        const settings = githubSettings();
        const prefix = settings.path.replace(/^\/+|\/+$/g, '');
        return `https://github.com/${settings.repo}/new/${settings.branch}/${prefix}`;
    }

    function paintGhState() {
        const token = getToken();
        if (token) {
            el.ghState.textContent = `토큰 저장됨 · ${token.slice(0, 7)}···`;
            el.ghState.classList.add('is-ok');
            el.ghState.classList.remove('is-warn');
        } else {
            el.ghState.textContent = '토큰 없음';
            el.ghState.classList.remove('is-ok');
        }
    }

    function openSettings(reason) {
        const settings = githubSettings();
        el.ghRepo.value = settings.repo;
        el.ghBranch.value = settings.branch;
        el.ghPath.value = settings.path;
        el.ghMessage.value = settings.message;
        el.ghToken.value = getToken();
        paintGhState();
        if (reason) toast(reason, 'err');
        if (typeof el.ghDialog.showModal === 'function') {
            if (!el.ghDialog.open) el.ghDialog.showModal();
        } else {
            el.ghDialog.setAttribute('open', '');
        }
        el.ghRepo.focus();
    }

    function saveGithubSettings() {
        const repo = el.ghRepo.value.trim() || DEFAULT_GH.repo;
        const branch = el.ghBranch.value.trim() || DEFAULT_GH.branch;
        const path = el.ghPath.value.trim() || DEFAULT_GH.path;
        const message = el.ghMessage.value.trim() || DEFAULT_GH.message;
        try {
            window.localStorage.setItem(GH_KEY, JSON.stringify({ repo, branch, path, message }));
            const token = el.ghToken.value.trim();
            if (token) window.localStorage.setItem(PAT_KEY, token);
        } catch (error) {
            toast('설정을 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.', 'err');
            return;
        }
        paintGhState();
        el.ghNewFile.href = newFileUrl();
        toast('GitHub 설정을 저장했습니다.', 'ok');
        if (el.ghDialog.open) el.ghDialog.close();
        setStatus(el.publishStatus, `커밋 대상 <strong>${repo}</strong> · <code>${branch}</code> · <code>${path}</code>. 이제 <strong>GitHub에 바로 커밋</strong>을 누르면 됩니다.`, 'ok');
    }

    function forgetToken() {
        try { window.localStorage.removeItem(PAT_KEY); } catch (error) { /* ignore */ }
        el.ghToken.value = '';
        paintGhState();
        toast('저장된 토큰을 지웠습니다.');
    }

    /* ---------------------------------------------------------------- github commit */
    function utf8ToBase64(text) {
        const bytes = new TextEncoder().encode(text);
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        return window.btoa(binary);
    }

    function apiHeaders(token) {
        return {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        };
    }

    function encodePath(path) {
        return path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
    }

    async function commitToGithub() {
        if (state.committing) return;
        const token = getToken();
        if (!token) {
            setStatus(el.publishStatus, '먼저 GitHub 토큰을 등록해야 합니다. 아래 <strong>GitHub 설정</strong>에서 PAT를 저장하거나, <strong>이 글 .md 저장</strong>으로 받아 GitHub에 직접 올려도 됩니다.', 'warn');
            openSettings('GitHub PAT가 없습니다. 설정에서 한 번만 등록하면 됩니다.');
            return;
        }
        if (!bodyText().trim()) {
            setStatus(el.publishStatus, '본문이 비어 있습니다. 내용을 먼저 써 주세요.', 'err');
            return;
        }
        if (!el.fmTitle.value.trim()) {
            setStatus(el.publishStatus, 'Diary 제목이 비어 있습니다. <strong>제목</strong>을 채워야 frontmatter가 완성됩니다.', 'err');
            el.fmTitle.focus();
            return;
        }

        const settings = githubSettings();
        const fileName = currentFileName();
        const prefix = settings.path.trim().replace(/^\/+|\/+$/g, '');
        const path = prefix ? `${prefix}/${fileName}` : fileName;
        const content = fullMarkdown();
        const api = `https://api.github.com/repos/${settings.repo}/contents/${encodePath(path)}`;
        const headers = apiHeaders(token);

        state.committing = true;
        const commitButton = $('btnCommit');
        commitButton.disabled = true;
        commitButton.textContent = '커밋 중…';
        setStatus(el.publishStatus, `<code>${path}</code> 확인 중…`);

        try {
            let sha = null;
            const head = await fetch(`${api}?ref=${encodeURIComponent(settings.branch)}`, { headers });
            if (head.ok) {
                const meta = await head.json();
                sha = meta.sha;
            } else if (head.status !== 404) {
                throw new Error(describeError(head.status, '기존 파일 확인'));
            }

            const payload = {
                message: settings.message || DEFAULT_GH.message,
                content: utf8ToBase64(content),
                branch: settings.branch,
            };
            if (sha) payload.sha = sha;

            const put = await fetch(api, {
                method: 'PUT',
                headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
                body: JSON.stringify(payload),
            });

            if (!put.ok) throw new Error(describeError(put.status, sha ? '파일 덮어쓰기' : '새 파일 생성'));

            const result = await put.json();
            const url = (result.commit && result.commit.html_url) || `https://github.com/${settings.repo}/commit/${result.commit && result.commit.sha}`;
            const action = sha ? '덮어썼습니다' : '새로 만들었습니다';
            setStatus(
                el.publishStatus,
                `커밋 완료 — <code>${path}</code>를 ${action}. <a href="${url}" target="_blank" rel="noopener">커밋 ${String((result.commit && result.commit.sha) || '').slice(0, 7)} 보기 ↗</a><br>Diary 화면에 나타나려면 <code>diary-src</code> 빌드 후 <code>/diary/</code> 산출물을 함께 커밋해야 합니다.`,
                'ok'
            );
            toast(`커밋 완료 · ${path}`, 'ok');
        } catch (error) {
            setStatus(el.publishStatus, `${escapeHtml(error.message)}<br>토큰 권한(Contents: Read &amp; Write)과 저장소 이름을 확인해 주세요.`, 'err');
            toast(error.message, 'err');
        } finally {
            state.committing = false;
            commitButton.disabled = false;
            commitButton.textContent = 'GitHub에 바로 커밋';
        }
    }

    function describeError(status, stage) {
        const map = {
            401: '토큰이 유효하지 않습니다 (401).',
            403: '권한이 없습니다 (403). Fine-grained 토큰에 Contents: Read & Write를 줘야 합니다.',
            404: '저장소나 경로를 찾지 못했습니다 (404). 저장소 이름·브랜치를 확인해 주세요.',
            409: '동시에 수정됐습니다 (409). 잠시 뒤 다시 시도해 주세요.',
            422: '요청이 거부됐습니다 (422). 경로나 브랜치가 올바른지 확인해 주세요.',
        };
        return map[status] ? `${stage} 실패 — ${map[status]}` : `${stage} 실패 — HTTP ${status}`;
    }

    function escapeHtml(value) {
        return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* ---------------------------------------------------------------- html export */
    function standaloneHtml(title, bodyHtml) {
        const safeTitle = escapeHtml(title || 'HD2Lab Document');
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
pre{position:relative;margin:20px 0;padding:34px 16px 16px;border:1px solid var(--line);border-radius:6px;background:var(--soft);overflow-x:auto;font-size:12.5px;line-height:1.7}
pre::before{content:attr(data-lang);position:absolute;top:10px;right:13px;color:var(--accent);font-size:9px;letter-spacing:.16em;text-transform:uppercase}
pre code{padding:0;border:none;background:none}
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
<footer>HD2Lab · Markdown Editor</footer>
</body>
</html>
`;
    }

    /* ---------------------------------------------------------------- handlers */
    function onInput() {
        paintPreview();
        paintCounts();
        paintDiary();
        scheduleSave();
    }

    function wireToolbar() {
        document.querySelectorAll('.tool[data-act]').forEach((button) => {
            button.addEventListener('click', () => {
                const action = ACTIONS[button.dataset.act];
                if (action) action();
            });
        });
    }

    function wireViews() {
        document.querySelectorAll('.view-tab').forEach((tab) => {
            tab.addEventListener('click', () => setMode(tab.dataset.view));
        });
        window.addEventListener('resize', () => setMode(state.mode));
    }

    function wireKeys() {
        el.editor.addEventListener('keydown', (event) => {
            const meta = event.metaKey || event.ctrlKey;
            if (meta && !event.altKey) {
                const key = event.key.toLowerCase();
                const map = { b: 'bold', i: 'italic', k: 'link' };
                if (map[key]) {
                    event.preventDefault();
                    ACTIONS[map[key]]();
                    return;
                }
                if (key === 's') {
                    event.preventDefault();
                    downloadPost();
                    return;
                }
                if (key === '1' || key === '2' || key === '3') {
                    event.preventDefault();
                    ACTIONS['h' + key]();
                    return;
                }
            }
            if (event.key === 'Tab') {
                event.preventDefault();
                const start = el.editor.selectionStart;
                const end = el.editor.selectionEnd;
                const value = el.editor.value;
                if (start !== end && value.slice(start, end).includes('\n')) {
                    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
                    const block = value.slice(lineStart, end);
                    const shifted = block.split('\n').map((line) => '  ' + line).join('\n');
                    el.editor.value = value.slice(0, lineStart) + shifted + value.slice(end);
                    el.editor.selectionStart = lineStart;
                    el.editor.selectionEnd = lineStart + shifted.length;
                } else {
                    el.editor.value = value.slice(0, start) + '  ' + value.slice(end);
                    el.editor.selectionStart = el.editor.selectionEnd = start + 2;
                }
                onInput();
            }
        });
    }

    function downloadPost() {
        const content = fullMarkdown();
        if (!content.trim()) {
            toast('내보낼 내용이 없습니다.', 'err');
            return;
        }
        download(hasDiaryFields() ? currentFileName() : 'document.md', content, 'text/markdown;charset=utf-8');
        toast('마크다운 파일을 내려받았습니다.', 'ok');
    }

    function wireActions() {
        $('btnDownloadMd').addEventListener('click', downloadPost);
        $('btnDownloadPost').addEventListener('click', downloadPost);

        $('btnCopyMd').addEventListener('click', () => {
            copyText(fullMarkdown(), '마크다운을 복사했습니다.');
        });

        $('btnCopyHtml').addEventListener('click', () => {
            copyText(renderMarkdown(el.editor.value), 'HTML을 복사했습니다.');
        });

        $('btnExportHtml').addEventListener('click', () => {
            const title = el.fmTitle.value.trim() || (el.editor.value.match(/^#\s+(.+)$/m) || [])[1] || 'HD2Lab Document';
            const html = standaloneHtml(title, renderMarkdown(el.editor.value));
            const name = (hasDiaryFields() ? currentSlug() : 'document') + '.html';
            download(name, html, 'text/html;charset=utf-8');
            toast('단독 HTML 파일을 내려받았습니다.', 'ok');
        });

        $('btnReset').addEventListener('click', () => {
            if (!window.confirm('작성 중인 본문과 Diary 입력값을 모두 지웁니다. 계속할까요?')) return;
            try { window.localStorage.removeItem(DRAFT_KEY); } catch (error) { /* ignore */ }
            el.editor.value = '';
            el.fmTitle.value = '';
            el.fmSlug.value = '';
            el.fmTags.value = '';
            el.fmSummary.value = '';
            el.fmDate.value = todayKst();
            el.fmCategory.value = CATEGORIES[0];
            el.saveState.textContent = '초기화됨 · 아직 저장된 초안 없음';
            el.saveState.classList.remove('is-ok');
            onInput();
            el.editor.focus();
        });

        $('btnOpenSettings').addEventListener('click', () => openSettings());
        $('btnSaveSettings').addEventListener('click', saveGithubSettings);
        $('btnForgetToken').addEventListener('click', forgetToken);
        $('btnCommit').addEventListener('click', commitToGithub);

        [el.fmTitle, el.fmCategory, el.fmDate, el.fmSlug, el.fmTags, el.fmSummary].forEach((input) => {
            input.addEventListener('input', () => { paintDiary(); scheduleSave(); });
            input.addEventListener('change', () => { paintDiary(); scheduleSave(); });
        });

        el.editor.addEventListener('input', onInput);
    }

    /* ---------------------------------------------------------------- boot */
    function boot() {
        if (!window.markdownit) {
            el.saveState.textContent = '렌더러를 불러오지 못했습니다. 새로고침해 주세요.';
            return;
        }
        loadDraft();
        paintPreview();
        paintCounts();
        paintDiary();
        paintGhState();
        setMode(window.matchMedia('(max-width: 900px)').matches ? 'edit' : 'split');
        wireToolbar();
        wireViews();
        wireKeys();
        wireActions();
        el.ghNewFile.href = newFileUrl();
        window.addEventListener('beforeunload', () => {
            if (state.dirty) saveDraft();
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    /* exposed for tests */
    window.HD2Editor = {
        slugify,
        currentFileName,
        buildFrontmatter,
        fullMarkdown,
        renderMarkdown,
        utf8ToBase64,
        commitToGithub,
        setMode,
    };
})();
