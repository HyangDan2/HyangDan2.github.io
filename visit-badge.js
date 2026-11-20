/* HD2Lab visitor badge — Today · Total from the public GoatCounter API.
 *
 *   all-time  https://hd2lab.goatcounter.com/counter/TOTAL.json
 *   today     …?start=YYYY-MM-DD&end=YYYY-MM-DD+1   (one KST calendar day)
 *
 * The pill ships hidden and is only revealed once a total arrives, so a blocked
 * or failing request never leaves an empty or "undefined" badge in the footer.
 * The two counts are kept in sessionStorage for five minutes, so walking through
 * the pages of one hub does not refetch the same numbers on every page.
 */
(function () {
    'use strict';

    var API = 'https://hd2lab.goatcounter.com/counter/TOTAL.json';
    var CACHE_KEY = 'hd2lab-visits';
    var CACHE_MS = 5 * 60 * 1000;

    // Today's date in KST, shifted by whole days (0 = today, 1 = tomorrow).
    function kstDay(offset) {
        var t = Date.now() + 9 * 60 * 60 * 1000 + offset * 86400000;
        return new Date(t).toISOString().slice(0, 10);
    }

    // "1,234" / "1234" / " 12 " -> 1234; anything unreadable counts as 0.
    function toNumber(body) {
        var raw = body && (body.count_unique != null ? body.count_unique : body.count);
        var digits = String(raw == null ? '' : raw).replace(/[^0-9]/g, '');
        return digits ? parseInt(digits, 10) : 0;
    }

    // Resolves to a count, or null when the request itself failed. A day with no
    // visits answers 404 with a zero body, which is a real count of 0.
    function count(url) {
        return fetch(url, { cache: 'no-store' }).then(function (res) {
            if (!res.ok && res.status !== 404) throw new Error('HTTP ' + res.status);
            return res.json();
        }).then(toNumber).catch(function () { return null; });
    }

    function paint(today, total) {
        var badge = document.querySelector('[data-visit-badge]');
        if (!badge || total == null) return;
        badge.querySelector('[data-visit-today]').textContent =
            today == null ? '—' : today.toLocaleString('en-US');
        badge.querySelector('[data-visit-total]').textContent = total.toLocaleString('en-US');
        badge.hidden = false;
    }

    function readCache() {
        try {
            var hit = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
            if (hit && typeof hit.at === 'number' && Date.now() - hit.at < CACHE_MS) return hit;
        } catch (e) { /* storage blocked: just fetch */ }
        return null;
    }

    var cached = readCache();
    if (cached) {
        paint(cached.today, cached.total);
        return;
    }

    Promise.all([
        count(API),
        count(API + '?start=' + kstDay(0) + '&end=' + kstDay(1))
    ]).then(function (result) {
        var total = result[0];
        var today = result[1];
        paint(today, total);
        if (total == null) return;
        try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), today: today, total: total }));
        } catch (e) { /* storage blocked: the badge is already painted */ }
    });
})();
