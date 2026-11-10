/* ==================================================================
   PKPilot0002 단위 테스트 — 중간 지점 엔진 + URL 상태 + 역 추천
   브라우저(tests/unit/index.html)에서 실행: npm test → tests/run_tests.py
   ================================================================== */

import {
  DEFAULT_NAMES,
  MAX_PARTICIPANTS,
  buildShareQuery,
  buildShareUrl,
  decodeParticipants,
  distanceStats,
  distancesKm,
  fairnessGrade,
  fairnessScore,
  fairestStation,
  formatKm,
  formatLatLng,
  geometricMedian,
  haversineKm,
  lineMeta,
  midpoint,
  minimaxPoint,
  nearestStations,
  normalizePoint,
  parseShareState,
  recommendMeetingSpot,
  sanitizeName,
  sphericalCentroid,
  walkingMinutes,
} from '../../js/core.js';
import { LINES, STATIONS } from '../../js/stations.js';
import { assert, assertClose, assertEqual, assertFinitePoint, test } from './harness.js';

const CITY_HALL = { lat: 37.5665, lng: 126.9780 };
const GANGNAM = { lat: 37.4979, lng: 127.0276 };
const HONGDAE = { lat: 37.5567, lng: 126.9236 };
const JONGNO3 = { lat: 37.5700, lng: 126.9917 };
const PANGYO = { lat: 37.3948, lng: 127.1111 };

/* ------------------------------------------------------------------
   1. 거리 계산 (Haversine)
   ------------------------------------------------------------------ */
test('haversine: 같은 지점의 거리는 0', () => {
  assertEqual(haversineKm(CITY_HALL, CITY_HALL), 0);
});

test('haversine: 시청 ↔ 강남 ≈ 8.79km', () => {
  assertClose(haversineKm(CITY_HALL, GANGNAM), 8.7929, 0.01);
});

test('haversine: 서울 ↔ 부산 ≈ 325km', () => {
  assertClose(haversineKm(CITY_HALL, { lat: 35.1796, lng: 129.0756 }), 325.11, 0.5);
});

test('haversine: 위도 1도 ≈ 111.2km', () => {
  assertClose(haversineKm({ lat: 37.5, lng: 127 }, { lat: 38.5, lng: 127 }), 111.195, 0.01);
});

test('haversine: 방향을 바꿔도 같은 거리', () => {
  assertClose(haversineKm(GANGNAM, PANGYO), haversineKm(PANGYO, GANGNAM), 1e-9);
});

test('haversine: 날짜변경선을 넘어가도 유한한 거리', () => {
  const d = haversineKm({ lat: 0, lng: 179.5 }, { lat: 0, lng: -179.5 });
  assertClose(d, 111.19, 0.2);
});

/* ------------------------------------------------------------------
   2. 구면 무게중심
   ------------------------------------------------------------------ */
test('centroid: 두 점의 무게중심은 사이에 있다', () => {
  const c = sphericalCentroid([GANGNAM, HONGDAE]);
  assertFinitePoint(c);
  assert(c.lat > Math.min(GANGNAM.lat, HONGDAE.lat) && c.lat < Math.max(GANGNAM.lat, HONGDAE.lat));
  assert(c.lng > Math.min(GANGNAM.lng, HONGDAE.lng) && c.lng < Math.max(GANGNAM.lng, HONGDAE.lng));
});

test('centroid: 대칭 4점의 무게중심은 중심 근처', () => {
  const c = sphericalCentroid([
    { lat: 37.4, lng: 126.9 }, { lat: 37.6, lng: 126.9 },
    { lat: 37.4, lng: 127.1 }, { lat: 37.6, lng: 127.1 },
  ]);
  // 구면에서는 위도별 경도 둘레가 달라 중심이 정확히 37.5가 아니다(수십 m 편차).
  assertClose(c.lat, 37.5, 5e-3);
  assertClose(c.lng, 127.0, 5e-3);
});

test('centroid: 적도 대칭 4점은 정확히 중심', () => {
  const c = sphericalCentroid([
    { lat: -0.1, lng: -0.1 }, { lat: 0.1, lng: -0.1 },
    { lat: -0.1, lng: 0.1 }, { lat: 0.1, lng: 0.1 },
  ]);
  assertClose(c.lat, 0, 1e-9);
  assertClose(c.lng, 0, 1e-9);
});

