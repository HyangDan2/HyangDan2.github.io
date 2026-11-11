/* ==================================================================
   PKPilot0002 단위 테스트 — 실시간 인앱 맛집·카페 조회 (js/live_places.js)
   Overpass / OSM 지도 API 응답 파싱 · 분류 · 정제 · 캐시 · 미러 fallback
   브라우저(tests/unit/index.html)에서 실행: npm test → tests/run_tests.py
   ================================================================== */

import {
  buildOsmMapUrl,
  buildOverpassQuery,
  bboxFor,
  classifyPlace,
  cleanPlaceName,
  clearLiveCache,
  getCachedLive,
  isNonFoodName,
  liveAttemptPlan,
  liveCacheKey,
  loadLivePlaces,
  needsLiveSearch,
  parseLiveElements,
  parseLivePayload,
  refineCategory,
} from '../../js/live_places.js';
import {
  mergePlaceSources,
  rankPlacesAround,
  recommendMeetingCourse,
} from '../../js/core.js';
import { PLACES } from '../../js/places.js';
import { assert, assertClose, assertEqual, test } from './harness.js';

const SADANG = { name: '사당역', lat: 37.4766, lng: 126.9816 };
const GANGNAM = { name: '강남역', lat: 37.497928, lng: 127.027583 };

/** 사당역 근처를 흉내 낸 Overpass 응답 (node·way center·주차장·쓰레기 포함) */
function overpassFixture() {
  return {
    elements: [
      {
        type: 'node', id: 1, lat: 37.4768, lon: 126.9819,
        tags: { amenity: 'restaurant', name: '사당 손칼국수', cuisine: 'korean', opening_hours: 'Mo-Su 10:00-21:00' },
      },
      {
        type: 'node', id: 2, lat: 37.4772, lon: 126.9822,
        tags: { amenity: 'cafe', name: '카페 모퉁이', outdoor_seating: 'yes', opening_hours: 'Mo-Su 09:00-22:00' },
      },
      {
        type: 'way', id: 3, center: { lat: 37.4761, lon: 126.9811 },
        tags: { amenity: 'bakery', name: '사당 제과', 'name:ko': '사당 제과점', shop: 'bakery' },
      },
      {
        type: 'node', id: 4, lat: 37.4763, lon: 126.9809,
        tags: { amenity: 'restaurant', name: '스타벅스 사당역점' }, // 카페가 아니라 식당으로 잘못 올라온 경우
      },
      { type: 'node', id: 5, lat: 37.4765, lon: 126.9812, tags: { amenity: 'restaurant' } }, // 이름 없음
      {
        type: 'node', id: 6, lat: 37.4767, lon: 126.9813,
        tags: { amenity: 'restaurant', name: '사당 편의점' }, // 음식점이 아닌 시설
      },
      {
        type: 'node', id: 7, lat: 37.5100, lon: 126.9816,
        tags: { amenity: 'restaurant', name: '멀리 있는 식당' }, // 반경 3.7km
      },
      { type: 'node', id: 8, lat: 37.4771, lon: 126.9818, tags: { amenity: 'parking' } }, // 주차장
      {
        type: 'node', id: 9, lat: 37.4773, lon: 126.9825,
        tags: { amenity: 'restaurant', name: '사당 국밥', cuisine: 'gukbap' },
      },
      {
        type: 'node', id: 10, lat: 37.4772, lon: 126.9824,
        tags: { amenity: 'restaurant', name: '사당 국밥' }, // 40m 안 중복(태그 적음)
      },
      {
        type: 'node', id: 11, lat: 37.4770, lon: 126.9821,
        tags: { amenity: 'fast_food', name: '사당 버거' },
      },
      {
        type: 'node', id: 12, lat: 37.4774, lon: 126.9823,
        tags: { amenity: 'ice_cream', name: '사당 아이스크림' },
      },
    ],
  };
}

