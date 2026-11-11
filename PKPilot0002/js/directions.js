/* ==================================================================
   HD2Lab | Midpoint (PKPilot0002)
   directions.js — 실제 길찾기·내비게이션 딥링크 (카카오맵/네이버지도/티맵)
   ================================================================== */

const num = v => Number(v).toFixed(6).replace(/\.?0+$/, '');

/** 네이버지도 길찾기가 쓰는 웹 메르카토르 좌표 (EPSG:3857) */
export function webMercatorX(lng) {
  const R = 6378137.0;
  return R * (Number(lng) * Math.PI) / 180;
}

export function webMercatorY(lat) {
  const R = 6378137.0;
  const phi = (Number(lat) * Math.PI) / 180;
  return R * Math.log(Math.tan(Math.PI / 4 + phi / 2));
}

function naverPin(name, lat, lng) {
  return `${webMercatorX(lng)},${webMercatorY(lat)},${encodeURIComponent(name || '')},,`;
}

export const isMobileDevice = () =>
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator?.userAgent || '');

export const isAndroid = () => /Android/i.test(navigator?.userAgent || '');
export const isIOS = () => /iPhone|iPad|iPod/i.test(navigator?.userAgent || '');

/* ------------------------------------------------------------------
   길찾기 링크 — { from: 출발지 | null(현위치), to: 목적지, mode }
   ------------------------------------------------------------------ */

export function kakaoMapUrl({ from, to, travelMode = 'transit' }) {
  const api = isMobileDevice() ? (isIOS() ? 'https://map.kakao.com/link/url' : 'kakaomap://') : null;
  if (!api) {
    // 데스크톱: 웹 카카오맵 길찾기 (파라미터가 없으면 해당 지점 지도만)
    if (from) {
      return `https://map.kakao.com/?sName=${encodeURIComponent(from.name)}&eName=${encodeURIComponent(to.name)}`;
    }
    return `https://map.kakao.com/link/map/${encodeURIComponent(to.name || '')},${to.lat},${to.lng}`;
  }
  const ep = `${to.lat},${to.lng}`;
  const by = travelMode === 'car' ? 'CAR' : 'TRANSIT';
  const params = by === 'CAR'
    ? `route?sp=&ep=${ep}&by=CAR`
    : `route?sp=&ep=${ep}&by=PUBLIC`;
  return api + params;
}

export function kakaoWebRouteUrl({ from, to, travelMode = 'transit' }) {
  // 웹 카카오맵: link/to·from은 자동차 경로로 열린다. 대중교통은 이름 검색 길찾기로.
  if (from) {
    return `https://map.kakao.com/?sName=${encodeURIComponent(from.name)}&eName=${encodeURIComponent(to.name)}`;
  }
  return `https://map.kakao.com/link/to/${encodeURIComponent(to.name || '목적지')},${to.lat},${to.lng}`;
}

export function naverDirectionsUrl({ from, to, travelMode = 'transit' }) {
  const type = travelMode === 'car' ? 'car' : travelMode === 'walk' ? 'walk' : 'transit';
  const start = from ? naverPin(from.name, from.lat, from.lng) : '-';
  return `https://map.naver.com/p/directions/${start}/${naverPin(to.name, to.lat, to.lng)}/${type}`;
}

/** 카카오맵 웹 길찾기 — by=FOOT 이면 도보 경로로 열린다. */
export function kakaoWalkRouteUrl({ from, to }) {
  return `https://map.kakao.com/?sName=${encodeURIComponent(from.name || '출발')}&eName=${encodeURIComponent(to.name || '도착')}&by=FOOT`;
}

export function tmapRouteUrl({ to }) {
  // 티맵은 앱 스킴만 있다 — 모바일에서만 노출한다.
  return `tmap://route?goalname=${encodeURIComponent(to.name || '목적지')}&goalx=${to.lng}&goaly=${to.lat}`;
}

export const PROVIDERS = {
  kakao: {
    label: '카카오맵',
    carLabel: '카카오내비',
    icon: 'i-nav-kakao',
    web: kakaoWebRouteUrl,
    app: kakaoMapUrl,
    appOnly: false,
  },
  naver: {
    label: '네이버지도',
    carLabel: '네이버지도',
    icon: 'i-nav-naver',
    web: naverDirectionsUrl,
    app: naverDirectionsUrl,
    appOnly: false,
  },
  tmap: {
    label: '티맵',
    carLabel: '티맵내비',
    icon: 'i-nav-tmap',
    web: null,          // 웹 페이지가 없다 — 모바일 앱 스킴만
    app: tmapRouteUrl,
    appOnly: true,
  },
};

/** 모드에 맞는 제공자 목록 (대중교통: 카카오맵·네이버지도, 자차: 카카오내비·네이버지도·티맵) */
export function providerList(travelMode) {
  return travelMode === 'car'
    ? ['kakao', 'naver', 'tmap']
    : ['kakao', 'naver'];
}

/* ------------------------------------------------------------------
   장소 검색 딥링크 — 등록 POI가 없는 거점의 fallback
   "강남역 맛집" 처럼 검색어를 만들어 지도 앱/웹 검색으로 넘긴다.
   ------------------------------------------------------------------ */

export const PLACE_KIND_LABEL = {
  restaurant: '맛집',
  cafe: '카페',
  dessert: '디저트 카페',
  brunch: '브런치',
};

/** '강남역 맛집' — 거점 이름 + 종류 */
export function placeSearchQuery(spotName, kind = 'restaurant') {
  const label = PLACE_KIND_LABEL[kind] || PLACE_KIND_LABEL.restaurant;
  const base = String(spotName || '').trim();
  return base ? `${base} ${label}` : label;
}

/** 네이버지도·카카오맵 검색 결과로 바로 넘기는 링크 */
export function placeSearchUrl(provider, query) {
  const q = encodeURIComponent(String(query || '').trim());
  if (provider === 'naver') return `https://map.naver.com/p/search/${q}`;
  return `https://map.kakao.com/link/search/${q}`;
}