test('centroid: 한 점만 있으면 그 점', () => {
  const c = sphericalCentroid([GANGNAM]);
  assertEqual(c.lat, GANGNAM.lat);
  assertEqual(c.lng, GANGNAM.lng);
});

test('centroid: 정반대 두 점에서도 유한한 좌표(NaN 금지)', () => {
  const c = sphericalCentroid([{ lat: 0, lng: 0 }, { lat: 0, lng: 180 }]);
  assertFinitePoint(c);
});

test('centroid: 빈 입력은 null', () => {
  assertEqual(sphericalCentroid([]), null);
});

/* ------------------------------------------------------------------
   3. 기하 중앙값 (Weiszfeld)
   ------------------------------------------------------------------ */
test('median: 두 점에서는 두 점 모두와 같은 거리', () => {
  const m = geometricMedian([GANGNAM, HONGDAE]);
  assertFinitePoint(m);
  assertClose(haversineKm(m, GANGNAM), haversineKm(m, HONGDAE), 0.002);
});

test('median: 두 점 사이 구간 안에 놓인다', () => {
  const m = geometricMedian([GANGNAM, HONGDAE]);
  assert(m.lat > Math.min(GANGNAM.lat, HONGDAE.lat) - 1e-6);
  assert(m.lat < Math.max(GANGNAM.lat, HONGDAE.lat) + 1e-6);
  assert(m.lng > Math.min(GANGNAM.lng, HONGDAE.lng) - 1e-6);
  assert(m.lng < Math.max(GANGNAM.lng, HONGDAE.lng) + 1e-6);
});

test('median: 대칭 4점의 중앙값은 정중앙', () => {
  const m = geometricMedian([
    { lat: 37.4, lng: 126.9 }, { lat: 37.6, lng: 126.9 },
    { lat: 37.4, lng: 127.1 }, { lat: 37.6, lng: 127.1 },
  ]);
  assertClose(m.lat, 37.5, 1e-4);
  assertClose(m.lng, 127.0, 1e-4);
});

test('median: 세 점에서 거리 합이 무게중심·각 지점보다 작다', () => {
  const points = [CITY_HALL, GANGNAM, JONGNO3];
  const m = geometricMedian(points);
  const total = p => points.reduce((s, q) => s + haversineKm(p, q), 0);
  const best = total(m);
  assert(best <= total(sphericalCentroid(points)) + 1e-6, '무게중심보다 나쁘다');
  points.forEach(p => assert(best <= total(p) + 1e-6, '입력 지점보다 나쁘다'));
  // 주변 격자 탐색보다도 나빠서는 안 된다
  for (let dLat = -0.1; dLat <= 0.1001; dLat += 0.02) {
    for (let dLng = -0.1; dLng <= 0.1001; dLng += 0.02) {
      const probe = { lat: m.lat + dLat, lng: m.lng + dLng };
      assert(best <= total(probe) + 1e-6, `격자점(${dLat},${dLng})보다 나쁘다`);
    }
  }
});

test('median: 중복 좌표에서도 NaN 없이 그 지점을 돌려준다', () => {
  const a = { lat: 37.5, lng: 127.0 };
  const b = { lat: 37.6, lng: 127.1 };
  const m = geometricMedian([a, { ...a }, b]);
  assertFinitePoint(m);
  assertClose(m.lat, a.lat, 1e-3);
  assertClose(m.lng, a.lng, 1e-3);
});

test('median: 같은 점 두 개면 그 점', () => {
  const a = { lat: 37.51, lng: 127.01 };
  const m = geometricMedian([a, a, a]);
  assertClose(m.lat, a.lat, 1e-6);
  assertClose(m.lng, a.lng, 1e-6);
});

test('median: 한 점만 있으면 그 점, 빈 입력은 null', () => {
  const m = geometricMedian([GANGNAM]);
  assertEqual(m.lat, GANGNAM.lat);
  assertEqual(geometricMedian([]), null);
});