/* ------------------------------------------------------------------
   1. 요청(query) 만들기
   ------------------------------------------------------------------ */
test('buildOverpassQuery: 반경·좌표·업종·이름 필터를 담는다', () => {
  const query = buildOverpassQuery(37.4766, 126.9816, 1);
  assert(query.includes('around:1000,37.476600,126.981600'), query);
  assert(query.includes('restaurant|cafe|fast_food|bakery'), '음식 업종 필터가 없다');
  assert(query.includes('["name"]'), '이름 있는 POI 만 받아야 한다');
  assert(query.includes('way["amenity"'), 'way 도 포함해야 한다');
  assert(query.includes('out center'), 'way 중심 좌표를 받아야 한다');
  const wide = buildOverpassQuery(37.4766, 126.9816, 2);
  assert(wide.includes('around:2000,'), '반경을 넓힌 쿼리가 아니다');
});

test('bboxFor / buildOsmMapUrl: 반경 1km 사각형', () => {
  const box = bboxFor(37.4766, 126.9816, 1);
  assert(box.south < 37.4766 && box.north > 37.4766, '남북 범위가 뒤집혔다');
  assert(box.west < 126.9816 && box.east > 126.9816, '동서 범위가 뒤집혔다');
  assertClose((box.north - box.south) * 111.32, 2, 0.1);
  const url = buildOsmMapUrl(37.4766, 126.9816, 1);
  assert(url.startsWith('https://api.openstreetmap.org/api/0.6/map.json?bbox='), url);
  const [, bbox] = url.split('?bbox=');
  assertEqual(bbox.split(',').length, 4);
});

test('liveAttemptPlan: Overpass 미러 다음에 OSM 지도 API 후퇴로가 붙는다', () => {
  const plan = liveAttemptPlan(37.4766, 126.9816, 1);
  assert(plan.length >= 4, `시도 계획이 너무 적다: ${plan.length}`);
  assertEqual(plan[0].kind, 'overpass');
  assert(plan.some(item => item.kind === 'osm-map'), 'OSM 지도 API 후퇴로가 없다');
  assert(plan.every((item, i) => i === 0 || item.delayMs >= 0), '지연 값이 이상하다');
  const delays = plan.map(item => item.delayMs);
  assert(Math.max(...delays) < 12000, `fallback 이 너무 늦다: ${delays}`);
});

/* ------------------------------------------------------------------
   2. 이름 정제 · 분류
   ------------------------------------------------------------------ */
test('cleanPlaceName: name:ko 우선 · 공백 정리 · 긴 꼬리 괄호 제거', () => {
  assertEqual(cleanPlaceName({ name: '사당 제과', 'name:ko': '사당 제과점' }), '사당 제과점');
  assertEqual(cleanPlaceName({ name: '  카페   모퉁이  ' }), '카페 모퉁이');
  assertEqual(cleanPlaceName({ name: '오뎅식당 본관 (허기숙 원조부대찌개)' }), '오뎅식당 본관');
  assertEqual(cleanPlaceName({ name: '1234' }), '');
  assertEqual(cleanPlaceName({}), '');
});

test('isNonFoodName: 편의점·약국·주차장 같은 시설을 거른다', () => {
  assert(isNonFoodName('사당 편의점'), '편의점이 걸러지지 않았다');
  assert(!isNonFoodName('사당 손칼국수'));
  assert(!isNonFoodName('카페 모퉁이'));
});

