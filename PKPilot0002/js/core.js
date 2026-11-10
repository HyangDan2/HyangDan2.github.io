/* ==================================================================
   HD2Lab | Midpoint (PKPilot0002)
   core.js — 중간 지점 계산·URL 상태·역 추천의 순수 로직
   DOM/Leaflet 의존 없음. 브라우저와 테스트 러너가 같은 파일을 쓴다.
   ================================================================== */

export const EARTH_RADIUS_KM = 6371.0088;
export const MAX_PARTICIPANTS = 12;
export const DEFAULT_NAMES = i => `Person ${i + 1}`;

const toRad = deg => (deg * Math.PI) / 180;
const toDeg = rad => (rad * 180) / Math.PI;
const round5 = v => Math.round(v * 1e5) / 1e5;

export function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

const toNum = value => {
  if (typeof value === 'string' && value.trim() === '') return NaN;
  if (typeof value === 'number') return value;
  return Number(value);
};

/** 이름·좌표를 정규화한다. 좌표가 유효하지 않으면 null. */
export function normalizePoint(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const lat = toNum(raw.lat);
  const lng = toNum(raw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const name = typeof raw.name === 'string' ? sanitizeName(raw.name) : '';
  return name ? { lat, lng, name } : { lat, lng };
}

/** URL에 실리는 이름: 구분자( ~ , | )를 지우고 길이를 제한한다. */
export function sanitizeName(name) {
  return String(name).replace(/[~|,]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 32);
}

/** 두 지점 사이의 대권 거리(km). Haversine. */
export function haversineKm(a, b) {
  if (!a || !b) return NaN;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 구면 무게중심: 단위 구면 벡터의 평균을 다시 지표면으로 옮긴다. */
export function sphericalCentroid(points) {
  const pts = (points || []).filter(Boolean);
  if (pts.length === 0) return null;
  if (pts.length === 1) return { lat: pts[0].lat, lng: pts[0].lng };

  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of pts) {
    const phi = toRad(p.lat);
    const lambda = toRad(p.lng);
    x += Math.cos(phi) * Math.cos(lambda);
    y += Math.cos(phi) * Math.sin(lambda);
    z += Math.sin(phi);
  }
  const norm = Math.sqrt(x * x + y * y + z * z);
  if (!Number.isFinite(norm) || norm < 1e-12) {
    // 서로 정반대에 가까운 입력: 벡터합이 0으로 수렴 → 산술 평균으로 후퇴
    const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
    return { lat: clamp(lat, -90, 90), lng: wrapLng(lng) };
  }
  const lat = toDeg(Math.asin(clamp(z / norm, -1, 1)));
  const lng = wrapLng(toDeg(Math.atan2(y, x)));
  return { lat, lng };
}

/** 경도 −180..180 정규화 */
export function wrapLng(lng) {
  let v = ((lng + 180) % 360 + 360) % 360 - 180;
  if (v === -180) v = 180;
  return v;
}

/** 도시 규모용 평면 근사 투영 (등장방형). 기준 위도에서 경도 스케일을 보정한다. */
function project(point, originLat) {
  return {
    x: toRad(point.lng) * Math.cos(toRad(originLat)) * EARTH_RADIUS_KM,
    y: toRad(point.lat) * EARTH_RADIUS_KM,
  };
}

function unproject(p, originLat) {
  const lat = toDeg(p.y / EARTH_RADIUS_KM);
  const lng = wrapLng(toDeg(p.x / (EARTH_RADIUS_KM * Math.cos(toRad(originLat)))));
  return { lat: clamp(lat, -90, 90), lng };
}

/**
 * 기하 중앙값(Weiszfeld): 각 참가자까지 거리의 합을 최소로 하는 지점.
 * "모두에게 가장 공평한" 만남 지점으로 쓴다.
 */
export function geometricMedian(points, options = {}) {
  const pts = (points || []).filter(Boolean);
  if (pts.length === 0) return null;
  if (pts.length === 1) return { lat: pts[0].lat, lng: pts[0].lng };

  const maxIterations = options.maxIterations ?? 300;
  const tolerance = options.tolerance ?? 1e-7; // km
  const originLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const projected = pts.map(p => project(p, originLat));

  let cx = projected.reduce((s, p) => s + p.x, 0) / projected.length;
  let cy = projected.reduce((s, p) => s + p.y, 0) / projected.length;

  for (let iter = 0; iter < maxIterations; iter += 1) {
    let numX = 0;
    let numY = 0;
    let den = 0;
    let exact = null;
    for (const p of projected) {
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d < 1e-9) {
        exact = p;
        break;
      }
      const w = 1 / d;
      numX += p.x * w;
      numY += p.y * w;
      den += w;
    }
    if (exact) {
      // 입력 지점 위에 정확히 떨어진 경우: 그 지점이 곧 중앙값이다.
      const at = unproject(exact, originLat);
      return { lat: at.lat, lng: at.lng };
    }
    if (den <= 0) break;
    const nx = numX / den;
    const ny = numY / den;
    const moved = Math.hypot(nx - cx, ny - cy);
    cx = nx;
    cy = ny;
    if (moved < tolerance) break;
  }

  const result = unproject({ x: cx, y: cy }, originLat);
  // 데이터 지점 자체가 최적점인 경우(중복 좌표 등) 보정:
  // 입력점에서의 총거리가 더 짧으면 그 점을 쓴다.
  let best = result;
  let bestCost = totalDistanceKm(result, pts);
  for (const p of pts) {
    const cost = totalDistanceKm(p, pts);
    if (cost < bestCost - 1e-6) {
      best = { lat: p.lat, lng: p.lng };
      bestCost = cost;
    }
  }
  return { lat: best.lat, lng: best.lng };
}

