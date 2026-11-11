/* ==================================================================
   HD2Lab | Midpoint (PKPilot0002)
   live_places.js — 전국 임의 좌표 반경 실시간 맛집·카페 조회

   내장 스냅샷(places.js)은 30개 모임 거점만 덮는다. 그 밖의 중간 지점에서도
   앱 밖으로 나가지 않고 바로 찾도록, 브라우저에서 OpenStreetMap 데이터를
   직접 조회한다.

   조회 순서 (timeout 대비 fallback)
   1) Overpass API   — overpass-api.de → lz4 미러 → kumi → private.coffee
      `amenity=restaurant|cafe|fast_food|bakery|ice_cream`, `shop=bakery|coffee|dessert|ice_cream`
   2) OSM 지도 API   — https://api.openstreetmap.org/api/0.6/map.json (bbox)
      Overpass 대기열이 밀릴 때를 위한 다른 인프라의 경량 후퇴로.
   각 요청은 시간차를 두고 동시에 출발하고, **먼저 답한 쪽**을 쓴다.
   같은 좌표·반경의 결과는 세션 메모리 캐시(Map)에 담아 재요청하지 않는다.

   파싱·분류·정제는 순수 함수라 브라우저 없이 단위 테스트한다.
   ================================================================== */

import { haversineKm, walkMinutesForMeters } from './core.js';

export const LIVE_RADIUS_KM = 1;
/** 앱에서 넓혀 찾을 수 있는 최대 반경 (km) */
export const MAX_LIVE_RADIUS_KM = 3;
/** 반경 안 장소가 이보다 적으면 실시간 조회로 보강한다. */
export const LIVE_TRIGGER_MIN = { restaurant: 3, cafe: 2 };

const OVERPASS_TIMEOUT_S = 12;
const OSM_MAP_ENDPOINT = 'https://api.openstreetmap.org/api/0.6/map.json';

const AMENITY_PATTERN = '^(restaurant|cafe|fast_food|bakery|ice_cream)$';
const SHOP_PATTERN = '^(bakery|coffee|dessert|ice_cream)$';
const PARKING_SEARCH_M = 150;
const MAX_RESTAURANTS = 36;
const MAX_CAFES = 28;

/** Overpass 미러 — 앞에서부터 시간차를 두고 동시에 시도한다. */
export const OVERPASS_ENDPOINTS = [
  { id: 'overpass-api.de', url: 'https://overpass-api.de/api/interpreter', delayMs: 0 },
  { id: 'overpass-lz4', url: 'https://lz4.overpass-api.de/api/interpreter', delayMs: 1200 },
  { id: 'overpass-kumi', url: 'https://overpass.kumi.systems/api/interpreter', delayMs: 2500 },
  { id: 'overpass-private.coffee', url: 'https://overpass.private.coffee/api/interpreter', delayMs: 5200 },
];
/** Overpass 가 모두 밀릴 때의 후퇴로 — 다른 인프라(OSM Rails API). */
export const OSM_MAP_ATTEMPT = { id: 'osm-map-api', url: OSM_MAP_ENDPOINT, delayMs: 3600, kind: 'osm-map' };

/* ------------------------------------------------------------------
   분류 규칙 — tools/build_places.py(스냅샷 생성기)와 같은 기준
   ------------------------------------------------------------------ */

const CUISINE_CATEGORY = {
  korean: '한식', soup: '한식', stew: '한식', rice: '한식', noodle: '한식',
  noodles: '한식', gukbap: '한식', bibimbap: '한식',
  barbecue: '고기', bbq: '고기', gogi: '고기', samgyeopsal: '고기',
  korean_barbecue: '고기', grill: '고기',
  japanese: '일식', sushi: '일식', ramen: '일식', udon: '일식',
  donburi: '일식', izakaya: '일식', tempura: '일식', sashimi: '일식',
  chinese: '중식', dim_sum: '중식', taiwanese: '중식',
  italian: '양식', pizza: '양식', pasta: '양식', western: '양식',
  american: '양식', french: '양식', burger: '양식', steak: '양식',
  mexican: '양식', brunch: '양식', sandwich: '양식', salad: '양식',
  vietnamese: '아시아', thai: '아시아', indian: '아시아', asian: '아시아',
  pho: '아시아', nepalese: '아시아', malaysian: '아시아',
  chicken: '치킨', fried_chicken: '치킨',
  seafood: '해산물', fish: '해산물',
  bunsik: '분식', snack: '분식', tteokbokki: '분식', korean_fried_chicken: '치킨',
  dessert: '디저트', ice_cream: '디저트', cake: '디저트', bingsu: '디저트',
  bakery: '베이커리', bread: '베이커리',
  coffee_shop: '카페', cafe: '카페', coffee: '카페', tea: '카페',
  bubble_tea: '카페', juice: '카페',
};