test('classifyPlace: 업종 태그 → 종류·카테고리', () => {
  assertEqual(classifyPlace({ amenity: 'restaurant', cuisine: 'korean' }).kind, 'restaurant');
  assertEqual(classifyPlace({ amenity: 'restaurant', cuisine: 'korean' }).category, '한식');
  assertEqual(classifyPlace({ amenity: 'restaurant', cuisine: 'barbecue' }).category, '고기');
  assertEqual(classifyPlace({ amenity: 'cafe', cuisine: 'coffee_shop' }).category, '카페');
  assertEqual(classifyPlace({ amenity: 'cafe' }).kind, 'cafe');
  assertEqual(classifyPlace({ amenity: 'bakery' }).category, '베이커리');
  assertEqual(classifyPlace({ shop: 'coffee' }).kind, 'cafe');
  assertEqual(classifyPlace({ amenity: 'ice_cream' }).category, '디저트');
  assertEqual(classifyPlace({ amenity: 'fast_food' }).category, '패스트푸드');
  assertEqual(classifyPlace({ amenity: 'restaurant' }).category, '음식점');
});

test('refineCategory: cuisine 이 없으면 상호명으로 보정', () => {
  assertEqual(refineCategory('사당 초밥', 'restaurant', '음식점'), '일식');
  assertEqual(refineCategory('사당 김밥천국', 'restaurant', '음식점'), '분식');
  assertEqual(refineCategory('사당 베이커리', 'cafe', '카페'), '베이커리');
  assertEqual(refineCategory('사당 케이크하우스', 'cafe', '카페'), '디저트');
  assertEqual(refineCategory('사당 손칼국수', 'restaurant', '음식점'), '한식');
  assertEqual(refineCategory('사당 스시', 'restaurant', '일식'), '일식');
});

/* ------------------------------------------------------------------
   3. 응답 파싱
   ------------------------------------------------------------------ */
test('parseLiveElements: 반경 안·이름 있는 식당·카페만, 거리·도보·태그 계산', () => {
  const places = parseLiveElements(overpassFixture().elements, SADANG, { radiusKm: 1 });
  const names = places.map(place => place.name);
  assert(names.includes('사당 손칼국수'), '식당이 빠졌다');
  assert(names.includes('카페 모퉁이'), '카페가 빠졌다');
  assert(names.includes('사당 제과점'), 'way(제과점)이 빠졌다');
  assert(!names.includes('멀리 있는 식당'), '반경 밖 장소가 들어왔다');
  assert(!names.includes('사당 편의점'), '음식점이 아닌 시설이 들어왔다');
  assertEqual(names.filter(name => name === '사당 국밥').length, 1, '중복이 남았다');

  const kalguksu = places.find(place => place.name === '사당 손칼국수');
  assertEqual(kalguksu.kind, 'restaurant');
  assertEqual(kalguksu.category, '한식');
  assert(kalguksu.fromSpotMeters === undefined, '파서는 거리를 굳히지 않는다(거리순 정렬용 distanceMeters 만)');
  assert(kalguksu.distanceMeters > 0 && kalguksu.distanceMeters < 100, `거리 계산 오류: ${kalguksu.distanceMeters}`);
  assert(kalguksu.walkMinutes >= 1 && kalguksu.walkMinutes <= 3, `도보 시간 오류: ${kalguksu.walkMinutes}`);

  const cafe = places.find(place => place.name === '카페 모퉁이');
  assertEqual(cafe.kind, 'cafe');
  assert(cafe.tags.includes('야외석'), '야외석 태그가 없다');
  assert(cafe.tags.includes('영업시간'), '영업시간 태그가 없다');

  const bakery = places.find(place => place.name === '사당 제과점');
  assertEqual(bakery.kind, 'cafe');
  assertEqual(bakery.category, '베이커리');

  const burger = places.find(place => place.name === '사당 버거');
  // 패스트푸드 + 이름 '버거' → 이름 보정 규칙으로 양식이 된다 (스냅샷 생성기와 같은 규칙)
  assertEqual(burger.category, '양식');

  assert(places.every(place => place.source === 'live'), '실시간 출처 표기가 없다');
  assert(places.every(place => place.lat && place.lng), '좌표가 없다');
});