function totalDistanceKm(point, points) {
  return points.reduce((sum, p) => sum + haversineKm(point, p), 0);
}

/* ------------------------------------------------------------------
   최대 거리 최소화(1-center, minimax) — "모두에게 가장 고른" 지점
   ------------------------------------------------------------------ */

/** 평면 위 최소 외접원 중심. 입력 지점이 최대 12개라 단순 탐색으로 충분하다. */
function minimumEnclosingCircle(points) {
  const encloses = (cx, cy, r) => points.every(p => Math.hypot(p.x - cx, p.y - cy) <= r + 1e-9);

  let best = null;
  const consider = (cx, cy, r) => {
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(r)) return;
    if (!best || r < best.r) best = { x: cx, y: cy, r };
  };

  for (const p of points) {
    if (encloses(p.x, p.y, 0)) consider(p.x, p.y, 0); // 모든 점이 같은 자리인 경우
  }

  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const a = points[i];
      const b = points[j];
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const r = Math.hypot(a.x - b.x, a.y - b.y) / 2;
      if (encloses(cx, cy, r)) consider(cx, cy, r);
    }
  }

  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      for (let k = j + 1; k < points.length; k += 1) {
        const a = points[i];
        const b = points[j];
        const c = points[k];
        const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
        if (Math.abs(d) < 1e-12) continue; // 세 점이 한 직선
        const a2 = a.x * a.x + a.y * a.y;
        const b2 = b.x * b.x + b.y * b.y;
        const c2 = c.x * c.x + c.y * c.y;
        const ux = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
        const uy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
        const r = Math.hypot(a.x - ux, a.y - uy);
        if (encloses(ux, uy, r)) consider(ux, uy, r);
      }
    }
  }

  return best;
}

/**
 * 최소 외접원의 중심: 가장 먼 참가자까지의 거리를 최소로 하는 지점.
 * 모두에게 고르게 떨어진 만남 지점으로 쓴다(공평도가 가장 높다).
 */
export function minimaxPoint(points) {
  const pts = (points || []).filter(Boolean);
  if (pts.length === 0) return null;
  if (pts.length === 1) return { lat: pts[0].lat, lng: pts[0].lng };
  const originLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const projected = pts.map(p => project(p, originLat));
  const circle = minimumEnclosingCircle(projected);
  if (!circle) return geometricMedian(pts);
  const center = unproject(circle, originLat);
  return { lat: center.lat, lng: center.lng };
}

/**
 * 중간 지점 계산 진입점.
 * mode: 'fair' (기본, 최대 거리 최소) | 'median' (기하 중앙값) | 'centroid' (구면 무게중심)
 */
export function midpoint(points, mode = 'fair') {
  const pts = (points || []).filter(Boolean);
  if (pts.length === 0) return null;
  if (pts.length === 1) return { lat: pts[0].lat, lng: pts[0].lng };
  if (mode === 'centroid') return sphericalCentroid(pts);
  if (mode === 'median') return geometricMedian(pts);
  return minimaxPoint(pts); // 'fair' (기본): 최대 거리 최소
}

/** 중심에서 각 지점까지의 거리(km) 배열 */
export function distancesKm(center, points) {
  if (!center) return [];
  return (points || []).map(p => haversineKm(center, p));
}

export function distanceStats(distances) {
  const ds = (distances || []).filter(Number.isFinite);
  if (ds.length === 0) return null;
  const min = Math.min(...ds);
  const max = Math.max(...ds);
  const total = ds.reduce((s, d) => s + d, 0);
  return { min, max, mean: total / ds.length, total, spread: max - min };
}

