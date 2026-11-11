/* ==================================================================
   PKPilot0002 단위 테스트 — 주변 맛집·카페 POI · 1차+2차 약속 코스 · 딥링크
   브라우저(tests/unit/index.html)에서 실행: npm test → tests/run_tests.py
   ================================================================== */

import {
  COURSE_MAX_M,
  COURSE_MIN_M,
  PLACE_RADIUS_KM,
  findNearbyPlaces,
  formatMeters,
  haversineKm,
  recommendMeetingCourse,
  resolveHub,
  walkMinutesForMeters,
} from '../../js/core.js';
import {
  kakaoWalkRouteUrl,
  naverDirectionsUrl,
  placeSearchQuery,
  placeSearchUrl,
} from '../../js/directions.js';
import { HUBS, PLACES, PLACES_META } from '../../js/places.js';
import { assert, assertClose, assertEqual, assertFinitePoint, test } from './harness.js';

const GANGNAM = { name: '강남역', lat: 37.497928, lng: 127.027583 };
const HONGDAE = { name: '홍대입구역', lat: 37.556667, lng: 126.923611 };
const JONGNO = { name: '종로3가역', lat: 37.57, lng: 126.991667 };
const NOWHERE = { name: '없는곳', lat: 35.0, lng: 127.5 }; // 허브 반경 밖 (전남 외곽)
const byName = (rows, name) => rows.find(row => row.name === name);

/* ------------------------------------------------------------------
   1. 거점(hub) 찾기
   ------------------------------------------------------------------ */
test('resolveHub: 이름이 같은 허브를 먼저 찾는다', () => {
  const hub = resolveHub(GANGNAM, HUBS);
  assert(hub, '강남역 허브가 없다');
  assertEqual(hub.id, 'gangnam');
  assertEqual(hub.matchedBy, 'name');
});

test('resolveHub: spots 별칭으로 붙는다 (중앙로역 → 대구 동성로)', () => {
  const hub = resolveHub({ name: '중앙로역', lat: 35.870988, lng: 128.594024 }, HUBS);
  assert(hub, '중앙로역이 동성로 허브에 붙지 않았다');
  assertEqual(hub.id, 'dongseongno');
});

test('resolveHub: 이름이 달라도 가까우면 가장 가까운 허브', () => {
  // 잠실새내역은 잠실 허브 spots에 있지만, 이름을 모르는 지점도 근접 매칭된다.
  const hub = resolveHub({ name: '송정역(부산)', lat: 35.1585, lng: 129.0600 }, HUBS);
  assert(hub && hub.id === 'seomyeon', `서면 허브 근접 매칭 실패: ${hub && hub.id}`);
  assertEqual(hub.matchedBy, 'near');
});

test('resolveHub: 먼 곳은 null (fallback 경로)', () => {
  assertEqual(resolveHub(NOWHERE, HUBS), null);
});

/* ------------------------------------------------------------------
   2. 반경 필터링 · 종류 필터 · 정렬
   ------------------------------------------------------------------ */
test('findNearbyPlaces: 강남역 반경 안의 장소만, 가까운 순', () => {
  const nearby = findNearbyPlaces(GANGNAM, PLACES, { hubs: HUBS });
  assert(nearby.hub && nearby.hub.id === 'gangnam');
  assert(nearby.places.length > 0, '강남역 주변 장소가 없다');
  assert(nearby.counts.restaurant > 0 && nearby.counts.cafe > 0, '맛집·카페가 모두 있어야 한다');
  let previous = -1;
  for (const place of nearby.places) {
    assert(place.fromSpotMeters >= previous - 0.001 || place.parking, `${place.name} 정렬이 어긋났다`);
    previous = place.fromSpotMeters;
    assert(place.fromSpotMeters <= PLACE_RADIUS_KM * 1000, `${place.name} 이 반경을 넘었다: ${place.fromSpotMeters}m`);
  }
});

test('findNearbyPlaces: kind 를 주면 그 종류만 돌려준다', () => {
  const restaurants = findNearbyPlaces(GANGNAM, PLACES, { hubs: HUBS, kind: 'restaurant' });
  assert(restaurants.places.length === restaurants.counts.restaurant);
  assert(restaurants.places.every(place => place.kind === 'restaurant'));
  const cafes = findNearbyPlaces(GANGNAM, PLACES, { hubs: HUBS, kind: 'cafe' });
  assert(cafes.places.every(place => place.kind === 'cafe'));
});

test('findNearbyPlaces: 반경을 좁히면 결과가 줄어든다', () => {
  const wide = findNearbyPlaces(GANGNAM, PLACES, { hubs: HUBS, radiusKm: 1.0 });
  const narrow = findNearbyPlaces(GANGNAM, PLACES, { hubs: HUBS, radiusKm: 0.3 });
  assert(narrow.places.length < wide.places.length, '좁은 반경에서 결과가 줄지 않았다');
  assert(narrow.places.every(place => place.fromSpotMeters <= 300));
});

