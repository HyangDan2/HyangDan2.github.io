#!/usr/bin/env node
/**
 * Web-HQ · 06 / Latest Updates — snapshot builder
 *
 * Writes data/latest-updates.json: the last 28 days of public commit activity
 * for @HyangDan2 plus the newest commits on distinct repositories. public
 * repositories only — anything private is dropped before it reaches the file.
 *
 * Run:  node tools/build-latest-updates.mjs        (GITHUB_TOKEN optional)
 * The page also refreshes itself in the browser from the public events API;
 * this snapshot is what every visitor sees before (or instead of) that call.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const USER = 'HyangDan2';
const DAYS = 28;
const STREAM = 5;
const TZ = 'Asia/Seoul';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'latest-updates.json');
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

const api = async (path) => {
    const res = await fetch(`https://api.github.com${path}`, {
        headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'hd2lab-webhq-snapshot',
            ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
        },
    });
    if (res.status === 403 || res.status === 429) {
        // Search allows 10 requests a minute without a token; wait out the window.
        const reset = Number(res.headers.get('x-ratelimit-reset') || 0) * 1000;
        const wait = Math.min(Math.max(reset - Date.now(), 5000), 65000);
        await new Promise((r) => setTimeout(r, wait));
        return api(path);
    }
    if (!res.ok) throw new Error(`${path} → ${res.status} ${res.statusText}`);
    return res.json();
};

// A date in the site's timezone (Asia/Seoul), as YYYY-MM-DD.
const dayInTz = (value) => {
    const d = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
};
const shiftDays = (day, delta) => {
    const [y, m, d] = day.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d) + delta * 864e5);
    return t.toISOString().slice(0, 10);
};

// Search API stops at 1000 results; ten pages is that ceiling.
const collectCommits = async (sinceIso) => {
    const items = [];
    let total = 0;
    for (let page = 1; page <= 10; page += 1) {
        const data = await api(
            `/search/commits?q=${encodeURIComponent(`author:${USER} author-date:>=${sinceIso}`)}` +
            `&sort=author-date-desc&order=desc&per_page=100&page=${page}`
        );
        total = data.total_count ?? 0;
        items.push(...(data.items ?? []));
        if (items.length >= total || (data.items ?? []).length < 100) break;
        // No token means 10 search requests a minute, so a page every 6.5s.
        await new Promise((r) => setTimeout(r, TOKEN ? 1500 : 6500));
    }
    return { items, total };
};

const cleanMessage = (message) =>
    message.split('\n')[0].replace(/\s*\(#\d+\)\s*$/, '').trim();

const main = async () => {
    const today = dayInTz(new Date());
    const start = shiftDays(today, -(DAYS - 1));
    const sinceIso = `${shiftDays(start, 0)}T00:00:00+09:00`;

    const { items, total } = await collectCommits(sinceIso);
    const publicCommits = items
        .filter((c) => c.repository && c.repository.private === false)
        .map((c) => ({
            sha: c.sha,
            short: c.sha.slice(0, 7),
            repo: c.repository.name,
            repo_full: c.repository.full_name,
            message: cleanMessage(c.commit.message || ''),
            date: c.commit.author?.date || c.commit.committer?.date || '',
            url: c.html_url,
        }))
        .filter((c) => c.date)
        .sort((a, b) => (a.date < b.date ? 1 : -1));

    const perDay = new Map();
    for (const commit of publicCommits) {
        const day = dayInTz(commit.date);
        perDay.set(day, (perDay.get(day) ?? 0) + 1);
    }
    const days = Array.from({ length: DAYS }, (_, i) => {
        const date = shiftDays(start, i);
        return { date, count: perDay.get(date) ?? 0 };
    });

    // One row per repository keeps the stream readable when a run of commits
    // lands on the same repo; the newest commit of each repo is the one shown.
    const stream = [];
    const seen = new Set();
    for (const commit of publicCommits) {
        if (seen.has(commit.repo_full) && publicCommits.length >= STREAM * 2) continue;
        seen.add(commit.repo_full);
        stream.push(commit);
        if (stream.length === STREAM) break;
    }

    const snapshot = {
        user: USER,
        generated_at: new Date().toISOString(),
        timezone: TZ,
        window: { start, end: today, days: DAYS },
        total_commits: days.reduce((sum, d) => sum + d.count, 0),
        active_repos: new Set(publicCommits.map((c) => c.repo_full)).size,
        repositories: [...new Set(publicCommits.map((c) => c.repo_full))].sort(),
        truncated: total > items.length,
        days,
        commits: stream.map(({ sha, short, repo, repo_full, message, date, url }) => ({
            sha, short, repo, repo_full, message, date, url,
        })),
    };

    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(OUT, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    console.log(`latest-updates.json · ${snapshot.total_commits} commits · ${snapshot.active_repos} repos · window ${start} → ${today}`);
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