/**
 * 공평도 지수(0~100).
 * 모든 사람의 거리가 같으면 100, 한 사람만 멀수록 0에 가까워진다.
 * 100 * (1 − (최대−최소) / (최대+최소))
 */
export function fairnessScore(distances) {
  const ds = (distances || []).filter(Number.isFinite).map(d => Math.abs(d));
  if (ds.length === 0) return null;
  if (ds.length === 1) return 100;
  const max = Math.max(...ds);
  const min = Math.min(...ds);
  if (max + min < 1e-9) return 100;
  return clamp((100 * (1 - (max - min) / (max + min))), 0, 100);
}

export function fairnessGrade(score) {
  if (!Number.isFinite(score)) return { label: '계산 중', tone: 'neutral', hint: '' };
  if (score >= 95) return { label: '완벽한 균형', tone: 'great', hint: '모두 거의 같은 거리예요' };
  if (score >= 85) return { label: '아주 공평해요', tone: 'good', hint: '누구도 크게 손해 보지 않아요' };
  if (score >= 70) return { label: '무난한 균형', tone: 'ok', hint: '조금만 더 조정해 볼까요' };
  if (score >= 50) return { label: '조금 치우쳤어요', tone: 'warn', hint: '한쪽이 더 멀어요' };
  return { label: '한쪽에 쏠렸어요', tone: 'bad', hint: '다른 지점을 함께 살펴보세요' };
}

export function formatKm(km) {
  if (!Number.isFinite(km)) return '—';
  const v = Math.abs(km);
  if (v < 1) return `${Math.round(v * 1000)} m`;
  if (v < 10) return `${v.toFixed(2)} km`;
  if (v < 100) return `${v.toFixed(1)} km`;
  return `${Math.round(v)} km`;
}