test('parseLiveElements: 주차장 150m 안이면 주차 태그', () => {
  const places = parseLiveElements(overpassFixture().elements, SADANG, { radiusKm: 1 });
  const parkNear = places.filter(place => place.tags.includes('주차')).map(place => place.name);
  assert(parkNear.length > 0, '주차 가능 표시가 하나도 없다');
  assert(parkNear.includes('카페 모퉁이') || parkNear.includes('사당 손칼국수'), `주차 판정 대상이 이상하다: ${parkNear}`);
});

test('parseLiveElements: 체인 상호는 체인 태그', () => {
  const places = parseLiveElements([
    { type: 'node', id: 20, lat: 37.4767, lon: 126.9817, tags: { amenity: 'cafe', name: '스타벅스 사당점' } },
  ], SADANG, { radiusKm: 1 });
  assertEqual(places.length, 1);
  assert(places[0].tags.includes('체인'), '체인 태그가 없다');
});

test('parseLiveElements: OSM 지도 API(way nodes) 응답도 중심 좌표를 계산한다', () => {
  const payload = {
    elements: [
      { type: 'node', id: 101, lat: 37.4760, lon: 126.9810 },
      { type: 'node', id: 102, lat: 37.4760, lon: 126.9820 },
      { type: 'way', id: 201, nodes: [101, 102], tags: { amenity: 'restaurant', name: '구이 마을', cuisine: 'korean_barbecue' } },
      { type: 'way', id: 202, nodes: [101], tags: { building: 'yes' } },
    ],
  };
  const places = parseLivePayload(payload, SADANG, { radiusKm: 1 });
  assertEqual(places.length, 1, `way 중심 계산 실패: ${places.map(p => p.name)}`);
  assertEqual(places[0].name, '구이 마을');
  assertEqual(places[0].category, '고기');
  assertClose(places[0].lng, 126.9815, 0.0005);
});

test('parseLiveElements: 빈 응답·잘못된 입력에 예외 없이 빈 배열', () => {
  assertEqual(parseLiveElements([], SADANG).length, 0);
  assertEqual(parseLivePayload(null, SADANG).length, 0);
  assertEqual(parseLiveElements(overpassFixture().elements, null).length, 0);
});

test('parseLiveElements: 식당 36 · 카페 28 상한', () => {
  const elements = [];
  for (let i = 0; i < 60; i += 1) {
    elements.push({
      type: 'node', id: 1000 + i, lat: 37.4766 + i * 0.00005, lon: 126.9816,
      tags: { amenity: 'restaurant', name: `식당 ${i}` },
    });
    elements.push({
      type: 'node', id: 2000 + i, lat: 37.4766 - i * 0.00005, lon: 126.9816,
      tags: { amenity: 'cafe', name: `카페 ${i}` },
    });
  }
  const places = parseLiveElements(elements, SADANG, { radiusKm: 1 });
  assertEqual(places.filter(place => place.kind === 'restaurant').length, 36);
  assertEqual(places.filter(place => place.kind === 'cafe').length, 28);
});

/* ------------------------------------------------------------------
   4. 내장 POI + 실시간 POI 합치기
   ------------------------------------------------------------------ */