test('midpoint: 세 가지 모드가 서로 다른 지점을 준다', () => {
  const points = [CITY_HALL, GANGNAM, JONGNO3, PANGYO];
  const fair = midpoint(points, 'fair');
  const median = midpoint(points, 'median');
  const centroid = midpoint(points, 'centroid');
  [fair, median, centroid].forEach(p => assertFinitePoint(p));
  const gap = haversineKm(median, centroid);
  assert(gap > 0.0005 && gap < 3, `모드 차이가 이상하다: ${gap}km`);
  // 기본값은 공평점(최대 거리 최소)
  assertEqual(midpoint(points).lat, fair.lat);
  assertEqual(midpoint(points).lng, fair.lng);
});

test('midpoint: 2명이면 어떤 모드든 같은 지점', () => {
  const points = [GANGNAM, HONGDAE];
  const fair = midpoint(points, 'fair');
  const median = midpoint(points, 'median');
  const centroid = midpoint(points, 'centroid');
  assertClose(haversineKm(fair, median), 0, 0.01);
  assertClose(haversineKm(fair, centroid), 0, 0.05);
});

/* ------------------------------------------------------------------
   3-1. 최대 거리 최소화(공평점)
   ------------------------------------------------------------------ */
test('minimax: 가장 먼 참가자까지의 거리가 median·centroid보다 작다', () => {
  const points = [GANGNAM, HONGDAE, JONGNO3];
  const maxTo = p => Math.max(...points.map(q => haversineKm(p, q)));
  const fair = minimaxPoint(points);
  assertFinitePoint(fair);
  assert(maxTo(fair) <= maxTo(midpoint(points, 'median')) + 1e-6, '균형점보다 나쁘다');
  assert(maxTo(fair) <= maxTo(midpoint(points, 'centroid')) + 1e-6, '무게중심보다 나쁘다');
});

test('minimax: 세 사람 거리가 고르게 퍼진다(공평도 88% 이상)', () => {
  const points = [GANGNAM, HONGDAE, JONGNO3];
  const center = minimaxPoint(points);
  const ds = points.map(p => haversineKm(center, p));
  const spread = Math.max(...ds) - Math.min(...ds);
  // 가장 먼 두 점을 지름으로 하는 원(둔각 삼각형)이 최적해이므로 편차가 0은 아니다.
  assert(spread < 1.2, `거리 편차가 크다: ${spread.toFixed(3)}km`);
  const score = fairnessScore(ds);
  assert(score >= 88, `공평도가 낮다: ${score.toFixed(1)}`);
  assert(score > fairnessScore(distancesKm(midpoint(points, 'median'), points)), '균형점보다 공평해야 한다');
});

test('minimax: 정사각형 4점의 중심은 정중앙', () => {
  const c = minimaxPoint([
    { lat: 37.4, lng: 126.9 }, { lat: 37.6, lng: 126.9 },
    { lat: 37.4, lng: 127.1 }, { lat: 37.6, lng: 127.1 },
  ]);
  assertClose(c.lat, 37.5, 1e-4);
  assertClose(c.lng, 127.0, 1e-4);
});

test('minimax: 한 명이 아주 멀면 그 사람 쪽으로 당겨진다', () => {
  const points = [GANGNAM, { lat: 37.5, lng: 127.02 }, { lat: 37.49, lng: 127.03 }, { lat: 35.18, lng: 129.08 }];
  const fair = minimaxPoint(points);
  const median = midpoint(points, 'median');
  const farDist = p => haversineKm(p, points[3]);
  assert(farDist(fair) < farDist(median), '먼 참가자에게 더 가까워야 한다');
});

test('minimax: 2점이면 중간, 1점이면 그 점', () => {
  const m = minimaxPoint([GANGNAM, HONGDAE]);
  assertClose(haversineKm(m, GANGNAM), haversineKm(m, HONGDAE), 0.002);
  const one = minimaxPoint([GANGNAM]);
  assertEqual(one.lat, GANGNAM.lat);
  assertEqual(minimaxPoint([]), null);
});

test('minimax: 중복 좌표에서도 NaN 없이 계산', () => {
  const a = { lat: 37.5, lng: 127.0 };
  const m = minimaxPoint([a, { ...a }, { lat: 37.6, lng: 127.1 }]);
  assertFinitePoint(m);
  assertClose(haversineKm(m, a), haversineKm(m, { lat: 37.6, lng: 127.1 }), 0.01);
});

