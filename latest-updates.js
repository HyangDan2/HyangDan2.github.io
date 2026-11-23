/* HD2Lab Web-HQ · 06 / Latest Updates — Recently built.
 *
 * Two layers:
 *   1. data/latest-updates.json — the snapshot the page ships with (28 days of
 *      public commits + the newest commits, one per repository).
 *   2. a browser refresh from the public GitHub events API, cached in
 *      sessionStorage for 10 minutes. New pushes since the snapshot are read
 *      through the compare endpoint (exact commit count and messages).
 *
 * Any failure (offline, rate limit, private-only activity) leaves the
 * snapshot on screen; the section never turns into an empty or broken card.
 */
(() => {
    'use strict';

    const section = document.querySelector('.updates');
    if (!section) return;

    const api = {
        badge: section.querySelector('[data-update-badge]'),
        badgeText: section.querySelector('[data-update-badge-text]'),
        total: section.querySelector('[data-update-total]'),
        repos: section.querySelector('[data-update-repos]'),
        label: section.querySelector('[data-update-label]'),
        heat: section.querySelector('[data-update-heat]'),
        commits: section.querySelector('[data-update-commits]'),
    };
    if (!api.heat || !api.commits) return;

    const USER = 'HyangDan2';
    const STREAM = 5;
    const TZ = 'Asia/Seoul';
    const CACHE_KEY = 'hd2-latest-updates-live-v1';
    const CACHE_TTL = 10 * 60 * 1000;
    const EVENTS_URL = `https://api.github.com/users/${USER}/events/public?per_page=100`;

    const state = {
        days: [],            // [{ date, count }]
        commits: [],         // newest first
        total: 0,
        repos: new Set(),
        windowStart: '',
        windowEnd: '',
    };

    const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
    const shortFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short', day: 'numeric' });
    const dayOf = (value) => dayFmt.format(value instanceof Date ? value : new Date(value));
    const parseDay = (day) => {
        const [y, m, d] = day.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, d));
    };
    const labelOfDay = (day) => shortFmt.format(parseDay(day));
    const cleanMessage = (message) => (message || '').split('\n')[0].replace(/\s*\(#\d+\)\s*$/, '').trim();
    const number = (value) => Number(value).toLocaleString('en-US');

    const levelOf = (count) => {
        if (!count) return 0;
        if (count <= 10) return 1;
        if (count <= 30) return 2;
        if (count <= 60) return 3;
        return 4;
    };

    const relative = (iso, now = Date.now()) => {
        const then = Date.parse(iso);
        if (!Number.isFinite(then)) return '';
        const diff = Math.max(now - then, 0);
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'now';
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short', day: 'numeric' }).format(then);
    };

    const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };

    /* ---------- rendering ---------- */

    const renderHeat = () => {
        api.heat.textContent = '';
        state.days.forEach((day, index) => {
            const cell = el('span', 'updates-cell');
            cell.dataset.level = String(levelOf(day.count));
            cell.dataset.date = day.date;
            cell.setAttribute('role', 'img');
            cell.setAttribute('aria-label', `${labelOfDay(day.date)}: ${number(day.count)} commits`);
            const label = `${labelOfDay(day.date)} · ${number(day.count)} ${day.count === 1 ? 'commit' : 'commits'}`;
            const column = index % 7;
            // The tip is built on hover only: an always-present bubble would sit
            // outside the right edge and add a few pixels of page overflow.
            cell.addEventListener('pointerenter', () => {
                const tip = el('span', 'updates-tip', label);
                if (column === 0) tip.classList.add('is-start');
                if (column === 6) tip.classList.add('is-end');
                cell.appendChild(tip);
            });
            cell.addEventListener('pointerleave', () => {
                const tip = cell.querySelector('.updates-tip');
                if (tip) tip.remove();
            });
            api.heat.appendChild(cell);
        });
    };

    const streamCommits = () => {
        // One row per repository, newest first — a run of commits on the same
        // repo would otherwise fill the whole stream with four identical rows.
        const seen = new Set();
        const rows = [];
        for (const commit of state.commits) {
            if (seen.has(commit.repo_full)) continue;
            seen.add(commit.repo_full);
            rows.push(commit);
            if (rows.length === STREAM) break;
        }
        return rows;
    };

    const renderStream = () => {
        const rows = streamCommits();
        api.commits.textContent = '';
        if (!rows.length) {
            api.commits.appendChild(el('li', 'updates-empty', 'Recent activity is unavailable right now.'));
            return;
        }
        rows.forEach((commit) => {
            const item = el('li', 'commit-row');
            const link = el('a', 'commit-link');
            link.href = commit.url || `https://github.com/${commit.repo_full}`;
            link.rel = 'noopener';

            const top = el('span', 'commit-top');
            top.appendChild(el('code', 'commit-sha', commit.short || commit.sha.slice(0, 7)));
            top.appendChild(el('span', 'commit-repo', commit.repo));
            const time = el('time', 'commit-time', relative(commit.date));
            time.dateTime = commit.date;
            time.dataset.time = commit.date;
            top.appendChild(time);

            link.appendChild(top);
            link.appendChild(el('span', 'commit-msg', commit.message || '(no message)'));
            item.appendChild(link);
            api.commits.appendChild(item);
        });
    };

    const renderBadge = () => {
        if (!api.badge || !api.badgeText) return;
        const latest = state.commits[0]?.date;
        if (!latest) {
            api.badge.hidden = true;
            return;
        }
        const today = dayOf(new Date());
        const latestDay = dayOf(latest);
        const gap = Math.round((parseDay(today) - parseDay(latestDay)) / 864e5);
        let text;
        let quiet = false;
        if (gap <= 0) text = 'Active today';
        else if (gap === 1) { text = 'Active yesterday'; quiet = true; }
        else { text = `Active ${gap}d ago`; quiet = true; }
        api.badgeText.textContent = text;
        api.badge.classList.toggle('is-quiet', quiet);
        api.badge.hidden = false;
    };

    const render = () => {
        if (api.total) api.total.textContent = number(state.total);
        if (api.repos) api.repos.textContent = number(state.repos.size);
        // A snapshot older than today says so instead of claiming to be current.
        if (api.label) {
            const stale = state.windowEnd && state.windowEnd !== dayOf(new Date());
            api.label.textContent = stale ? `Last 28 days · to ${labelOfDay(state.windowEnd)}` : 'Last 28 days';
        }
        renderHeat();
        renderStream();
        renderBadge();
    };

    /* ---------- snapshot ---------- */

    const applySnapshot = (data) => {
        state.days = (data.days || []).map((day) => ({ date: day.date, count: Number(day.count) || 0 }));
        state.commits = (data.commits || []).filter((c) => c && c.sha && c.date);
        state.total = Number(data.total_commits) || state.commits.length;
        state.repos = new Set(Array.isArray(data.repositories) ? data.repositories : []);
        state.windowStart = data.window?.start || '';
        state.windowEnd = data.window?.end || '';
    };

    /* ---------- live refresh ---------- */

    const readCache = () => {
        try {
            const raw = sessionStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed.at !== 'number' || Date.now() - parsed.at > CACHE_TTL) return null;
            if (!Array.isArray(parsed.commits)) return null;
            return parsed;
        } catch (error) {
            return null;
        }
    };

    const writeCache = (payload) => {
        try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...payload, at: Date.now() }));
        } catch (error) {
            /* storage full or blocked: the refresh simply runs next time */
        }
    };

    const getJson = async (url) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
            const res = await fetch(url, {
                headers: { Accept: 'application/vnd.github+json' },
                signal: controller.signal,
            });
            if (!res.ok) return null; // 403 rate limit, 404 branch gone — keep the snapshot
            return await res.json();
        } catch (error) {
            return null;
        } finally {
            clearTimeout(timer);
        }
    };

    const commitFromApi = (repoFull, repoName, item) => {
        const date = item?.commit?.author?.date || item?.commit?.committer?.date || '';
        if (!item?.sha || !date) return null;
        return {
            sha: item.sha,
            short: item.sha.slice(0, 7),
            repo: repoName,
            repo_full: repoFull,
            message: cleanMessage(item.commit?.message),
            date,
            url: item.html_url || `https://github.com/${repoFull}/commit/${item.sha}`,
        };
    };

    const pushCommits = async (event) => {
        const repoFull = event.repo?.name;
        const head = event.payload?.head;
        if (!repoFull || !head) return [];
        const repoName = repoFull.split('/').pop();
        const before = event.payload?.before;
        const isNewBranch = !before || /^0+$/.test(before);

        if (!isNewBranch) {
            const compare = await getJson(`https://api.github.com/repos/${repoFull}/compare/${before}...${head}`);
            if (compare && Array.isArray(compare.commits)) {
                return compare.commits
                    .map((item) => commitFromApi(repoFull, repoName, item))
                    .filter((item) => item && item.date);
            }
        }
        const single = await getJson(`https://api.github.com/repos/${repoFull}/commits/${head}`);
        const commit = single ? commitFromApi(repoFull, repoName, single) : null;
        return commit ? [commit] : [];
    };

    const applyLive = (payload) => {
        if (!payload) return;
        const added = Array.isArray(payload.commits) ? payload.commits : [];
        let changed = false;
        if (added.length) {
            const seen = new Set(state.commits.map((c) => c.sha));
            const fresh = added.filter((c) => c && c.sha && c.date && !seen.has(c.sha));
            if (fresh.length) {
                state.commits = fresh.concat(state.commits).sort((a, b) => (a.date < b.date ? 1 : -1));
                state.total += fresh.length;
                fresh.forEach((commit) => { if (commit.repo_full) state.repos.add(commit.repo_full); });
                const today = dayOf(new Date());
                const cell = state.days.find((day) => day.date === today);
                if (cell) cell.count += fresh.length;
                else if (state.days.length) state.days[state.days.length - 1].count += fresh.length;
                changed = true;
            }
        }
        render();
        if (changed) {
            // A short pulse marks the swap to newer numbers instead of a jump.
            section.classList.add('is-updating');
            setTimeout(() => section.classList.remove('is-updating'), 320);
        }
    };

    const liveRefresh = async () => {
        const cached = readCache();
        if (cached) {
            applyLive(cached);
            return;
        }
        const events = await getJson(EVENTS_URL);
        if (!Array.isArray(events) || !events.length) return;

        const newestAt = events[0].created_at;
        const baseline = Date.parse(state.commits[0]?.date || 0) || 0;
        const pushes = events
            .filter((event) => event.type === 'PushEvent' && Date.parse(event.created_at) > baseline)
            .slice(0, 3);

        const fresh = [];
        for (const event of pushes) {
            const commits = await pushCommits(event);
            fresh.push(...commits);
        }
        const payload = { newest: newestAt, commits: fresh };
        applyLive(payload);
        writeCache(payload);
    };

    /* ---------- ticking relative times ---------- */

    const tick = () => {
        const now = Date.now();
        section.querySelectorAll('time[data-time]').forEach((node) => {
            const text = relative(node.dataset.time, now);
            if (text && node.textContent !== text) node.textContent = text;
        });
        renderBadge();
    };

    /* ---------- boot ---------- */

    const load = async () => {
        let data = null;
        try {
            const res = await fetch(new URL('data/latest-updates.json', document.baseURI), { cache: 'no-cache' });
            /* the path is case-sensitive on Pages; a 404 is a real miss, not a refresh */
            if (res.ok) data = await res.json();
        } catch (error) {
            data = null;
        }
        if (!data || !Array.isArray(data.days) || !data.days.length) {
            api.commits.textContent = '';
            api.commits.appendChild(el('li', 'updates-empty', 'Recent activity is unavailable right now.'));
            return;
        }
        applySnapshot(data);
        render();
        liveRefresh();
        setInterval(tick, 60000);
    };

    load();
})();