const CATEGORY_ORDER = ['한식', '고기', '일식', '중식', '양식', '아시아', '치킨', '분식', '해산물', '음식점'];

const CHAIN_NAMES = [
  '스타벅스', '투썸', '이디야', '메가커피', '메가엠지씨', '컴포즈커피', '빽다방', '폴바셋',
  '파리바게뜨', '뚜레쥬르', '던킨', '배스킨라빈스', '크리스피크림',
  '맥도날드', '롯데리아', '버거킹', 'KFC', '서브웨이', '쉐이크쉑', '노브랜드버거',
  '김밥천국', '본죽', '한솥', '명륜진사갈비', '홍콩반점', '역전우동', '미스터피자', '도미노피자',
];

/** cuisine 태그가 없을 때 이름으로 카테고리를 보정한다 (앞쪽 규칙이 이긴다). */
const NAME_CATEGORY = [
  ['해산물', ['횟집', '물회', '해물', '해산물', '조개', '게장', '아귀', '장어', '굴구이', '회센타', '회센터']],
  ['고기', ['삼겹', '목살', '갈비', '곱창', '막창', '족발', '보쌈', '숯불', '양꼬치', '정육', '화로', '구이', '바베큐', 'bbq', '스테이크']],
  ['치킨', ['치킨', '닭갈비', '통닭', '후라이드', '양념치킨', '찜닭']],
  ['일식', ['초밥', '스시', '사시미', '라멘', '우동', '소바', '돈까스', '돈가스', '이자카야', '규동', '가츠', '일식', '텐동']],
  ['중식', ['반점', '짬뽕', '탕수육', '마라', '훠궈', '딤섬', '중화', '중국']],
  ['양식', ['피자', '파스타', '스파게티', '버거', '샌드위치', '브런치', '리조또', '타코', '그라탕', '오므라이스']],
  ['아시아', ['쌀국수', '베트남', '태국', '팟타이', '반미', '커리', '인도', '포차']],
  ['분식', ['김밥', '떡볶이', '순대', '분식', '만두', '튀김', '라면']],
  ['한식', ['국밥', '찌개', '전골', '국수', '칼국수', '냉면', '비빔밥', '설렁탕', '곰탕', '삼계탕', '감자탕', '육개장', '백반', '한정식', '불고기', '순두부', '김치', '된장', '죽', '한식', '식당', '밥집']],
];

const DESSERT_HINTS = ['디저트', '케이크', '빙수', '도넛', '와플', '마카롱', '쿠키', '타르트', '젤라또', '아이스크림', '초콜릿', '찻집', '티하우스'];
const BAKERY_HINTS = ['베이커리', '제과', '빵', 'bakery', '베이크'];

/** 식당·카페가 아닌 시설이 restaurant/cafe 로 잘못 올라온 경우를 걸러낸다. */
const NON_FOOD_HINTS = [
  '웨딩홀', '장례', '편의점', '약국', '은행', '노래방', 'pc방', '부동산', '공인중개',
  '헬스', '요가', '미용실', '네일', '사우나', '교회', '학원', '병원', '의원',
  '지하쇼핑센터', '쇼핑센터', '푸드코트', '주차장', '호프', '주점', '술집', '맥주창고',
];
const NON_FOOD_EXACT = ['롯데백화점', '현대백화점', '신세계백화점', '이마트', '코스트코', '롯데마트', '홈플러스'];

/* ------------------------------------------------------------------
   이름 정제 — name:ko > name > brand
   ------------------------------------------------------------------ */