/* ------------------------------------------------------------------
   4. 거리 통계 · 공평도
   ------------------------------------------------------------------ */
test('distanceStats: 최소·최대·평균·합계·격차', () => {
  const stats = distanceStats([2, 4, 6]);
  assertEqual(stats.min, 2);
  assertEqual(stats.max, 6);
  assertEqual(stats.mean, 4);
  assertEqual(stats.total, 12);
  assertEqual(stats.spread, 4);
});

test('distanceStats: 빈 배열은 null', () => {
  assertEqual(distanceStats([]), null);
});

test('fairness: 모두 같은 거리면 100', () => {
  assertEqual(fairnessScore([5, 5, 5]), 100);
  assertEqual(fairnessScore([1]), 100);
});

test('fairness: 완전히 한쪽으로 치우치면 0', () => {
  assertEqual(fairnessScore([0, 10]), 0);
});

test('fairness: 편차가 커질수록 점수가 낮아진다', () => {
  const a = fairnessScore([5, 5, 5]);
  const b = fairnessScore([5, 5, 6]);
  const c = fairnessScore([5, 5, 12]);
  assert(a > b && b > c, `${a} > ${b} > ${c} 이어야 한다`);
  assert(b > 85 && b < 100);
});

test('fairness: 빈 배열은 null', () => {
  assertEqual(fairnessScore([]), null);
});

test('fairness: 등급 라벨', () => {
  assertEqual(fairnessGrade(99).tone, 'great');
  assertEqual(fairnessGrade(88).tone, 'good');
  assertEqual(fairnessGrade(75).tone, 'ok');
  assertEqual(fairnessGrade(55).tone, 'warn');
  assertEqual(fairnessGrade(20).tone, 'bad');
});

test('distancesKm: 중심에서 각 지점까지 거리 개수와 값', () => {
  const center = midpoint([GANGNAM, HONGDAE]);
  const ds = distancesKm(center, [GANGNAM, HONGDAE]);
  assertEqual(ds.length, 2);
  ds.forEach(d => assert(Number.isFinite(d) && d > 0));
  assertClose(ds[0], ds[1], 0.002);
});

/* ------------------------------------------------------------------
   5. 좌표 정규화
   ------------------------------------------------------------------ */
test('normalizePoint: 숫자 문자열 허용, 빈 문자열은 거부', () => {
  assertFinitePoint(normalizePoint({ lat: '37.5', lng: '127.0' }));
  assertEqual(normalizePoint({ lat: '37.5', lng: '' }), null);
  assertEqual(normalizePoint({ lat: 37.5 }), null);
  assertEqual(normalizePoint({ lat: 91, lng: 127 }), null);
  assertEqual(normalizePoint({ lat: 37.5, lng: 181 }), null);
  assertEqual(normalizePoint(null), null);
  assertEqual(normalizePoint({ lat: NaN, lng: 127 }), null);
});

test('normalizePoint: 이름은 다듬고 구분자는 지운다', () => {
  const p = normalizePoint({ lat: 37.5, lng: 127, name: '  재혁~민지|수  ' });
  assertEqual(p.name, '재혁 민지 수');
  assertEqual(sanitizeName('a'.repeat(80)).length, 32);
});

/* ------------------------------------------------------------------
   6. URL 상태
   ------------------------------------------------------------------ */
const SAMPLE = [GANGNAM, HONGDAE, JONGNO3, PANGYO];

test('encode/decode: 좌표 왕복', () => {
  const encoded = SAMPLE.map(p => `${p.lat},${p.lng}`).join('|');
  const decoded = decodeParticipants(encoded);
  assertEqual(decoded.points.length, 4);
  decoded.points.forEach((p, i) => {
    assertClose(p.lat, SAMPLE[i].lat, 1e-9);
    assertClose(p.lng, SAMPLE[i].lng, 1e-9);
  });
});

test('decode: 잘못된 좌표는 건너뛰고 개수를 센다', () => {
  const decoded = decodeParticipants('37.5,127.0|abc,def|37.6,127.1|91,127|37.7');
  assertEqual(decoded.points.length, 2);
  assertEqual(decoded.skipped, 3);
});

