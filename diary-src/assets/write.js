/* HD2's Diary — client-side editor (no backend).
   Markdown preview, localStorage draft, .md download, GitHub new-file commit URL. */
(function () {
    "use strict";

    const STORAGE_KEY = "hd2_diary_draft_v1";
    const REPO = "HyangDan2/HyangDan2.github.io";
    const POST_DIR = "diary-src/posts";
    const MAX_URL = 7000;
    const CATEGORIES = ["Devlog", "Architecture", "Troubleshooting", "Notes"];

    const el = {
        form: document.getElementById("diary-form"),
        title: document.getElementById("field-title"),
        category: document.getElementById("field-category"),
        customField: document.getElementById("custom-category-field"),
        categoryCustom: document.getElementById("field-category-custom"),
        date: document.getElementById("field-date"),
        slug: document.getElementById("field-slug"),
        summary: document.getElementById("field-summary"),
        tags: document.getElementById("field-tags"),
        body: document.getElementById("field-body"),
        preview: document.getElementById("preview"),
        previewCategory: document.getElementById("preview-category"),
        panes: document.getElementById("panes"),
        tabEdit: document.getElementById("tab-edit"),
        tabPreview: document.getElementById("tab-preview"),
        wordCount: document.getElementById("word-count"),
        draftState: document.getElementById("draft-state"),
        fileName: document.getElementById("file-name"),
        frontmatter: document.getElementById("frontmatter-preview"),
        github: document.getElementById("btn-github"),
        download: document.getElementById("btn-download"),
        copy: document.getElementById("btn-copy"),
        reset: document.getElementById("btn-reset"),
        note: document.getElementById("action-note"),
    };

    const state = { slugDirty: false, loaded: false };

    /* ------------------------------------------------------------------ utils */
    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function todayKst() {
        const now = new Date();
        const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        return kst.toISOString().slice(0, 10);
    }

    function slugify(value) {
        return String(value)
            .toLowerCase()
            .replace(/['"’`]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .replace(/-{2,}/g, "-");
    }

    function currentCategory() {
        return el.category.value === "__custom"
            ? (el.categoryCustom.value.trim() || "Notes")
            : el.category.value;
    }

    function currentSlug() {
        const raw = el.slug.value.trim() ? el.slug.value : el.title.value;
        const slug = slugify(raw);
        return slug || "diary-" + (el.date.value || todayKst()).replace(/-/g, "");
    }

    function currentFileName() {
        const date = el.date.value || todayKst();
        return `${date}-${currentSlug()}.md`;
    }

    function tagList() {
        return el.tags.value
            .split(",")
            .map((tag) => tag.trim().replace(/^#/, ""))
            .filter(Boolean);
    }

    function yamlString(value) {
        return '"' + String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ") + '"';
    }

    function buildFrontmatter() {
        const tags = tagList();
        const lines = [
            "---",
            `title: ${yamlString(el.title.value.trim() || "제목 없음")}`,
            `date: ${el.date.value || todayKst()}`,
            `category: ${yamlString(currentCategory())}`,
            `summary: ${yamlString(el.summary.value.trim())}`,
            `tags: [${tags.map(yamlString).join(", ")}]`,
            "layout: post",
            "---",
        ];
        return lines.join("\n");
    }

    function buildMarkdown() {
        const body = el.body.value.replace(/\s+$/, "");
        return `${buildFrontmatter()}\n\n${body}\n`;
    }

    /* -------------------------------------------------------- markdown renderer */
    function renderInline(text) {
        const codes = [];
        let out = String(text).replace(/`([^`]+)`/g, function (_, code) {
            codes.push(code);
            return "\u0000" + (codes.length - 1) + "\u0000";
        });

        out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, alt, src) {
            return `<img src="${src}" alt="${alt}" loading="lazy">`;
        });
        out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, label, href) {
            const external = /^https?:/i.test(href);
            return `<a href="${href}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
        });
        out = out.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
        out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
        out = out.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
        out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
        out = out.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, function (_, lead, url) {
            if (out.indexOf('href="' + url) !== -1) return lead + url;
            return `${lead}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });

        out = out.replace(/\u0000(\d+)\u0000/g, function (_, index) {
            return `<code>${codes[Number(index)]}</code>`;
        });
        return out;
    }

    function isBlockStart(line) {
        return /^\s*(```|#{1,6}\s|>\s?|([-*+]|\d+\.)\s|---|\*\*\*|___)/.test(line);
    }

    function renderMarkdown(source) {
        const lines = String(source).replace(/\r\n?/g, "\n").split("\n");
        const out = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];

            if (!line.trim()) {
                i += 1;
                continue;
            }

            /* fenced code */
            const fence = line.match(/^\s*```\s*([\w+-]*)\s*$/);
            if (fence) {
                const lang = fence[1] || "text";
                const buffer = [];
                i += 1;
                while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
                    buffer.push(lines[i]);
                    i += 1;
                }
                i += 1;
                out.push(
                    `<pre class="code-block" data-lang="${escapeHtml(lang)}"><code>${escapeHtml(buffer.join("\n"))}</code></pre>`
                );
                continue;
            }

            /* heading */
            const heading = line.match(/^\s*(#{1,6})\s+(.*?)\s*#*\s*$/);
            if (heading) {
                const level = heading[1].length;
                out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
                i += 1;
                continue;
            }

            /* horizontal rule */
            if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
                out.push("<hr>");
                i += 1;
                continue;
            }

            /* table */
            if (/\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1]) && /-/.test(lines[i + 1])) {
                const parseRow = (row) =>
                    row.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((cell) => cell.trim());
                const head = parseRow(line);
                i += 2;
                const rows = [];
                while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim()) {
                    rows.push(parseRow(lines[i]));
                    i += 1;
                }
                const thead = head.map((cell) => `<th>${renderInline(cell)}</th>`).join("");
                const tbody = rows
                    .map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`)
                    .join("");
                out.push(`<div class="table-wrap"><table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div>`);
                continue;
            }

            /* blockquote */
            if (/^\s*>\s?/.test(line)) {
                const buffer = [];
                while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
                    buffer.push(lines[i].replace(/^\s*>\s?/, ""));
                    i += 1;
                }
                out.push(`<blockquote>${renderMarkdown(buffer.join("\n"))}</blockquote>`);
                continue;
            }

            /* lists */
            const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
            if (listMatch) {
                const ordered = /\d+\./.test(listMatch[2]);
                const items = [];
                while (i < lines.length) {
                    const item = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
                    if (!item) break;
                    const indent = item[1].length;
                    let text = item[3];
                    i += 1;
                    while (i < lines.length && lines[i].trim() && (!isBlockStart(lines[i]) || /^\s{2,}\S/.test(lines[i]))) {
                        text += " " + lines[i].trim();
                        i += 1;
                    }
                    const nested = indent >= 2 ? ' class="is-child"' : "";
                    items.push(`<li${nested}>${renderInline(text)}</li>`);
                }
                out.push(ordered ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
                continue;
            }

            /* paragraph */
            const buffer = [line.trim()];
            i += 1;
            while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i]) && !/^\s*\|.*\|/.test(lines[i])) {
                buffer.push(lines[i].trim());
                i += 1;
            }
            out.push(`<p>${renderInline(buffer.join(" "))}</p>`);
        }

        return out.join("\n");
    }

    /* ---------------------------------------------------------------- rendering */
    function renderPreview() {
        const body = el.body.value.trim();
        const category = currentCategory();
        el.previewCategory.textContent = category;

        let html = "";
        if (el.title.value.trim()) html += `<h1 class="preview-title">${escapeHtml(el.title.value.trim())}</h1>`;
        if (el.summary.value.trim()) html += `<p class="preview-summary">${escapeHtml(el.summary.value.trim())}</p>`;
        html += body ? renderMarkdown(body) : '<p class="preview-empty">제목과 본문을 쓰면 여기에 그대로 나타난다.</p>';
        el.preview.innerHTML = html;
    }

    function updateMeta() {
        const text = el.body.value;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        el.wordCount.textContent = `${words} 단어 · ${text.length} 자`;
        el.fileName.textContent = currentFileName();
        el.frontmatter.textContent = buildFrontmatter();

        const markdown = buildMarkdown();
        const encoded = encodeURIComponent(markdown);
        const base = `https://github.com/${REPO}/new/main/${POST_DIR}`;
        const prefill = `${base}?filename=${encodeURIComponent(currentFileName())}&value=${encoded}`;

        if (encoded.length <= MAX_URL) {
            el.github.href = prefill;
            if (!el.note.dataset.locked) {
                setNote("준비됨. 글을 쓰면 다운로드 파일명과 커밋 링크가 갱신된다.", "");
            }
        } else {
            el.github.href = base;
            setNote("본문이 길어 GitHub 링크에 전문을 담을 수 없다. [복사]로 본문을 복사한 뒤 GitHub 편집기에 붙여넣거나, .md 다운로드로 파일을 올려라.", "warn");
        }
    }

    function setNote(message, kind) {
        el.note.textContent = message;
        el.note.classList.toggle("is-warn", kind === "warn");
        el.note.classList.toggle("is-ok", kind === "ok");
    }

    function scheduleRender() {
        window.clearTimeout(scheduleRender.timer);
        scheduleRender.timer = window.setTimeout(renderPreview, 80);
    }

    /* ------------------------------------------------------------------- drafts */
    function collectDraft() {
        return {
            title: el.title.value,
            category: el.category.value,
            categoryCustom: el.categoryCustom.value,
            date: el.date.value,
            slug: el.slug.value,
            summary: el.summary.value,
            tags: el.tags.value,
            body: el.body.value,
            slugDirty: state.slugDirty,
            savedAt: Date.now(),
        };
    }

    function saveDraft() {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(collectDraft()));
            const time = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
            el.draftState.textContent = `자동 저장됨 · ${time}`;
        } catch (error) {
            el.draftState.textContent = "자동 저장 불가 (브라우저 저장소 차단)";
        }
    }

    function restoreDraft() {
        let draft = null;
        try {
            draft = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
        } catch (error) {
            draft = null;
        }
        if (!draft) {
            el.date.value = todayKst();
            return false;
        }
        el.title.value = draft.title || "";
        el.summary.value = draft.summary || "";
        el.tags.value = draft.tags || "";
        el.body.value = draft.body || "";
        el.date.value = draft.date || todayKst();
        el.slug.value = draft.slug || "";
        state.slugDirty = Boolean(draft.slugDirty);

        if (draft.category === "__custom") {
            el.category.value = "__custom";
            el.categoryCustom.value = draft.categoryCustom || "";
        } else if (draft.category && CATEGORIES.includes(draft.category)) {
            el.category.value = draft.category;
        } else if (draft.category) {
            el.category.value = "__custom";
            el.categoryCustom.value = draft.category;
            el.categoryCustom.parentElement.hidden = false;
        }
        if (draft.savedAt) {
            const time = new Date(draft.savedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
            el.draftState.textContent = `이어 쓰는 중 · ${time}`;
        }
        return true;
    }

    /* ------------------------------------------------------------------ actions */
    function downloadMarkdown() {
        const blob = new Blob([buildMarkdown()], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = currentFileName();
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 2000);
        setNote(`${currentFileName()} 다운로드 시작. ${POS_DIR_HINT}`, "ok");
    }

    const POS_DIR_HINT = `저장 위치는 ${POST_DIR}/ 이다.`;

    async function copyMarkdown() {
        const markdown = buildMarkdown();
        try {
            await navigator.clipboard.writeText(markdown);
            setNote("frontmatter + 본문을 클립보드에 복사했다. GitHub 편집기에 붙여넣으면 된다.", "ok");
        } catch (error) {
            const temp = document.createElement("textarea");
            temp.value = markdown;
            temp.setAttribute("readonly", "");
            temp.style.position = "fixed";
            temp.style.opacity = "0";
            document.body.appendChild(temp);
            temp.select();
            const ok = document.execCommand("copy");
            temp.remove();
            setNote(ok ? "클립보드에 복사했다." : "복사에 실패했다. .md 다운로드를 사용해라.", ok ? "ok" : "warn");
        }
    }

    function resetDraft() {
        if (!window.confirm("작성 중인 내용을 지우고 새로 시작할까?")) return;
        window.localStorage.removeItem(STORAGE_KEY);
        el.form.reset();
        el.category.value = "Devlog";
        el.categoryCustom.parentElement.hidden = true;
        el.categoryCustom.value = "";
        el.date.value = todayKst();
        el.slug.value = "";
        state.slugDirty = false;
        el.draftState.textContent = "새 초안";
        renderPreview();
        updateMeta();
        setNote("초안을 비웠다. 다시 쓰면 자동 저장된다.", "");
        el.title.focus();
    }

    function applyCategoryUi() {
        const custom = el.category.value === "__custom";
        el.categoryCustom.parentElement.hidden = !custom;
        if (custom) el.categoryCustom.focus();
        renderPreview();
        updateMeta();
    }

    function insertSnippet(snippet) {
        const textarea = el.body;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        const before = value.slice(0, start);
        const after = value.slice(end);
        const needsNewline = start > 0 && before.endsWith("\n") === false && snippet.startsWith("#");
        textarea.value = before + (needsNewline ? "\n" : "") + snippet + after;
        const caret = start + snippet.length + (needsNewline ? 1 : 0);
        textarea.focus();
        textarea.setSelectionRange(caret, caret);
        onInput();
    }

    /* -------------------------------------------------------------------- wiring */
    function onInput() {
        if (!state.slugDirty) {
            el.slug.value = slugify(el.title.value);
        }
        scheduleRender();
        updateMeta();
        window.clearTimeout(onInput.saveTimer);
        onInput.saveTimer = window.setTimeout(saveDraft, 400);
    }

    const fields = [el.title, el.summary, el.tags, el.date, el.slug, el.categoryCustom, el.body];
    fields.forEach((field) => field.addEventListener("input", onInput));

    el.category.addEventListener("change", applyCategoryUi);

    el.slug.addEventListener("input", () => {
        state.slugDirty = el.slug.value.trim().length > 0;
        updateMeta();
        scheduleRender();
        window.clearTimeout(onInput.saveTimer);
        onInput.saveTimer = window.setTimeout(saveDraft, 400);
    });

    document.querySelectorAll("[data-insert]").forEach((button) => {
        button.addEventListener("click", () => insertSnippet(button.dataset.insert.replace(/&#10;/g, "\n")));
    });

    el.form.addEventListener("submit", (event) => {
        event.preventDefault();
        downloadMarkdown();
    });

    el.download.addEventListener("click", (event) => {
        event.preventDefault();
        downloadMarkdown();
    });

    el.copy.addEventListener("click", copyMarkdown);
    el.reset.addEventListener("click", resetDraft);

    el.github.addEventListener("click", () => {
        saveDraft();
        if (encodeURIComponent(buildMarkdown()).length > MAX_URL) {
            setNote("전문이 너무 길어 GitHub 새 파일 화면만 열린다. [복사] 후 편집기에 붙여넣어라.", "warn");
        }
    });

    /* mobile view tabs */
    function setView(view) {
        const preview = view === "preview";
        el.tabEdit.classList.toggle("is-active", !preview);
        el.tabPreview.classList.toggle("is-active", preview);
        el.tabEdit.setAttribute("aria-selected", String(!preview));
        el.tabPreview.setAttribute("aria-selected", String(preview));
        el.panes.classList.toggle("mode-edit", !preview);
        el.panes.classList.toggle("mode-preview", preview);
        if (preview) renderPreview();
    }

    el.tabEdit.addEventListener("click", () => setView("edit"));
    el.tabPreview.addEventListener("click", () => setView("preview"));

    /* keep drafts across tabs that are closed or backgrounded */
    window.addEventListener("beforeunload", saveDraft);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") saveDraft();
    });

    /* ------------------------------------------------------------------- startup */
    const restored = restoreDraft();
    if (!el.date.value) el.date.value = todayKst();
    if (!restored && !el.slug.value) el.slug.value = "";
    renderPreview();
    updateMeta();
    if (restored) {
        setNote("이전에 쓰던 초안을 불러왔다. 이어서 쓰면 된다.", "");
    } else {
        setNote("준비됨. 글을 쓰면 다운로드 파일명과 커밋 링크가 갱신된다.", "");
    }
})();