/** 상호명 정제: 앞뒤 공백·따옴표 제거, 공백 정리, 40자 제한, 꼬리 괄호 설명 분리 */
export function cleanPlaceName(tags = {}) {
  const raw = tags['name:ko'] || tags.name || tags['name:en'] || tags.brand || '';
  let name = String(raw)
    .replace(/[\u200b\u00a0]/g, ' ')
    .replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!name) return '';
  // "오뎅식당 본관 (허기숙 원조부대찌개)" → 꼬리 괄호가 길면 떼어 낸다.
  const paren = name.match(/^(.*?)\s*\((.{8,})\)$/);
  if (paren && paren[1].trim().length >= 2) name = paren[1].trim();
  if (/^[\d\s#*·.,-]+$/.test(name)) return '';
  return name.slice(0, 40).trim();
}

export function isNonFoodName(name) {
  const lowered = String(name || '').toLowerCase().replace(/\s/g, '');
  if (!lowered) return true;
  if (NON_FOOD_EXACT.includes(lowered)) return true;
  return NON_FOOD_HINTS.some(hint => lowered.includes(hint));
}

/** OSM 태그 → { kind: 'restaurant'|'cafe', category } */
export function classifyPlace(tags = {}) {
  const amenity = tags.amenity || '';
  const shop = tags.shop || '';
  const cuisines = String(tags.cuisine || '')
    .split(/[;,]/)
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  const categories = cuisines.map(name => CUISINE_CATEGORY[name]).filter(Boolean);
  const dessertish = categories.some(name => name === '디저트' || name === '베이커리');

  if (amenity === 'cafe' || (['coffee', 'dessert', 'ice_cream'].includes(shop) && amenity !== 'restaurant')) {
    if (categories.includes('베이커리')) return { kind: 'cafe', category: '베이커리' };
    if (dessertish) return { kind: 'cafe', category: '디저트' };
    return { kind: 'cafe', category: '카페' };
  }
  if (amenity === 'bakery' || shop === 'bakery') return { kind: 'cafe', category: '베이커리' };
  if (amenity === 'ice_cream' || shop === 'ice_cream') return { kind: 'cafe', category: '디저트' };
  if (amenity === 'restaurant' || amenity === 'fast_food') {
    const hit = CATEGORY_ORDER.find(name => categories.includes(name));
    if (hit) return { kind: 'restaurant', category: hit };
    if (dessertish) return { kind: 'restaurant', category: '디저트' };
    return { kind: 'restaurant', category: amenity === 'fast_food' ? '패스트푸드' : '음식점' };
  }
  // restaurant·cafe 가 아닌 shop 계열(제과점 등)은 카페로 본다.
  if (shop === 'bakery') return { kind: 'cafe', category: '베이커리' };
  return { kind: 'cafe', category: '카페' };
}

/** cuisine 태그 없이 '음식점'/'카페'로 남은 곳을 이름으로 보정한다. */
export function refineCategory(name, kind, category) {
  const lowered = String(name || '').toLowerCase();
  if (kind === 'cafe') {
    if (category === '카페' || category === '디저트' || category === '베이커리') {
      if (BAKERY_HINTS.some(hint => lowered.includes(hint))) return '베이커리';
      if (DESSERT_HINTS.some(hint => lowered.includes(hint))) return '디저트';
    }
    return category;
  }
  if (category !== '음식점' && category !== '패스트푸드') return category;
  if (DESSERT_HINTS.some(hint => lowered.includes(hint))) return '디저트';
  if (BAKERY_HINTS.some(hint => lowered.includes(hint))) return '베이커리';
  for (const [wanted, hints] of NAME_CATEGORY) {
    if (hints.some(hint => lowered.includes(hint))) return wanted;
  }
  return category;
}

export function isChainName(name) {
  const lowered = String(name || '').toLowerCase();
  return CHAIN_NAMES.some(chain => lowered.includes(chain.toLowerCase()));
}

/** 장소 특징 태그 — 스냅샷(places.js)과 같은 표기를 쓴다. */
export function placeTagsOf(tags = {}, category, parkingNear = false) {
  const out = [];
  if (isChainName(tags.name || tags['name:ko'] || '')) out.push('체인');
  if (tags.outdoor_seating === 'yes') out.push('야외석');
  if (tags.takeaway === 'yes' || tags.takeaway === 'only') out.push('포장');
  if (parkingNear || ['yes', 'lane', 'garage'].includes(tags.parking)) out.push('주차');
  if (tags.wheelchair === 'yes') out.push('무장애');
  if (category === '디저트') out.push('디저트');
  if (category === '베이커리') out.push('베이커리');
  if (tags.opening_hours) out.push('영업시간');
  return [...new Set(out)];
}

/* ------------------------------------------------------------------
   요청 만들기
   ------------------------------------------------------------------ */

/** Overpass QL — 반경 radiusKm 안의 이름 있는 식당·카페 + 주차장 */
export function buildOverpassQuery(lat, lng, radiusKm = LIVE_RADIUS_KM) {
  const radius = Math.max(100, Math.round(radiusKm * 1000));
  const center = `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
  return [
    `[out:json][timeout:${OVERPASS_TIMEOUT_S}];`,
    '(',
    `  node["amenity"~"${AMENITY_PATTERN}"]["name"](around:${radius},${center});`,
    `  way["amenity"~"${AMENITY_PATTERN}"]["name"](around:${radius},${center});`,
    `  node["shop"~"${SHOP_PATTERN}"]["name"](around:${radius},${center});`,
    `  way["shop"~"${SHOP_PATTERN}"]["name"](around:${radius},${center});`,
    `  node["amenity"="parking"](around:${radius + PARKING_SEARCH_M},${center});`,
    `  way["amenity"="parking"](around:${radius + PARKING_SEARCH_M},${center});`,
    ');',
    'out center 400;',
  ].join('\n');
}

/** 반경 → OSM 지도 API bbox (남,서,북,동) */
export function bboxFor(lat, lng, radiusKm = LIVE_RADIUS_KM) {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
  return {
    south: Number((lat - dLat).toFixed(6)),
    west: Number((lng - dLng).toFixed(6)),
    north: Number((lat + dLat).toFixed(6)),
    east: Number((lng + dLng).toFixed(6)),
  };
}

export function buildOsmMapUrl(lat, lng, radiusKm = LIVE_RADIUS_KM, endpoint = OSM_MAP_ENDPOINT) {
  const box = bboxFor(lat, lng, radiusKm);
  return `${endpoint}?bbox=${box.west},${box.south},${box.east},${box.north}`;
}

/* ------------------------------------------------------------------
   응답 파싱
   ------------------------------------------------------------------ */

function elementCoords(element, nodeIndex) {
  if (element && Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
    return { lat: element.lat, lng: element.lon };
  }
  const center = element && element.center;
  if (center && Number.isFinite(center.lat) && Number.isFinite(center.lon)) {
    return { lat: center.lat, lng: center.lon };
  }
  if (element && Array.isArray(element.nodes) && element.nodes.length && nodeIndex) {
    let sumLat = 0;
    let sumLng = 0;
    let count = 0;
    for (const id of element.nodes) {
      const point = nodeIndex.get(id);
      if (!point) continue;
      sumLat += point.lat;
      sumLng += point.lng;
      count += 1;
    }
    if (count) return { lat: sumLat / count, lng: sumLng / count };
  }
  return null;
}

const normName = name => String(name || '').toLowerCase().replace(/[\s()·.,'"-]+/g, '');

/**
 * OSM 요소 목록(Overpass `out center`, OSM 지도 API 모두) → 앱 POI 배열.
 * origin 은 기준 거점(중간 지점이 아니라 추천 거점)이다.
 */
export function parseLiveElements(elements, origin, options = {}) {
  const list = Array.isArray(elements) ? elements : [];
  const radiusMeters = (options.radiusKm ?? LIVE_RADIUS_KM) * 1000;
  if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) return [];

  const nodeIndex = new Map();
  for (const element of list) {
    if (element && element.type === 'node' && Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
      nodeIndex.set(element.id, { lat: element.lat, lng: element.lon });
    }
  }

  const parking = [];
  const candidates = [];
  for (const element of list) {
    if (!element) continue;
    const tags = element.tags || {};
    const coords = elementCoords(element, nodeIndex);
    if (!coords) continue;
    if (tags.amenity === 'parking') {
      parking.push(coords);
      continue;
    }
    const name = cleanPlaceName(tags);
    if (!name || isNonFoodName(name)) continue;
    candidates.push({ element, tags, coords, name });
  }

  const places = [];
  for (const { element, tags, coords, name } of candidates) {
    const distance = haversineKm(origin, coords) * 1000;
    if (!Number.isFinite(distance) || distance > radiusMeters) continue;
    const base = classifyPlace(tags);
    const category = refineCategory(name, base.kind, base.category);
    const parkingNear = parking.some(point => haversineKm(coords, point) * 1000 <= PARKING_SEARCH_M);
    const hasCuisine = Boolean(tags.cuisine);
    places.push({
      id: `live-${element.type}-${element.id}`,
      name,
      kind: base.kind,
      category,
      lat: Number(coords.lat.toFixed(6)),
      lng: Number(coords.lng.toFixed(6)),
      distanceMeters: Math.round(distance),
      walkMinutes: walkMinutesForMeters(distance),
      tags: placeTagsOf(tags, category, parkingNear),
      hours: tags.opening_hours || '',
      source: 'live',
      osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      _meta: (hasCuisine ? 0 : 25) + (tags.opening_hours ? 0 : 10),
      _tagCount: Object.keys(tags).length,
    });
  }

  // 같은 곳(이름 포함 관계 + 60m 이내)은 태그가 많은 쪽만 남긴다.
  const ordered = [...places].sort((a, b) => b._tagCount - a._tagCount || a.distanceMeters - b.distanceMeters);
  const kept = [];
  for (const place of ordered) {
    const twin = kept.some(other =>
      haversineKm(other, place) * 1000 < 60
      && (normName(other.name) === normName(place.name)
        || (Math.min(normName(other.name).length, normName(place.name).length) >= 3
          && (normName(place.name).includes(normName(other.name)) || normName(other.name).includes(normName(place.name))))));
    if (!twin) kept.push(place);
  }

  // 가까운 순. 이름만 있는 항목은 살짝 뒤로.
  const rank = place => place.distanceMeters + place._meta;
  const restaurants = kept.filter(place => place.kind === 'restaurant').sort((a, b) => rank(a) - rank(b));
  const cafes = kept.filter(place => place.kind === 'cafe').sort((a, b) => rank(a) - rank(b));
  return [...restaurants.slice(0, MAX_RESTAURANTS), ...cafes.slice(0, MAX_CAFES)].map(place => {
    const { _meta, _tagCount, ...publicPlace } = place;
    return publicPlace;
  });
}

/** Overpass / OSM 지도 API 응답(JSON) → POI 배열 */
export function parseLivePayload(payload, origin, options = {}) {
  const elements = payload && Array.isArray(payload.elements) ? payload.elements : [];
  return parseLiveElements(elements, origin, options);
}

/* ------------------------------------------------------------------
   세션 캐시
   ------------------------------------------------------------------ */

const sessionCache = new Map();
const CACHE_REUSE_M = 300;

export function liveCacheKey(lat, lng, radiusKm = LIVE_RADIUS_KM) {
  return `${Number(lat).toFixed(3)},${Number(lng).toFixed(3)}@${Number(radiusKm).toFixed(1)}`;
}

/** 같은 세션에서 이미 받아 둔 결과 — 300m 안의 다른 좌표면 재사용한다. */
export function getCachedLive(lat, lng, radiusKm = LIVE_RADIUS_KM) {
  const exact = sessionCache.get(liveCacheKey(lat, lng, radiusKm));
  if (exact) return exact;
  const origin = { lat, lng };
  for (const entry of sessionCache.values()) {
    if (entry.radiusKm !== radiusKm) continue;
    if (haversineKm(origin, entry.origin) * 1000 <= CACHE_REUSE_M) return entry;
  }
  return null;
}

export function rememberLive(lat, lng, radiusKm, result) {
  const entry = {
    origin: { lat, lng },
    radiusKm,
    places: result.places || [],
    source: result.source || 'live',
    endpoint: result.endpoint || '',
    at: Date.now(),
  };
  sessionCache.set(liveCacheKey(lat, lng, radiusKm), entry);
  return entry;
}

export function clearLiveCache() {
  sessionCache.clear();
}

export function liveCacheSize() {
  return sessionCache.size;
}

/* ------------------------------------------------------------------
   조회 — 시간차 동시 시도(fallback chain)
   ------------------------------------------------------------------ */

export class LivePlacesError extends Error {
  constructor(message, attempts = []) {
    super(message);
    this.name = 'LivePlacesError';
    this.attempts = attempts;
  }
}

/** 시도 계획 — 앞 요청이 늦으면 다음 미러·OSM 지도 API 를 시간차로 함께 출발시킨다. */
export function liveAttemptPlan(lat, lng, radiusKm = LIVE_RADIUS_KM) {
  const overpass = OVERPASS_ENDPOINTS.map(item => ({
    id: item.id,
    kind: 'overpass',
    url: item.url,
    delayMs: item.delayMs,
    query: buildOverpassQuery(lat, lng, radiusKm),
  }));
  return [
    ...overpass.slice(0, 2),
    {
      id: OSM_MAP_ATTEMPT.id,
      kind: 'osm-map',
      url: buildOsmMapUrl(lat, lng, radiusKm),
      delayMs: OSM_MAP_ATTEMPT.delayMs,
    },
    ...overpass.slice(2),
  ];
}

function defaultFetch() {
  if (typeof fetch !== 'function') throw new Error('fetch를 쓸 수 없어요');
  return fetch;
}

/**
 * 반경 radiusKm 안의 실시간 맛집·카페를 가져온다.
 * 반환: { places, source, endpoint, cached, tookMs, attempts }
 */
export async function loadLivePlaces(options = {}) {
  const lat = Number(options.lat);
  const lng = Number(options.lng);
  const radiusKm = Number(options.radiusKm ?? LIVE_RADIUS_KM);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new LivePlacesError('invalid_origin');
  }
  const origin = { lat, lng };
  if (!options.force) {
    const cached = getCachedLive(lat, lng, radiusKm);
    if (cached) {
      return {
        places: cached.places,
        source: cached.source,
        endpoint: cached.endpoint,
        cached: true,
        tookMs: 0,
        attempts: [],
      };
    }
  }

  const fetchImpl = options.fetchImpl || defaultFetch();
  const timeoutMs = options.timeoutMs ?? 11000;
  const plan = options.plan || liveAttemptPlan(lat, lng, radiusKm);
  const startedAt = Date.now();
  const attempts = [];

  return new Promise((resolve, reject) => {
    let settled = false;
    let pending = plan.length;
    let emptyResult = null;
    const controllers = new Set();
    const timers = new Set();

    const cleanup = () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    };

    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      for (const controller of controllers) {
        try {
          controller.abort();
        } catch {
          /* 이미 끝난 요청 */
        }
      }
      if (options.cache !== false && result.places.length) {
        rememberLive(lat, lng, radiusKm, result);
      }
      resolve({ ...result, tookMs: Date.now() - startedAt, attempts });
    };

    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new LivePlacesError('live_unavailable', attempts));
    };

    const settleEmpty = () => {
      pending -= 1;
      if (settled) return;
      if (pending <= 0) {
        if (emptyResult) finish(emptyResult);
        else fail();
      }
    };

    const run = async (attempt) => {
      if (settled) return;
      const controller = new AbortController();
      controllers.add(controller);
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      timers.add(timer);
      const record = { id: attempt.id, kind: attempt.kind, ok: false, status: 0, error: '', ms: 0 };
      attempts.push(record);
      const attemptStart = Date.now();
      try {
        const request = attempt.kind === 'osm-map'
          ? {
            method: 'GET',
            signal: controller.signal,
            mode: 'cors',
            cache: 'no-store',
            headers: { Accept: 'application/json' },
          }
          : {
            method: 'POST',
            signal: controller.signal,
            mode: 'cors',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', Accept: 'application/json' },
            body: `data=${encodeURIComponent(attempt.query)}`,
          };
        const response = await fetchImpl(attempt.url, request);
        record.status = response && response.status ? response.status : 0;
        if (!response || !response.ok) throw new Error(`HTTP ${record.status}`);
        const payload = await response.json();
        const places = parseLivePayload(payload, origin, { radiusKm });
        record.ok = true;
        record.ms = Date.now() - attemptStart;
        if (places.length) {
          finish({ places, source: attempt.kind, endpoint: attempt.url, cached: false });
        } else {
          const empty = { places: [], source: attempt.kind, endpoint: attempt.url, cached: false };
          // bbox 전체를 받는 OSM 지도 API 의 0건은 "정말 없다"로 본다.
          if (attempt.kind === 'osm-map') finish(empty);
          else {
            if (!emptyResult) emptyResult = empty;
            settleEmpty();
          }
        }
      } catch (error) {
        record.error = String((error && error.name === 'AbortError') ? 'timeout' : (error && error.message) || error);
        record.ms = Date.now() - attemptStart;
        settleEmpty();
      } finally {
        clearTimeout(timer);
        timers.delete(timer);
        controllers.delete(controller);
      }
    };

    for (const attempt of plan) {
      const timer = setTimeout(() => {
        timers.delete(timer);
        run(attempt);
      }, attempt.delayMs || 0);
      timers.add(timer);
    }
  });
}

/** 실시간 조회가 필요한가 — 내장 POI 가 모자랄 때만 네트워크를 쓴다. */
export function needsLiveSearch(counts, min = LIVE_TRIGGER_MIN) {
  const restaurants = counts && Number.isFinite(counts.restaurant) ? counts.restaurant : 0;
  const cafes = counts && Number.isFinite(counts.cafe) ? counts.cafe : 0;
  return restaurants < min.restaurant || cafes < min.cafe;
}