test('mergePlaceSources: 내장 POI 가 중복을 이기고, 실시간 POI 가 더해진다', () => {
  const base = PLACES.find(place => place.hubId === 'gangnam');
  assert(base, '강남 내장 POI 가 없다');
  const live = [
    // 30m 옆에 같은 이름으로 찍힌 실시간 POI → 내장 POI 가 남는다
    { id: 'live-dup', name: base.name, kind: base.kind, category: base.category, lat: base.lat + 0.0003, lng: base.lng, tags: [] },
    { id: 'live-new', name: '실시간 새로 찾은 집', kind: 'restaurant', category: '한식', lat: GANGNAM.lat + 0.0004, lng: GANGNAM.lng + 0.0004, tags: [] },
  ];
  const merged = mergePlaceSources(GANGNAM, PLACES, live, { radiusKm: 1 });
  assert(merged.baseCount > 10, `강남 내장 POI 가 부족하다: ${merged.baseCount}`);
  assertEqual(merged.liveCount, 1, `실시간 POI 합치기 오류: ${merged.liveCount}`);
  assertEqual(merged.places.length, merged.baseCount + merged.liveCount);
  assertEqual(merged.hub.id, merged.places[0].hubId);
  assertEqual(merged.hub.name, '강남역');
  assert(merged.places.every(place => place.hubName === '강남역'), '허브 이름 매핑이 없다');
  assert(merged.places.some(place => place.source === 'snapshot'), '내장 출처 표기가 없다');
  assertEqual(merged.places.filter(place => place.name === base.name).length, 1, '중복이 남았다');
  assert(merged.places.some(place => place.source === 'live' && place.name === '실시간 새로 찾은 집'));
});

test('mergePlaceSources: 이름이 비슷한 같은 집은 한 번만 (내장 우선)', () => {
  const base = [{ id: 'b1', name: '사당 손칼국수', kind: 'restaurant', category: '한식', lat: 37.4768, lng: 126.9819, tags: ['주차'] }];
  const live = [{ id: 'l1', name: '사당손칼국수', kind: 'restaurant', category: '한식', lat: 37.47681, lng: 126.98191, tags: [] }];
  const merged = mergePlaceSources(SADANG, base, live, { radiusKm: 1 });
  assertEqual(merged.places.length, 1);
  assertEqual(merged.places[0].source, 'snapshot');
  assertEqual(merged.liveCount, 0);
});

test('mergePlaceSources: 반경 밖 POI 는 넣지 않는다', () => {
  const far = [{ id: 'x', name: '먼 집', kind: 'restaurant', lat: 37.4966, lng: 126.9816, tags: [] }]; // 2.2km
  const merged = mergePlaceSources(SADANG, [], far, { radiusKm: 1 });
  assertEqual(merged.places.length, 0);
  const wide = mergePlaceSources(SADANG, [], far, { radiusKm: 3 });
  assertEqual(wide.places.length, 1);
});

test('recommendMeetingCourse: 실시간 POI 만으로 1차+2차 코스를 만든다', () => {
  // 거점에서 100m 안 식당, 식당에서 도보 3분 거리 카페
  const live = [
    { id: 'r1', name: '사당 손칼국수', kind: 'restaurant', category: '한식', lat: 37.4770, lng: 126.9816, tags: [] },
    { id: 'c1', name: '카페 모퉁이', kind: 'cafe', category: '카페', lat: 37.4770, lng: 126.9840, tags: ['야외석'] },
    { id: 'c2', name: '사당 로스터리', kind: 'cafe', category: '카페', lat: 37.4773, lng: 126.9840, tags: [] },
  ];
  const merged = mergePlaceSources(SADANG, [], live, { radiusKm: 1 });
  const course = recommendMeetingCourse(SADANG, merged.places, { hubs: [merged.hub], radiusKm: 1 });
  assert(course.courses.length > 0, '실시간 POI 로 코스가 만들어지지 않았다');
  const first = course.courses[0];
  assertEqual(first.restaurant.name, '사당 손칼국수');
  assert(first.cafe.kind === 'cafe', '2차가 카페가 아니다');
  assert(first.walkMinutes >= 1, '도보 시간이 없다');
  assertEqual(course.nearby.counts.restaurant, 1);
  assertEqual(course.nearby.counts.cafe, 2);
});