test('findNearbyPlaces: 자차 모드는 주차 가능한 곳을 앞세운다', () => {
  const hubWithParking = HUBS.find(hub => PLACES.filter(p => p.hubId === hub.id).filter(p => p.tags.includes('주차')).length >= 3);
  if (!hubWithParking) return; // 주차 태그가 있는 허브가 없으면 건너뛴다
  const spot = { name: hubWithParking.name, lat: hubWithParking.lat, lng: hubWithParking.lng };
  const transit = findNearbyPlaces(spot, PLACES, { hubs: HUBS, travelMode: 'transit' });
  const car = findNearbyPlaces(spot, PLACES, { hubs: HUBS, travelMode: 'car' });
  const firstParkingRank = car.places.findIndex(place => place.parking);
  const transitFirstParkingRank = transit.places.findIndex(place => place.parking);
  assert(firstParkingRank >= 0, '자차 모드에 주차 장소가 없다');
  assert(firstParkingRank <= transitFirstParkingRank + 2, '자차 모드에서 주차 장소가 앞으로 오지 않았다');
});

test('findNearbyPlaces: 허브가 없는 거점은 빈 결과 (지도 검색 fallback)', () => {
  const nearby = findNearbyPlaces(NOWHERE, PLACES, { hubs: HUBS });
  assertEqual(nearby.hub, null);
  assertEqual(nearby.places.length, 0);
  assertEqual(nearby.counts.restaurant, 0);
});

test('findNearbyPlaces: 장소 데이터가 없어도 예외 없이 빈 결과', () => {
  assertEqual(findNearbyPlaces(GANGNAM, [], { hubs: HUBS }).places.length, 0);
  assertEqual(findNearbyPlaces(null, PLACES, { hubs: HUBS }).places.length, 0);
});

/* ------------------------------------------------------------------
   3. 1차+2차 약속 코스
   ------------------------------------------------------------------ */
test('recommendMeetingCourse: 강남역 코스는 2~5분 도보 구간을 고른다', () => {
  const result = recommendMeetingCourse(GANGNAM, PLACES, { hubs: HUBS });
  assert(result.courses.length > 0, '강남역 코스가 없다');
  const course = result.courses[0];
  assertEqual(course.restaurant.kind, 'restaurant');
  assertEqual(course.cafe.kind, 'cafe');
  assert(course.restaurant.id !== course.cafe.id);
  assertEqual(course.walkMinutes, walkMinutesForMeters(course.walkMeters));
  assertEqual(course.totalMinutes, course.restaurant.fromSpotMinutes + course.walkMinutes);
  assert(course.ideal, `이상 구간(100~350m)이 아닌 코스: ${course.walkMeters}m`);
  assert(course.walkMeters >= COURSE_MIN_M && course.walkMeters <= COURSE_MAX_M);
});

test('recommendMeetingCourse: 코스마다 식당·카페가 겹치지 않는다', () => {
  const result = recommendMeetingCourse(GANGNAM, PLACES, { hubs: HUBS, limit: 3 });
  const restaurants = new Set(result.courses.map(course => course.restaurant.id));
  const cafes = new Set(result.courses.map(course => course.cafe.id));
  assertEqual(restaurants.size, result.courses.length);
  assertEqual(cafes.size, result.courses.length);
  assert(result.courses.length <= 3);
});

test('recommendMeetingCourse: 코스의 도보 구간이 여유 범위(80~600m)를 지킨다', () => {
  const result = recommendMeetingCourse(GANGNAM, PLACES, { hubs: HUBS, limit: 3 });
  for (const course of result.courses) {
    assert(course.walkMeters >= 80 && course.walkMeters <= 600, `도보 구간 ${course.walkMeters}m`);
  }
});

test('recommendMeetingCourse: 카페가 없는 거점은 코스 없이 목록만 (fallback)', () => {
  const spot = { name: '광주송정역', lat: 35.1374, lng: 126.791 };
  const nearby = findNearbyPlaces(spot, PLACES, { hubs: HUBS });
  const onlyRestaurants = nearby.places.filter(place => place.kind === 'restaurant');
  const result = recommendMeetingCourse(spot, onlyRestaurants, { hubs: HUBS });
  assertEqual(result.courses.length, 0);
  assert(result.nearby.counts.restaurant > 0 || nearby.counts.restaurant === 0);
});

test('recommendMeetingCourse: 거점이 허브 밖이면 코스 없음', () => {
  const result = recommendMeetingCourse(NOWHERE, PLACES, { hubs: HUBS });
  assertEqual(result.hub, null);
  assertEqual(result.courses.length, 0);
});