test('decode: 빈 토큰은 조용히 넘어간다', () => {
  const decoded = decodeParticipants('37.5,127.0||37.6,127.1|');
  assertEqual(decoded.points.length, 2);
  assertEqual(decoded.skipped, 0);
});

test('decode: 최대 인원을 넘으면 잘라낸다', () => {
  const many = Array.from({ length: MAX_PARTICIPANTS + 3 }, (_, i) => `37.${500 + i},127.0`).join('|');
  const decoded = decodeParticipants(many);
  assertEqual(decoded.points.length, MAX_PARTICIPANTS);
  assertEqual(decoded.skipped, 3);
});

test('parseShareState: 질의 문자열에서 좌표·이름·모드를 읽는다', () => {
  const query = buildShareQuery(
    [{ ...GANGNAM, name: '재혁' }, { ...HONGDAE, name: '민지' }],
    'centroid',
  );
  const parsed = parseShareState(`?${query}`);
  assertEqual(parsed.present, true);
  assertEqual(parsed.points.length, 2);
  assertEqual(parsed.points[0].name, '재혁');
  assertEqual(parsed.points[1].name, '민지');
  assertEqual(parsed.mode, 'centroid');
  assertEqual(parsed.skipped, 0);
});

test('parseShareState: 기본 이름은 URL에 담지 않고 기본값으로 채운다', () => {
  const query = buildShareQuery([GANGNAM, HONGDAE], 'median');
  assert(!query.includes('n='), '기본 이름이 URL에 들어갔다');
  const parsed = parseShareState(`?${query}`);
  assertEqual(parsed.points.length, 2);
  assert(!parsed.points[0].name, '이름이 없어야 한다');
  assertEqual(DEFAULT_NAMES(0), 'Person 1');
});

test('parseShareState: 한글 이름이 깨지지 않는다', () => {
  const query = buildShareQuery([{ ...GANGNAM, name: '춘향이 & 친구' }, HONGDAE], 'median');
  const parsed = parseShareState(`?${query}`);
  assertEqual(parsed.points[0].name, '춘향이 & 친구');
});

test('parseShareState: 해시 형태와 전체 URL도 읽는다', () => {
  const hash = parseShareState('#p=37.5,127.0|37.6,127.1');
  assertEqual(hash.points.length, 2);
  const full = parseShareState('https://hyangdan2.github.io/PKPilot0002/?p=37.5,127.0&m=centroid');
  assertEqual(full.points.length, 1);
  assertEqual(full.mode, 'centroid');
});

test('parseShareState: 상태가 없으면 present=false', () => {
  const empty = parseShareState('https://hyangdan2.github.io/PKPilot0002/');
  assertEqual(empty.present, false);
  assertEqual(empty.mode, 'fair');
  assertEqual(empty.points.length, 0);
  assertEqual(parseShareState('').present, false);
});

test('buildShareUrl: index.html을 떼고 좌표만 남긴다', () => {
  const url = buildShareUrl('https://hyangdan2.github.io/PKPilot0002/index.html?x=1#y', [GANGNAM, HONGDAE], 'median');
  assert(url.startsWith('https://hyangdan2.github.io/PKPilot0002/?p='), url);
  assert(!url.includes('index.html'));
  assert(!url.includes('#'));
  assert(!url.includes('x=1'));
  const parsed = parseShareState(url);
  assertEqual(parsed.points.length, 2);
});

test('buildShareUrl: 5자리 정밀도(약 1m)로 왕복한다', () => {
  const point = { lat: 37.497928, lng: 127.027583 };
  const url = buildShareUrl('https://hyangdan2.github.io/PKPilot0002/', [point, HONGDAE]);
  const parsed = parseShareState(url);
  assertClose(parsed.points[0].lat, point.lat, 1e-5);
  assertClose(parsed.points[0].lng, point.lng, 1e-5);
});

/* ------------------------------------------------------------------
   7. 추천 만남 거점
   ------------------------------------------------------------------ */