export function formatLatLng(point) {
  if (!point) return '—';
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

/** 도보 4.5km/h 기준 소요 시간(분) */
export function walkingMinutes(km) {
  if (!Number.isFinite(km)) return null;
  return Math.max(1, Math.round((Math.abs(km) / 4.5) * 60));
}

/* ------------------------------------------------------------------
   URL 상태 — ?p=lat,lng|lat,lng&n=이름~이름&m=centroid
   ------------------------------------------------------------------ */

export function encodeParticipants(points) {
  return (points || [])
    .filter(Boolean)
    .map(p => `${round5(p.lat)},${round5(p.lng)}`)
    .join('|');
}

export function decodeParticipants(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return { points: [], skipped: 0 };
  const points = [];
  let skipped = 0;
  const chunks = raw.split('|');
  for (const rawChunk of chunks) {
    const chunk = rawChunk.trim();
    if (!chunk) continue;
    if (points.length >= MAX_PARTICIPANTS) {
      skipped += 1;
      continue;
    }
    const [latRaw, lngRaw] = chunk.split(',');
    const point = normalizePoint({ lat: latRaw, lng: lngRaw });
    if (!point) {
      skipped += 1;
      continue;
    }
    points.push(point);
  }
  return { points, skipped };
}

/** 'p=..&n=..&m=..' 형태의 질의 문자열을 만든다. */
export function buildShareQuery(points, mode = 'fair') {
  const list = (points || []).filter(Boolean);
  // 좌표는 숫자·쉼표·파이프뿐이라 인코딩하지 않는다 (?p=37.566,126.978|37.517,127.047)
  const parts = [`p=${encodeParticipants(list)}`];
  const names = list.map((p, i) => p.name || DEFAULT_NAMES(i));
  const usesCustomName = list.some((p, i) => p.name && p.name !== DEFAULT_NAMES(i));
  if (usesCustomName) parts.push(`n=${encodeURIComponent(names.join('~'))}`);
  if (mode && mode !== 'fair') parts.push(`m=${encodeURIComponent(mode)}`);
  return parts.join('&');
}

/** 공유 링크: 기존 쿼리·해시를 지우고 상태만 남긴다. */
export function buildShareUrl(href, points, mode = 'fair') {
  const url = new URL(href);
  url.hash = '';
  url.search = '';
  const cleanPath = url.pathname.replace(/index\.html?$/i, '');
  url.pathname = cleanPath;
  const query = buildShareQuery(points, mode);
  return `${url.origin}${url.pathname}${query ? `?${query}` : ''}`;
}

function parseQueryTokens(str) {
  const map = new Map();
  for (const segment of String(str).split('&')) {
    if (!segment) continue;
    const eq = segment.indexOf('=');
    const rawKey = eq < 0 ? segment : segment.slice(0, eq);
    const rawVal = eq < 0 ? '' : segment.slice(eq + 1);
    let key = rawKey;
    let val = rawVal;
    try {
      key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
      val = decodeURIComponent(rawVal.replace(/\+/g, ' '));
    } catch {
      /* 잘못된 이스케이프는 원문 그대로 쓴다 */
    }
    if (!map.has(key)) map.set(key, val);
  }
  return map;
}

/**
 * 공유 URL/질의 문자열/해시에서 참가자 상태를 읽는다.
 * 유효하지 않은 좌표는 건너뛰고 개수를 센다.
 */
export function parseShareState(input) {
  const result = { points: [], mode: 'fair', skipped: 0, present: false };
  if (typeof input !== 'string' || !input.trim()) return result;

  let rest = input.trim();
  const hashIndex = rest.indexOf('#');
  const hashPart = hashIndex >= 0 ? rest.slice(hashIndex + 1) : '';
  if (hashIndex >= 0) rest = rest.slice(0, hashIndex);
  const qIndex = rest.indexOf('?');
  const queryPart = qIndex >= 0 ? rest.slice(qIndex + 1) : rest;
  // '?'도 '#'도 없는 순수 질의 문자열이면 그대로 토큰으로 본다.
  const primary = qIndex >= 0 || hashIndex >= 0 ? queryPart : (rest.includes('=') ? rest : '');

  const tokens = parseQueryTokens(primary);
  const hashTokens = parseQueryTokens(hashPart);
  const get = key => (tokens.has(key) ? tokens.get(key) : (hashTokens.has(key) ? hashTokens.get(key) : null));

  const p = get('p');
  if (p === null) return result;
  result.present = true;

  const decoded = decodeParticipants(p);
  result.points = decoded.points;
  result.skipped = decoded.skipped;

  const namesRaw = get('n');
  if (namesRaw) {
    const names = namesRaw.split('~');
    result.points = result.points.map((point, i) => {
      const name = sanitizeName(names[i] ?? '');
      return name ? { ...point, name } : point;
    });
  }

  const mode = get('m');
  if (mode === 'centroid' || mode === 'median' || mode === 'fair') result.mode = mode;

  return result;
}

/* ------------------------------------------------------------------
   추천 만남 거점
   stations: [[이름, 위도, 경도, [노선코드…]], …]
   ------------------------------------------------------------------ */

export function stationObjects(stations) {
  return (stations || []).map(([name, lat, lng, lines, meta]) => ({
    name,
    lat,
    lng,
    lines: lines || [],
    ...(meta || {}),
  }));
}

export function nearestStations(point, stations, limit = 3, maxKm = Infinity) {
  if (!point) return [];
  const list = stationObjects(stations);
  const scored = list
    .map(st => ({ ...st, km: haversineKm(point, st) }))
    .filter(st => Number.isFinite(st.km) && st.km <= maxKm)
    .sort((a, b) => a.km - b.km);
  return scored.slice(0, limit);
}

/**
 * 참가자 전원에게 가장 공평한 역 (최대 거리 최소화).
 * midpoint 반경 radiusKm 안의 역만 후보로 둔다.
 */
export function fairestStation(points, stations, options = {}) {
  const list = (points || []).filter(Boolean);
  if (list.length < 2) return null;
  const center = midpoint(list, options.mode || 'fair');
  const radiusKm = options.radiusKm ?? 15;
  const candidates = nearestStations(center, stations, Number.MAX_SAFE_INTEGER, radiusKm);
  if (candidates.length === 0) return null;

  let best = null;
  for (const st of candidates) {
    const ds = list.map(p => haversineKm(st, p));
    const max = Math.max(...ds);
    const sum = ds.reduce((s, d) => s + d, 0);
    if (!best || max < best.maxKm - 1e-9 || (Math.abs(max - best.maxKm) < 1e-9 && sum < best.sumKm)) {
      best = { ...st, maxKm: max, minKm: Math.min(...ds), sumKm: sum, distances: ds };
    }
  }
  return best;
}

export function recommendMeetingSpot(points, spots, options = {}) {
  const list = (points || []).filter(Boolean);
  if (list.length < 2) return null;
  const center = midpoint(list, options.mode || 'fair');
  if (!center) return null;
  const nearBy = nearestStations(center, spots, 3, options.primaryMaxKm ?? 4);
  const primary = nearBy[0] || null;
  const fair = fairestStation(list, options.stations || spots, {
    mode: options.mode,
    radiusKm: options.radiusKm ?? 15,
  });
  const alternative = fair && primary && fair.name !== primary.name && fair.maxKm < primary.maxKm - 0.15 ? fair : null;
  return { center, primary, nearBy, alternative };
}

export function lineMeta(code, lines) {
  const meta = lines && lines[code];
  if (meta) return { code, name: meta.name, color: meta.color };
  return { code, name: code, color: '#8b8f83' };
}