test('recommendMeetingCourse: 홍대·종로에서도 코스가 나온다', () => {
  for (const spot of [HONGDAE, JONGNO]) {
    const result = recommendMeetingCourse(spot, PLACES, { hubs: HUBS });
    assert(result.courses.length > 0, `${spot.name} 코스가 없다`);
    assert(result.courses[0].ideal, `${spot.name} 첫 코스가 이상 구간이 아니다`);
  }
});

test('recommendMeetingCourse: 자차 모드에서도 코스가 깨지지 않는다', () => {
  const result = recommendMeetingCourse(GANGNAM, PLACES, { hubs: HUBS, travelMode: 'car' });
  assert(result.courses.length > 0);
  assert(result.courses.every(course => Number.isFinite(course.totalMinutes) && course.totalMinutes > 0));
});

/* ------------------------------------------------------------------
   4. 딥링크 (fallback 검색 · 도보 길찾기)
   ------------------------------------------------------------------ */
test('placeSearchQuery: 거점 이름 + 종류', () => {
  assertEqual(placeSearchQuery('강남역', 'restaurant'), '강남역 맛집');
  assertEqual(placeSearchQuery('강남역', 'cafe'), '강남역 카페');
  assertEqual(placeSearchQuery('김해시청역', 'dessert'), '김해시청역 디저트 카페');
  assertEqual(placeSearchQuery('', 'restaurant'), '맛집');
});

test('placeSearchUrl: 네이버·카카오 지도 검색 딥링크', () => {
  const naver = placeSearchUrl('naver', '강남역 맛집');
  const kakao = placeSearchUrl('kakao', '강남역 맛집');
  assert(naver.startsWith('https://map.naver.com/p/search/'), naver);
  assert(kakao.startsWith('https://map.kakao.com/link/search/'), kakao);
  assert(naver.includes(encodeURIComponent('강남역 맛집')), naver);
  assert(!naver.includes(' '), '공백이 인코딩되지 않았다');
  assertEqual(placeSearchUrl('naver', 'a&b'), 'https://map.naver.com/p/search/a%26b');
});

test('naverDirectionsUrl: 도보 구간은 /walk 로 끝난다', () => {
  const url = naverDirectionsUrl({
    from: { name: '식당', lat: 37.5, lng: 127.0 },
    to: { name: '카페', lat: 37.501, lng: 127.002 },
    travelMode: 'walk',
  });
  assert(url.startsWith('https://map.naver.com/p/directions/'), url);
  assert(url.endsWith('/walk'), url);
  assert(url.includes(encodeURIComponent('식당')), url);
});

test('naverDirectionsUrl: 자차·대중교통 구간 표기 유지', () => {
  const car = naverDirectionsUrl({ from: { name: 'A', lat: 37.5, lng: 127 }, to: { name: 'B', lat: 37.6, lng: 127.1 }, travelMode: 'car' });
  const transit = naverDirectionsUrl({ from: { name: 'A', lat: 37.5, lng: 127 }, to: { name: 'B', lat: 37.6, lng: 127.1 } });
  assert(car.endsWith('/car'));
  assert(transit.endsWith('/transit'));
});

test('kakaoWalkRouteUrl: sName·eName·by=FOOT', () => {
  const url = kakaoWalkRouteUrl({
    from: { name: '1차 식당', lat: 37.5, lng: 127 },
    to: { name: '2차 카페', lat: 37.502, lng: 127.002 },
  });
  assert(url.startsWith('https://map.kakao.com/?'), url);
  assert(url.includes('by=FOOT'), url);
  assert(url.includes(`sName=${encodeURIComponent('1차 식당')}`), url);
  assert(url.includes(`eName=${encodeURIComponent('2차 카페')}`), url);
});

/* ------------------------------------------------------------------
   5. 표기 도우미
   ------------------------------------------------------------------ */
test('walkMinutesForMeters: 75m/분 · 길 보정 1.25배', () => {
  assertEqual(walkMinutesForMeters(75), 1);
  assertEqual(walkMinutesForMeters(240), 4);
  assertEqual(walkMinutesForMeters(300), 5);
  assertEqual(walkMinutesForMeters(0), 1);
  assertEqual(walkMinutesForMeters(NaN), null);
});

test('formatMeters: m · km 표기', () => {
  assertEqual(formatMeters(240), '240 m');
  assertEqual(formatMeters(999), '999 m');
  assertEqual(formatMeters(1250), '1.3 km');
  assertEqual(formatMeters(NaN), '—');
});

/* ------------------------------------------------------------------
   6. 데이터 정합성 — 전국 거점 POI (js/places.js)
   ------------------------------------------------------------------ */