const SYNTH = [
  ['가역', 37.5, 127.0, ['2']],
  ['나역', 37.6, 127.0, ['3']],
  ['다역', 37.55, 127.0, ['4']],
  ['라역', 37.52, 127.0, ['5']],
  ['먼역', 37.9, 127.0, []],
];

test('nearestStations: 가장 가까운 역부터 정렬', () => {
  const list = nearestStations({ lat: 37.55, lng: 127.0 }, SYNTH, 3);
  assertEqual(list.length, 3);
  assertEqual(list[0].name, '다역');
  assert(list[0].km < list[1].km && list[1].km < list[2].km);
});

test('nearestStations: 반경 밖은 제외', () => {
  const list = nearestStations({ lat: 37.55, lng: 127.0 }, SYNTH, 10, 12);
  assert(!list.some(st => st.name === '먼역'), '먼 역이 포함됐다');
  assertEqual(nearestStations({ lat: 37.55, lng: 127.0 }, SYNTH, 10, 0.1).length, 1);
});

test('fairestStation: 최대 거리를 가장 줄이는 역을 고른다', () => {
  const points = [{ lat: 37.5, lng: 127.0 }, { lat: 37.6, lng: 127.0 }];
  const best = fairestStation(points, SYNTH, { radiusKm: 30 });
  assertEqual(best.name, '다역');
  assertClose(best.maxKm, haversineKm(best, points[0]), 1e-6);
  assert(best.maxKm < 6, `최대 거리가 너무 크다: ${best.maxKm}`);
});

test('recommendMeetingSpot: 중심에서 가장 가까운 역을 추천', () => {
  const points = [GANGNAM, HONGDAE, JONGNO3];
  const rec = recommendMeetingSpot(points, STATIONS, { mode: 'median' });
  assertFinitePoint(rec.center);
  assert(rec.primary, '추천 역이 없다');
  assert(rec.primary.km <= 4, `추천 역이 너무 멀다: ${rec.primary.km}`);
  assert(rec.primary.name.endsWith('역'), rec.primary.name);
  assert(Array.isArray(rec.primary.lines));
});

test('recommendMeetingSpot: 실제 좌표에서 가까운 역이 강남역', () => {
  const rec = recommendMeetingSpot([GANGNAM, { lat: 37.4985, lng: 127.0260 }], STATIONS);
  assertEqual(rec.primary.name, '강남역');
  assert(rec.primary.km < 0.5);
});

test('recommendMeetingSpot: 2명 미만이면 null', () => {
  assertEqual(recommendMeetingSpot([GANGNAM], STATIONS), null);
  assertEqual(recommendMeetingSpot([], STATIONS), null);
});

test('stations: 노선 메타데이터', () => {
  const meta = lineMeta('2', LINES);
  assertEqual(meta.name, '2호선');
  assertEqual(meta.color, '#00A84D');
  assertEqual(lineMeta('없는노선', LINES).color, '#8b8f83');
  assert(STATIONS.length > 400, `역 데이터가 너무 적다: ${STATIONS.length}`);
  const names = new Set(STATIONS.map(row => row[0]));
  assert(names.has('강남역') && names.has('홍대입구역') && names.has('판교역'));
  assert(STATIONS.every(row => row.length >= 3 && Number.isFinite(row[1]) && Number.isFinite(row[2])));
});

/* ------------------------------------------------------------------
   8. 표시 형식
   ------------------------------------------------------------------ */
test('formatKm: 미터/킬로미터 표기', () => {
  assertEqual(formatKm(0.32), '320 m');
  assertEqual(formatKm(0.0005), '1 m');
  assertEqual(formatKm(9.021), '9.02 km');
  assertEqual(formatKm(12.34), '12.3 km');
  assertEqual(formatKm(120.4), '120 km');
  assertEqual(formatKm(NaN), '—');
});

test('formatLatLng: 소수점 5자리', () => {
  assertEqual(formatLatLng({ lat: 37.5665, lng: 126.978 }), '37.56650, 126.97800');
  assertEqual(formatLatLng(null), '—');
});

test('walkingMinutes: 4.5km/h 기준', () => {
  assertEqual(walkingMinutes(1), 13);
  assertEqual(walkingMinutes(0.1), 1);
  assertEqual(walkingMinutes(NaN), null);
});
