/**
 * Shared helpers for HD2's Diary (used by Eleventy config, data files and post defaults).
 */

/** Lowercase ASCII slug. Keeps a-z, 0-9 and dashes; collapses the rest. */
export function slugify(value = "") {
  const slug = String(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['"’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug;
}

/** Slug for a post file: `2026-11-10-building-hd2lab.md` -> `2026-11-10-building-hd2lab`. */
export function postSlugFromPath(inputPath = "") {
  const base = String(inputPath).split("/").pop().replace(/\.md$/i, "");
  const ascii = slugify(base);
  if (ascii) return ascii;
  return `post-${Date.now()}`;
}

/** `2026-11-10` in Asia/Seoul, stable regardless of the build machine's timezone. */
export function htmlDate(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** `2026.11.10` — the display form used across the diary. */
export function displayDate(date) {
  const iso = htmlDate(date);
  return iso ? iso.replaceAll("-", ".") : "";
}

/** `2026년 11월 10일` — long Korean form for post headers. */
export function koreanDate(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

/** Human label for a date, e.g. `3일 전` — falls back to the display date. */
export function relativeDate(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const days = Math.floor((now - d) / 86_400_000);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 30) return `${days}일 전`;
  return displayDate(d);
}