test('데이터: 거점 30곳 · 맛집·카페 1000곳 이상', () => {
  assertEqual(HUBS.length, 30);
  assert(PLACES.length >= 1000, `장소가 너무 적다: ${PLACES.length}`);
  assertEqual(PLACES_META.places, PLACES.length);
  assertEqual(PLACES_META.hubs, HUBS.length);
  const restaurants = PLACES.filter(place => place.kind === 'restaurant').length;
  const cafes = PLACES.filter(place => place.kind === 'cafe').length;
  assert(restaurants > 400 && cafes > 200, `맛집 ${restaurants} · 카페 ${cafes}`);
});

test('데이터: 모든 거점에 맛집과 카페가 하나 이상', () => {
  for (const hub of HUBS) {
    const own = PLACES.filter(place => place.hubId === hub.id);
    assert(own.length > 0, `${hub.name} 장소가 없다`);
    assert(own.some(place => place.kind === 'restaurant'), `${hub.name} 맛집이 없다`);
  }
  const cafeHubs = HUBS.filter(hub => PLACES.some(place => place.hubId === hub.id && place.kind === 'cafe'));
  assert(cafeHubs.length >= HUBS.length - 2, `카페가 없는 거점이 너무 많다: ${HUBS.length - cafeHubs.length}곳`);
});

test('데이터: 좌표·거리·도보 시간이 유효하고 반경 800m 안', () => {
  const hubById = new Map(HUBS.map(hub => [hub.id, hub]));
  const ids = new Set();
  for (const place of PLACES) {
    assert(!ids.has(place.id), `중복 id: ${place.id}`);
    ids.add(place.id);
    assertFinitePoint(place, place.name);
    const hub = hubById.get(place.hubId);
    assert(hub, `허브를 찾을 수 없다: ${place.hubId}`);
    assertEqual(place.hubName, hub.name);
    const meters = haversineKm(hub, place) * 1000;
    assert(meters <= 800 + 5, `${place.name} 이 거점에서 ${Math.round(meters)}m — 800m 초과`);
    assert(place.distMeters > 0 && place.distMeters <= 800, `${place.name} distMeters ${place.distMeters}`);
    assert(place.walkMinutes >= 1 && place.walkMinutes <= 20, `${place.name} walkMinutes ${place.walkMinutes}`);
    assert(['restaurant', 'cafe'].includes(place.kind), `${place.name} kind ${place.kind}`);
    assert(typeof place.category === 'string' && place.category.length > 0, `${place.name} 카테고리 없음`);
    assert(Array.isArray(place.tags), `${place.name} tags 없음`);
  }
});

test('데이터: 지도 링크가 https 네이버·카카오 주소', () => {
  for (const place of PLACES) {
    assert(place.naverUrl.startsWith('https://map.naver.com/'), place.naverUrl);
    assert(place.kakaoUrl.startsWith('https://map.kakao.com/'), place.kakaoUrl);
    assert(!place.naverUrl.includes(' '), `공백 미인코딩: ${place.naverUrl}`);
  }
});

test('데이터: 허브마다 추천 코스가 최소 1개 (식당·카페가 넉넉한 곳)', () => {
  const rich = HUBS.filter(hub =>
    PLACES.filter(place => place.hubId === hub.id && place.kind === 'restaurant').length >= 4
    && PLACES.filter(place => place.hubId === hub.id && place.kind === 'cafe').length >= 3);
  assert(rich.length >= 20, `코스를 만들 수 있는 거점이 ${rich.length}곳뿐`);
  const missing = [];
  for (const hub of rich) {
    const result = recommendMeetingCourse(
      { name: hub.name, lat: hub.lat, lng: hub.lng },
      PLACES,
      { hubs: HUBS },
    );
    if (!result.courses.length) missing.push(hub.name);
  }
  assert(missing.length === 0, `코스가 없는 거점: ${missing.join(', ')}`);
});

test('데이터: 서울 주요 거점의 POI 이름은 비어 있지 않다', () => {
  for (const name of ['강남역', '홍대입구역', '신촌역', '종로3가역', '서울역', '잠실역']) {
    const hub = byName(HUBS, name);
    assert(hub, `${name} 허브 없음`);
    const own = PLACES.filter(place => place.hubId === hub.id);
    assert(own.length >= 20, `${name} 장소가 ${own.length}곳뿐`);
    assert(own.every(place => place.name && place.name.trim().length > 0));
  }
});

test('데이터: 거점 좌표와 장소 거리 표기가 서로 맞는다', () => {
  const place = PLACES.find(item => item.hubId === 'gangnam');
  const hub = byName(HUBS, '강남역');
  const meters = haversineKm(hub, place) * 1000;
  assertClose(place.distMeters, meters, 2, `${place.name} 거리 표기`);
});