test('rankPlacesAround: 반경·주차 우선 정렬이 실시간 POI 에도 적용된다', () => {
  const places = [
    { name: '가까운 집', kind: 'restaurant', lat: 37.4770, lng: 126.9816, tags: [] },
    { name: '주차 되는 집', kind: 'restaurant', lat: 37.4780, lng: 126.9816, tags: ['주차'] },
    { name: '먼 집', kind: 'restaurant', lat: 37.4900, lng: 126.9816, tags: [] },
  ];
  const transit = rankPlacesAround(SADANG, places, { radiusKm: 1 });
  assertEqual(transit.counts.restaurant, 2, '반경 밖이 섞였다');
  assertEqual(transit.places[0].name, '가까운 집');
  const car = rankPlacesAround(SADANG, places, { radiusKm: 1, travelMode: 'car' });
  assertEqual(car.places[0].name, '주차 되는 집', '자차 모드에서 주차 장소가 앞서지 않았다');
});

test('needsLiveSearch: 내장 POI 가 모자랄 때만 실시간 조회', () => {
  assert(needsLiveSearch({ restaurant: 0, cafe: 0 }), '빈 거점은 조회해야 한다');
  assert(needsLiveSearch({ restaurant: 10, cafe: 0 }), '카페가 없으면 조회해야 한다');
  assert(!needsLiveSearch({ restaurant: 10, cafe: 5 }), '충분한 거점은 조회하지 않는다');
  assert(needsLiveSearch(null), '없는 값은 조회 대상');
});

/* ------------------------------------------------------------------
   5. 네트워크 — 미러 fallback · 캐시
   ------------------------------------------------------------------ */
const jsonResponse = payload => ({ ok: true, status: 200, json: async () => payload });

function planOf(urls, kind = 'overpass') {
  return urls.map((url, i) => ({ id: `test-${i}`, kind, url, delayMs: 0, query: 'q' }));
}

test('loadLivePlaces: 첫 요청이 실패하면 다음 미러로 넘어간다', async () => {
  clearLiveCache();
  const calls = [];
  const fetchImpl = async url => {
    calls.push(url);
    if (calls.length === 1) throw new Error('HTTP 502');
    return jsonResponse(overpassFixture());
  };
  const result = await loadLivePlaces({
    lat: SADANG.lat, lng: SADANG.lng, radiusKm: 1,
    fetchImpl, plan: planOf(['https://a.example/1', 'https://b.example/2']),
  });
  assertEqual(calls.length, 2, '미러 fallback 이 동작하지 않았다');
  assert(result.places.length > 0, '결과가 비었다');
  assertEqual(result.source, 'overpass');
  assertEqual(result.attempts.filter(item => item.ok).length, 1);
});

test('loadLivePlaces: 성공한 결과는 세션 캐시에 담겨 재요청하지 않는다', async () => {
  clearLiveCache();
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse(overpassFixture());
  };
  const first = await loadLivePlaces({ lat: SADANG.lat, lng: SADANG.lng, radiusKm: 1, fetchImpl, plan: planOf(['https://a.example/1']) });
  const second = await loadLivePlaces({ lat: SADANG.lat, lng: SADANG.lng, radiusKm: 1, fetchImpl, plan: planOf(['https://a.example/1']) });
  assertEqual(calls, 1, '캐시를 쓰지 않고 다시 요청했다');
  assertEqual(second.cached, true);
  assertEqual(first.places.length, second.places.length);
  assert(getCachedLive(SADANG.lat, SADANG.lng, 1), '캐시 조회가 안 된다');
  assertEqual(liveCacheKey(SADANG.lat, SADANG.lng, 1), '37.477,126.982@1.0');
});

test('loadLivePlaces: 300m 안의 다른 좌표면 캐시를 재사용한다', async () => {
  clearLiveCache();
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse(overpassFixture());
  };
  await loadLivePlaces({ lat: SADANG.lat, lng: SADANG.lng, radiusKm: 1, fetchImpl, plan: planOf(['https://a.example/1']) });
  const near = await loadLivePlaces({ lat: SADANG.lat + 0.001, lng: SADANG.lng, radiusKm: 1, fetchImpl, plan: planOf(['https://a.example/1']) });
  assertEqual(calls, 1, '가까운 좌표에서 캐시를 쓰지 않았다');
  assertEqual(near.cached, true);
});

test('loadLivePlaces: 모든 조회가 실패하면 LivePlacesError(시도 기록 포함)', async () => {
  clearLiveCache();
  const fetchImpl = async () => { throw new Error('network down'); };
  let error = null;
  try {
    await loadLivePlaces({
      lat: SADANG.lat, lng: SADANG.lng, radiusKm: 1,
      fetchImpl, timeoutMs: 200,
      plan: planOf(['https://a.example/1', 'https://b.example/2']),
    });
  } catch (err) {
    error = err;
  }
  assert(error, '실패했는데 예외가 없다');
  assertEqual(error.name, 'LivePlacesError');
  assertEqual(error.attempts.length, 2);
  assert(error.attempts.every(item => item.error), '시도별 오류가 기록되지 않았다');
});

test('loadLivePlaces: 응답이 늦으면 timeout 으로 끊고 다음 시도로 넘어간다', async () => {
  clearLiveCache();
  const fetchImpl = (url, init) => new Promise((resolve, reject) => {
    if (url.includes('slow')) {
      init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      return;
    }
    resolve(jsonResponse(overpassFixture()));
  });
  const result = await loadLivePlaces({
    lat: SADANG.lat, lng: SADANG.lng, radiusKm: 1,
    fetchImpl, timeoutMs: 150,
    plan: [
      { id: 'test-0', kind: 'overpass', url: 'https://slow.example/1', delayMs: 0, query: 'q' },
      { id: 'test-1', kind: 'overpass', url: 'https://fast.example/2', delayMs: 300, query: 'q' },
    ],
  });
  assert(result.places.length > 0, '빠른 미러 결과를 받지 못했다');
  const slow = result.attempts.find(item => item.id === 'test-0');
  assert(slow && !slow.ok, '느린 요청이 성공으로 기록됐다');
});

test('loadLivePlaces: Overpass 가 0건이면 OSM 지도 API 결과를 기다린다', async () => {
  clearLiveCache();
  const fetchImpl = async url => {
    if (url.endsWith('/1')) return jsonResponse({ elements: [] });
    return jsonResponse(overpassFixture());
  };
  const plan = [
    { id: 'overpass', kind: 'overpass', url: 'https://overpass.example/1', delayMs: 0, query: 'q' },
    { id: 'osm', kind: 'osm-map', url: 'https://overpass-api.example/map.json', delayMs: 5 },
  ];
  const result = await loadLivePlaces({ lat: SADANG.lat, lng: SADANG.lng, radiusKm: 1, fetchImpl, plan });
  assert(result.places.length > 0, 'OSM 지도 API 결과를 쓰지 않았다');
  assertEqual(result.source, 'osm-map');
});

test('loadLivePlaces: bbox 전체를 받는 OSM 지도 API 0건은 "정말 없음"으로 확정', async () => {
  clearLiveCache();
  const fetchImpl = async () => jsonResponse({ elements: [] });
  const plan = [
    { id: 'overpass', kind: 'overpass', url: 'https://overpass.example/1', delayMs: 0, query: 'q' },
    { id: 'osm', kind: 'osm-map', url: 'https://osm.example/map.json', delayMs: 100 },
  ];
  const started = Date.now();
  const result = await loadLivePlaces({ lat: SADANG.lat, lng: SADANG.lng, radiusKm: 1, fetchImpl, plan, timeoutMs: 5000 });
  assertEqual(result.places.length, 0);
  assert(Date.now() - started < 4000, '빈 결과인데 오래 기다렸다');
});

test('loadLivePlaces: 좌표가 없으면 즉시 실패', async () => {
  let error = null;
  try {
    await loadLivePlaces({ lat: 'x', lng: null, fetchImpl: async () => jsonResponse({}) });
  } catch (err) {
    error = err;
  }
  assert(error && error.name === 'LivePlacesError');
});
