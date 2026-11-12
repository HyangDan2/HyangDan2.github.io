/* ==================================================================
   HD2Lab | Midpoint (PKPilot0002)
   app.js — 지도·참가자·결과 UI (NAVER 지도 v3 + 순수 로직 core.js)
   ================================================================== */

import {
  DEFAULT_NAMES,
  LONG_TRIP_KM,
  MAX_PARTICIPANTS,
  buildShareUrl,
  distanceStats,
  distancesKm,
  fairnessGrade,
  fairnessScore,
  formatKm,
  formatLatLng,
  formatMeters,
  haversineKm,
  lineMeta,
  maxPairwiseKm,
  mergePlaceSources,
  midpoint,
  nearestStations,
  parseShareState,
  rankPlacesAround,
  recommendMeetingCourse,
  recommendMeetingSpot,
  sanitizeName,
  spotKind,
  suggestPlaces,
  travelModeOf,
  walkMinutesForMeters,
  walkingMinutes,
} from './js/core.js';
import {
  LIVE_RADIUS_KM,
  MAX_LIVE_RADIUS_KM,
  loadLivePlaces,
  needsLiveSearch,
} from './js/live_places.js';
import { LINES, STATIONS } from './js/stations.js';
import { DRIVING_SPOTS, ROADS } from './js/driving_spots.js';
import { LANDMARKS } from './js/landmarks.js';
import { HUBS, PLACES } from './js/places.js';
import {
  PROVIDERS,
  isIOS,
  isMobileDevice,
  kakaoWalkRouteUrl,
  naverDirectionsUrl,
  placeSearchUrl,
  providerList,
} from './js/directions.js';

/* ------------------------------------------------------------------
   상수
   ------------------------------------------------------------------ */
const PALETTE = [
  '#5ec8ff', '#7ddba3', '#ffd166', '#c792ea', '#ff8fab', '#9be8d8',
  '#f4a261', '#a0c4ff', '#e0e08a', '#ff9f9f', '#b8e986', '#d0bfff',
];

const TRANSIT_PRESETS = [
  { label: '서울역', name: '서울역' },
  { label: '강남', name: '강남역' },
  { label: '홍대입구', name: '홍대입구역' },
  { label: '대전역', name: '대전역' },
  { label: '동대구역', name: '동대구역' },
  { label: '부산역', name: '부산역' },
  { label: '창원중앙', name: '창원중앙역' },
  { label: '광주송정', name: '광주송정역' },
];

const CAR_PRESETS = [
  { label: '판교IC', name: '판교IC' },
  { label: '기흥IC', name: '기흥IC' },
  { label: '천안IC', name: '천안IC' },
  { label: '대전IC', name: '대전IC' },
  { label: '동대구IC', name: '동대구IC' },
  { label: '경주IC', name: '경주IC' },
  { label: '서부산IC', name: '서부산IC' },
  { label: '동창원IC', name: '동창원IC' },
];

const SEOUL_CENTER = { lat: 37.5665, lng: 126.978 };

// NAVER 지도 v3 — 확대·축소 한계와 지도 종류(일반·위성)만 앱에서 관리한다. 타일은 네이버가 직접 그린다.
const MAP_MIN_ZOOM = 6;
const MAP_MAX_ZOOM = 19;

const STATION_INDEX = new Map(STATIONS.map(row => [row[0], row]));
const DRIVING_INDEX = new Map(DRIVING_SPOTS.map(row => [row[0], row]));

// 추천 후보: 지하철역·KTX·터미널 + 고속도로 IC·휴게소 + 주요 랜드마크
const SPOTS = [
  ...STATIONS.map(([name, lat, lng, lines, meta]) => [name, lat, lng, lines, { kind: meta?.hub ? 'ktx' : 'station', ...(meta || {}) }]),
  ...DRIVING_SPOTS.map(([name, lat, lng, , meta]) => [name, lat, lng, [], { ...meta }]),
  ...LANDMARKS.map(([name, lat, lng, note]) => [name, lat, lng, [], { kind: 'landmark', note }]),
];

/* ------------------------------------------------------------------
   상태
   ------------------------------------------------------------------ */
let seq = 0;
const state = {
  points: [], // { id, lat, lng, name, address, addressState }
  mode: 'fair',
  travelMode: 'transit',
  activeId: null,
  mapType: 'normal', // normal | hybrid (지도 도구의 레이어 버튼)
  placeView: 'course', // course | restaurant | cafe
  courseIndex: 0,
  liveRadiusKm: LIVE_RADIUS_KM, // 실시간 주변 조회 반경 (1 → 2 → 3km)
};

const el = {
  map: document.getElementById('map'),
  panel: document.getElementById('panel'),
  panelScroll: document.getElementById('panelScroll'),
  grab: document.getElementById('sheetGrab'),
  grabLabel: document.getElementById('grabLabel'),
  list: document.getElementById('participantList'),
  count: document.getElementById('participantCount'),
  chipText: document.getElementById('countChipText'),
  emptyHint: document.getElementById('emptyHint'),
  result: document.getElementById('resultCard'),
  presets: document.getElementById('presets'),
  modeToggle: document.getElementById('modeToggle'),
  searchForm: document.getElementById('searchForm'),
  searchInput: document.getElementById('searchInput'),
  searchBtn: document.getElementById('searchBtn'),
  searchResults: document.getElementById('searchResults'),
  resetBtn: document.getElementById('resetBtn'),
  fitBtn: document.getElementById('fitBtn'),
  fitBtnMap: document.getElementById('fitBtnMap'),
  shareBtn: document.getElementById('shareBtn'),
  styleBtn: document.getElementById('styleBtn'),
  zoomInBtn: document.getElementById('zoomInBtn'),
  zoomOutBtn: document.getElementById('zoomOutBtn'),
  mapHint: document.getElementById('mapHint'),
  toast: document.getElementById('toast'),
};

let map = null;
const markers = new Map();
// 마커·도형은 레이어별 Set에 모아 두고 setMap(null)로 한 번에 걷어낸다 (L.layerGroup 대체).
const layers = { person: new Set(), overlay: new Set(), focus: new Set() };
let infoWindow = null;
let geoTimer = null;
let toastTimer = null;
let renderQueued = false;

/* ------------------------------------------------------------------
   유틸
   ------------------------------------------------------------------ */
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function toast(message, ms = 2600) {
  el.toast.textContent = message;
  el.toast.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('is-on'), ms);
}

const isMobile = () => window.matchMedia('(max-width: 900px)').matches;

// 단위가 줄바꿈으로 떨어지지 않게 (예: "674 m")
const kmHtml = value => esc(formatKm(value)).replace(' ', '&nbsp;');

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

/* ------------------------------------------------------------------
   지도
   ------------------------------------------------------------------ */
function initMap() {
  // 인증이 실패하면 네이버가 maps.js 의 클래스를 null 로 만들기 때문에 하나 더 확인한다.
  if (!window.naver || !naver.maps || !naver.maps.LatLng) {
    toast('지도를 불러오지 못했어요 — 네트워크와 네이버 지도 인증(등록 도메인)을 확인해 주세요', 6000);
    return;
  }
  // 인증(클라이언트 ID·등록 도메인) 실패는 네이버가 이 전역 함수로 알려 준다.
  window.navermap_authFailure = () => {
    toast('네이버 지도 인증에 실패했어요 — NCP 콘솔의 Web 서비스 URL을 확인해 주세요', 6000);
  };

  try {
    map = new naver.maps.Map('map', {
      center: latlng(SEOUL_CENTER.lat, SEOUL_CENTER.lng),
      zoom: 11,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      zoomControl: false, // 확대·축소는 앱 지도 도구(.map-zoom)로 직접 그린다
      mapTypeControl: false,
      scaleControl: false,
      mapDataControl: true, // 지도 데이터 저작권(Naver·OSM) 표기는 그대로 노출한다
      draggable: true,
      keyboardShortcuts: true,
    });
  } catch (error) {
    map = null;
    console.error('[PKPilot0002] 네이버 지도 초기화 실패', error);
    toast('지도를 띄우지 못했어요 — 네이버 지도 인증을 확인해 주세요', 6000);
    return;
  }

  applyMapType(state.mapType);

  naver.maps.Event.addListener(map, 'click', event => {
    if (onOverlayClick(event)) return;
    addPoint({ lat: event.coord.lat(), lng: event.coord.lng(), source: 'map' });
  });
}

function applyMapType(type) {
  state.mapType = type === 'hybrid' ? 'hybrid' : 'normal';
  if (mapReady()) {
    map.setMapTypeId(state.mapType === 'hybrid' ? naver.maps.MapTypeId.HYBRID : naver.maps.MapTypeId.NORMAL);
  }
  const label = state.mapType === 'hybrid' ? '지도 종류: 위성 (누르면 일반)' : '지도 종류: 일반 (누르면 위성)';
  el.styleBtn.setAttribute('aria-label', label);
  el.styleBtn.setAttribute('aria-pressed', String(state.mapType === 'hybrid'));
  el.styleBtn.title = state.mapType === 'hybrid' ? '지도 종류: 위성' : '지도 종류: 일반';
}

function zoomBy(step) {
  if (!mapReady()) return;
  const next = Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, map.getZoom() + step));
  map.setZoom(next, true);
}

function fitAll(animate = true) {
  if (!mapReady()) return;
  if (!state.points.length) {
    moveTo(SEOUL_CENTER.lat, SEOUL_CENTER.lng, 11, animate);
    return;
  }
  if (state.points.length === 1) {
    moveTo(state.points[0].lat, state.points[0].lng, Math.max(map.getZoom(), 13), animate);
    return;
  }
  const peek = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--peek-h')) || 200;
  const padding = isMobile()
    ? { top: 70, left: 26, bottom: peek + 26, right: 26, maxZoom: 14 }
    : { top: 70, left: 56, bottom: 70, right: 56, maxZoom: 14 };
  map.fitBounds(boundsOf(state.points), padding);
}

/* ------------------------------------------------------------------
   지도 — 오버레이 유틸 (Leaflet 의 layer/marker/polyline 을 대신한다)
   ------------------------------------------------------------------ */
function latlng(lat, lng) {
  return new naver.maps.LatLng(lat, lng);
}

// 지도 API 를 실제로 쓸 수 있는 상태인지 — 네이버는 인증 실패 시 naver.maps 를 null 로 만든다.
function mapReady() {
  return Boolean(map && window.naver && naver.maps && naver.maps.LatLng);
}

function track(layer, overlay) {
  layers[layer].add(overlay);
  return overlay;
}

function clearLayer(layer) {
  layers[layer].forEach(overlay => {
    try {
      overlay.setMap(null);
    } catch {
      /* 이미 지도에서 떨어진 오버레이 */
    }
  });
  layers[layer].clear();
  if (layer !== 'person') closeInfo();
}

function closeInfo() {
  if (infoWindow) infoWindow.close();
}

// 말풍선은 하나만 재사용한다 — Leaflet 팝업처럼 한 번에 하나만 열린다.
function openInfo(lat, lng, html, offsetY = 0) {
  if (!mapReady()) return;
  if (!infoWindow) {
    infoWindow = new naver.maps.InfoWindow({
      backgroundColor: '#15170f',
      borderColor: '#3c4136',
      borderWidth: 1,
      anchorSize: new naver.maps.Size(12, 8),
      maxWidth: 280,
    });
  }
  infoWindow.setOptions({ pixelOffset: new naver.maps.Point(0, offsetY) });
  infoWindow.setContent(`<div class="map-popup">${html}</div>`);
  infoWindow.open(map, latlng(lat, lng));
}

// HTML 마커 — L.divIcon 대체. anchor는 마커 좌표가 content 안에서 놓이는 지점(px)이다.
function htmlMarker(layer, { lat, lng, html, size = [1, 1], anchor = [0, 0], zIndex = 0, clickable = false }) {
  if (!mapReady()) return null;
  return track(layer, new naver.maps.Marker({
    position: latlng(lat, lng),
    map,
    clickable,
    zIndex,
    cursor: clickable ? 'pointer' : 'default',
    icon: {
      content: html,
      size: new naver.maps.Size(size[0], size[1]),
      anchor: new naver.maps.Point(anchor[0], anchor[1]),
    },
  }));
}

function boundsOf(coords) {
  const first = coords[0];
  const bounds = new naver.maps.LatLngBounds(latlng(first.lat, first.lng), latlng(first.lat, first.lng));
  coords.slice(1).forEach(coord => bounds.extend(latlng(coord.lat, coord.lng)));
  return bounds;
}

function moveTo(lat, lng, zoom, animate = true) {
  if (!mapReady()) return;
  const level = Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, Math.round(zoom)));
  if (!animate) {
    map.setCenter(latlng(lat, lng));
    map.setZoom(level, false);
    return;
  }
  map.morph(latlng(lat, lng), level, { duration: 320 });
}

// 마커·도형 위를 누른 것은 지도 클릭(출발지 추가)이 아니다.
function onOverlayClick(event) {
  const node = event.pointerEvent?.target;
  return Boolean(node?.closest?.('.pin-holder, .pin-tip, .pin-mid, .pin-station, .pin-label, .pin-course, .pin-focus, .map-popup'));
}

/* ------------------------------------------------------------------
   참가자 조작
   ------------------------------------------------------------------ */
function makePoint(lat, lng, name) {
  seq += 1;
  return {
    id: `p${seq}`,
    lat,
    lng,
    name: name ? sanitizeName(name) : DEFAULT_NAMES(state.points.length),
    address: '',
    addressState: 'idle',
  };
}

function addPoint({ lat, lng, name, address, source = 'other' }) {
  if (state.points.length >= MAX_PARTICIPANTS) {
    toast(`최대 ${MAX_PARTICIPANTS}명까지 추가할 수 있어요`);
    return null;
  }
  const duplicate = state.points.find(p => haversineKm(p, { lat, lng }) < 0.02);
  if (duplicate) {
    toast('이미 같은 자리에 참가자가 있어요');
    return null;
  }
  const point = makePoint(lat, lng, name);
  if (address) {
    point.address = address;
    point.addressState = 'done';
  }
  state.points.push(point);
  state.activeId = point.id;
  if (!address) requestAddress(point);

  if (source !== 'map' && state.points.length === 2 && isMobile()) {
    setTimeout(() => setSheet('full'), 120);
  }
  fitAll();
  scheduleRender();
  return point;
}

function removePoint(id) {
  const index = state.points.findIndex(p => p.id === id);
  if (index < 0) return;
  state.points.splice(index, 1);
  const marker = markers.get(id);
  if (marker) {
    layers.person.delete(marker);
    marker.setMap(null);
    markers.delete(id);
  }
  if (state.activeId === id) state.activeId = null;
  render();
}

function resetAll() {
  if (!state.points.length) return;
  state.points = [];
  markers.forEach(marker => marker.setMap(null));
  markers.clear();
  layers.person.clear();
  state.activeId = null;
  seq = 0;
  render();
  fitAll();
  toast('모든 참가자를 지웠어요');
}

/* ------------------------------------------------------------------
   주소 (Nominatim) — 1초 간격 큐
   ------------------------------------------------------------------ */
const geoCache = new Map();
let geoChain = Promise.resolve();
let lastGeoAt = 0;

function queueGeocode(task) {
  const run = geoChain.then(async () => {
    const wait = Math.max(0, 1050 - (Date.now() - lastGeoAt));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    lastGeoAt = Date.now();
    return task();
  });
  geoChain = run.catch(() => {});
  return run;
}

function requestAddress(point) {
  const key = `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`;
  if (geoCache.has(key)) {
    applyAddress(point, geoCache.get(key));
    return;
  }
  point.addressState = 'loading';
  queueGeocode(async () => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${point.lat.toFixed(6)}&lon=${point.lng.toFixed(6)}&zoom=18&addressdetails=1&accept-language=ko`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      const text = describeAddress(data);
      geoCache.set(key, text);
      applyAddress(point, text);
    } catch {
      applyAddress(point, '');
    }
  });
}

function describeAddress(data) {
  if (!data) return '';
  const a = data.address || {};
  const city = a.city || a.province || a.state || '';
  const district = a.borough || a.county || a.city_district || a.district || '';
  const block = a.suburb || a.quarter || a.neighbourhood || a.town || a.village || '';
  const road = a.road || a.pedestrian || a.residential || '';
  const parts = [city, district, block, road].filter((v, i, arr) => v && arr.indexOf(v) === i);
  const joined = parts.join(' ');
  if (joined) return joined;
  return (data.name || data.display_name || '').split(',').slice(0, 2).join(', ').trim();
}

function applyAddress(point, text) {
  point.address = text || '';
  point.addressState = text ? 'done' : 'failed';
  const node = el.list.querySelector(`[data-addr="${point.id}"]`);
  if (node) {
    node.textContent = addressLabel(point);
    node.title = addressLabel(point);
  }
}

function addressLabel(point) {
  if (point.addressState === 'loading') return '주소 확인 중…';
  if (point.address) return point.address;
  return `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;
}

/* ------------------------------------------------------------------
   검색 — 내장 역·거점 자동완성 + Nominatim 외부 검색
   ------------------------------------------------------------------ */
const SUGGEST_LIMIT = 7;
const SUGGEST_DELAY = 120;

let searchRows = [];   // 지금 드롭다운에 그려진 항목들
let searchToken = 0;
let suggestTimer = null;
let activeIndex = -1;

function lineText(codes) {
  return (codes || []).map(code => lineMeta(code, LINES).name).join(' · ');
}

// 내장 데이터(957개 역·거점 + IC·휴게소 + 랜드마크)에서 즉시 찾는다 — 네트워크 없음
function localSuggestions(term) {
  return suggestPlaces(term, {
    stations: state.travelMode === 'car' ? [...DRIVING_SPOTS, ...STATIONS] : [...STATIONS, ...DRIVING_SPOTS],
    landmarks: LANDMARKS,
    limit: SUGGEST_LIMIT,
  }).map(item => ({
    name: item.name,
    lat: item.lat,
    lng: item.lng,
    kind: item.kind === 'landmark' ? 'landmark' : spotKind(item),
    lines: item.lines,
    note: item.note,
    address: item.kind === 'station' || item.kind === 'ktx'
      ? lineText(item.lines)
      : (item.note || (item.road ? `${item.road}${item.kind === 'rest' ? ' 휴게소' : ' IC'}` : (item.parking ? '주차 편리 거점' : ''))),
  }));
}

function emptyRow(text) {
  return `<li class="res-empty">${esc(text)}</li>`;
}

function remoteRowHtml(term) {
  if (!term) return '';
  const text = term.length > 14 ? `${term.slice(0, 14)}…` : term;
  return `<li class="res-more" role="option" aria-selected="false" data-remote="${esc(term)}">
      <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-search"/></svg>
      <span>‘${esc(text)}’ 주소·장소까지 찾기</span>
    </li>`;
}

function renderSearchRows(rows, options = {}) {
  searchRows = rows;
  activeIndex = -1;
  el.searchInput.removeAttribute('aria-activedescendant');
  if (!el.searchInput.value.trim()) {
    hideSearchResults();
    return;
  }
  if (!rows.length && !options.empty && !options.remoteTerm) {
    hideSearchResults();
    return;
  }
  el.searchResults.hidden = false;
  el.searchInput.setAttribute('aria-expanded', 'true');

  const items = rows.map((row, i) => {
    const icon = row.kind === 'station' || row.kind === 'ktx' ? 'i-train'
      : row.kind === 'landmark' ? 'i-pin' : 'i-car';
    const meta = row.kind === 'station' || row.kind === 'ktx'
      ? `<span class="res-lines">${lineBadges(row.lines) || '<span class="res-sub">지하철역</span>'}</span>`
      : `<span class="res-sub">${esc(row.address || row.note || row.road || '')}</span>`;
    return `<li role="option" id="search-opt-${i}" data-index="${i}" aria-selected="false" class="res-row res-${esc(row.kind)}">
        <span class="res-ic"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#${icon}"/></svg></span>
        <span class="res-body"><span class="res-name">${esc(row.name)}</span>${meta}</span>
        <span class="res-hint">출발지로 추가</span>
      </li>`;
  }).join('');

  const empty = rows.length ? '' : emptyRow(options.empty || '검색 결과가 없어요. 지도에서 직접 찍어 보세요.');
  el.searchResults.innerHTML = items + empty + remoteRowHtml(options.remoteTerm);
}

function hideSearchResults() {
  el.searchResults.hidden = true;
  el.searchResults.innerHTML = '';
  el.searchInput.setAttribute('aria-expanded', 'false');
  el.searchInput.removeAttribute('aria-activedescendant');
  searchRows = [];
  activeIndex = -1;
}

function highlightRow(index) {
  const nodes = [...el.searchResults.querySelectorAll('[data-index]')];
  if (!nodes.length) return;
  activeIndex = index < 0 ? -1 : (index >= nodes.length ? 0 : index);
  nodes.forEach((node, i) => {
    const on = i === activeIndex;
    node.classList.toggle('is-active', on);
    node.setAttribute('aria-selected', on ? 'true' : 'false');
    if (on) node.scrollIntoView({ block: 'nearest' });
  });
  if (activeIndex >= 0) el.searchInput.setAttribute('aria-activedescendant', `search-opt-${activeIndex}`);
  else el.searchInput.removeAttribute('aria-activedescendant');
}

// 드롭다운 항목 하나를 출발지로 추가
function applySearchRow(row) {
  if (!row) return false;
  const added = addPoint({
    lat: row.lat,
    lng: row.lng,
    name: row.name,
    address: row.address,
    source: 'search',
  });
  if (added) {
    el.searchInput.value = '';
    hideSearchResults();
    // iOS 키보드를 접어 결과 지도를 보여준다
    if (document.activeElement === el.searchInput) el.searchInput.blur();
  }
  return true;
}

function chooseSearchRow(index) {
  if (index < 0 || !searchRows[index]) return false;
  return applySearchRow(searchRows[index]);
}

async function runSearch(term) {
  const query = term.trim();
  if (!query) return;
  el.searchBtn.disabled = true;
  const token = ++searchToken;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=5&accept-language=ko&addressdetails=1`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    if (token !== searchToken) return;
    const rows = data.map(item => ({
      name: item.name || (item.display_name || '').split(',')[0],
      address: (item.display_name || '').split(',').slice(0, 3).join(' ').trim(),
      lat: Number(item.lat),
      lng: Number(item.lon),
      kind: 'remote',
      lines: [],
    })).filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng));
    renderSearchRows(rows, { empty: `‘${query}’ 주소를 찾지 못했어요. 지도에서 직접 찍어 보세요.` });
  } catch {
    if (token !== searchToken) return;
    renderSearchRows([], { empty: '검색에 실패했어요. 잠시 후 다시 시도해 주세요.' });
  } finally {
    if (token === searchToken) el.searchBtn.disabled = false;
  }
}

// 입력하는 즉시 내장 역·거점을 120ms 디바운스로 보여준다
function scheduleSuggest() {
  clearTimeout(suggestTimer);
  const term = el.searchInput.value.trim();
  if (!term) {
    hideSearchResults();
    return;
  }
  suggestTimer = setTimeout(() => {
    if (!el.searchInput.value.trim()) return;
    renderSearchRows(localSuggestions(term), { remoteTerm: term });
  }, SUGGEST_DELAY);
}

// 엔터·검색 버튼 — 정확히 맞는 역·거점이 있으면 바로 추가, 아니면 외부 검색
function submitSearch() {
  const term = el.searchInput.value.trim();
  if (!term) return;
  if (activeIndex >= 0 && chooseSearchRow(activeIndex)) return;
  const exact = localSuggestions(term).find(row => row.name === term || row.name.replace(/역$/, '') === term);
  if (exact) {
    applySearchRow(exact);
    return;
  }
  runSearch(term);
}

/* ------------------------------------------------------------------
   계산 결과
   ------------------------------------------------------------------ */
function computeResult() {
  const points = state.points;
  if (points.length === 0) return null;
  if (points.length === 1) {
    return { center: { lat: points[0].lat, lng: points[0].lng }, distances: [0], stats: null, fairness: null, rec: null };
  }
  const center = midpoint(points, state.mode);
  const distances = distancesKm(center, points);
  const stats = distanceStats(distances);
  const fairness = fairnessScore(distances);
  const rec = recommendMeetingSpot(points, SPOTS, {
    mode: state.mode,
    travelMode: state.travelMode,
    stations: STATIONS,
  });
  // 맛집·카페·코스의 기준이 되는 거점 — 추천 거점이 없으면 가장 가까운 역으로 후퇴
  const anchor = rec?.primary || (rec ? nearestStations(rec.center, SPOTS, 1, Infinity)[0] : null);
  const nearby = anchor ? buildNearby(anchor) : null;
  return { center, distances, stats, fairness, rec, anchor, nearby };
}

/* ------------------------------------------------------------------
   주변 맛집·카페 — 내장 스냅샷 + 실시간 조회 결합
   ------------------------------------------------------------------ */

// 실시간 조회 상태 — 거점 하나에 대해 한 번에 하나만 돌린다.
const liveRuntime = {
  anchorKey: '',
  key: '',
  status: 'idle', // idle | loading | ready | empty | error
  places: [],
  radiusKm: LIVE_RADIUS_KM,
  source: '',
  error: '',
  token: 0,
};

const anchorKeyOf = anchor => (anchor ? `${anchor.lat.toFixed(3)},${anchor.lng.toFixed(3)}` : '');
const liveKeyFor = anchor => `${anchorKeyOf(anchor)}@${state.liveRadiusKm}`;

/** 지금 손에 있는 재료(내장 POI + 실시간 POI)로 목록·코스를 만든다. */
function buildNearby(anchor) {
  const livePlaces = liveRuntime.key === liveKeyFor(anchor) && liveRuntime.status === 'ready'
    ? liveRuntime.places
    : [];
  const merged = mergePlaceSources(anchor, PLACES, livePlaces, {
    radiusKm: state.liveRadiusKm,
    travelMode: state.travelMode,
  });
  const course = recommendMeetingCourse(anchor, merged.places, {
    hubs: [merged.hub],
    travelMode: state.travelMode,
    radiusKm: state.liveRadiusKm,
  });
  return {
    ...course,
    sources: { snapshot: merged.baseCount, live: merged.liveCount, total: merged.places.length },
  };
}

function liveStatus(anchor) {
  const same = liveRuntime.key === liveKeyFor(anchor);
  return {
    status: same ? liveRuntime.status : 'idle',
    source: same ? liveRuntime.source : '',
    error: same ? liveRuntime.error : '',
    count: same ? liveRuntime.places.length : 0,
    radiusKm: state.liveRadiusKm,
  };
}

/**
 * 내장 POI 가 모자란 거점이면 실시간 조회를 시작한다.
 * 30개 허브는 스냅샷만으로 0ms 에 그려지고, 그 밖의 전국 거점만 네트워크를 쓴다.
 */
function ensureLiveNearby(result) {
  const anchor = result?.anchor;
  if (!anchor) return;
  const anchorKey = anchorKeyOf(anchor);
  if (liveRuntime.anchorKey !== anchorKey) {
    // 거점이 바뀌면 반경은 기본값으로 되돌린다 (같은 거점의 반경 조절은 유지)
    liveRuntime.anchorKey = anchorKey;
    state.liveRadiusKm = LIVE_RADIUS_KM;
  }
  const ranked = rankPlacesAround(anchor, PLACES, { radiusKm: state.liveRadiusKm });
  if (!needsLiveSearch(ranked.counts)) return; // 내장 스냅샷으로 충분한 거점
  const key = liveKeyFor(anchor);
  if (liveRuntime.key === key && liveRuntime.status !== 'idle') return;
  startLiveJob(anchor);
}

async function startLiveJob(anchor) {
  const token = liveRuntime.token + 1;
  liveRuntime.token = token;
  const radiusKm = state.liveRadiusKm;
  liveRuntime.key = liveKeyFor(anchor);
  liveRuntime.radiusKm = radiusKm;
  liveRuntime.status = 'loading';
  liveRuntime.places = [];
  liveRuntime.source = '';
  liveRuntime.error = '';
  scheduleRender();
  try {
    const found = await loadLivePlaces({ lat: anchor.lat, lng: anchor.lng, radiusKm });
    if (token !== liveRuntime.token) return;
    liveRuntime.places = found.places;
    liveRuntime.source = found.source || '';
    liveRuntime.status = found.places.length ? 'ready' : 'empty';
  } catch (error) {
    if (token !== liveRuntime.token) return;
    liveRuntime.places = [];
    liveRuntime.status = 'error';
    liveRuntime.error = String((error && error.message) || error);
  }
  if (token !== liveRuntime.token) return;
  render();
}

/* ------------------------------------------------------------------
   렌더 — 목록
   ------------------------------------------------------------------ */
function renderList(result) {
  el.list.innerHTML = state.points.map((point, i) => {
    const color = PALETTE[i % PALETTE.length];
    const distance = result && state.points.length >= 2 ? result.distances[i] : null;
    const km = distance === null || !Number.isFinite(distance)
      ? '<span class="p-km is-off">—</span>'
      : `<span class="p-km">${formatKm(distance)}</span>`;
    return `
      <li class="participant${point.id === state.activeId ? ' is-active' : ''}" data-id="${point.id}">
        <span class="p-dot" style="--c:${color}">${i + 1}</span>
        <span class="p-body">
          <input class="p-name" value="${esc(point.name)}" data-name="${point.id}" maxlength="24" aria-label="참가자 ${i + 1} 이름" />
          <span class="p-addr" data-addr="${point.id}" title="${esc(addressLabel(point))}">${esc(addressLabel(point))}</span>
        </span>
        ${km}
        <button class="p-del" type="button" data-del="${point.id}" aria-label="참가자 ${i + 1} 삭제" title="삭제">
          <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-trash"/></svg>
        </button>
      </li>`;
  }).join('');

  el.count.textContent = String(state.points.length);
  el.emptyHint.hidden = state.points.length > 0;
  el.resetBtn.disabled = state.points.length === 0;
}

/* ------------------------------------------------------------------
   렌더 — 결과 카드
   ------------------------------------------------------------------ */
function lineBadges(codes) {
  if (!codes || !codes.length) return '';
  return `<span class="line-badges">${codes.map(code => {
    const meta = lineMeta(code, LINES);
    const light = isLightColor(meta.color);
    return `<span class="line-badge" style="--lc:${meta.color};color:${light ? '#14150f' : '#fff'}" title="${esc(meta.name)}">${esc(shortLineName(meta))}</span>`;
  }).join('')}</span>`;
}

function shortLineName(meta) {
  const name = meta.name || meta.code;
  return name.replace('수인분당', '분당').replace('경의중앙', '경의').replace('김포골드', '김포').replace('공항철도', '공항').replace('우이신설', '우이');
}

/** IC·휴게소·주차 거점 배지 */
function spotBadges(spot) {
  const badges = [];
  if (spot.road) {
    const color = ROADS[spot.road] || '#8b8f83';
    const label = spot.road.replace(/고속도로$/, '').replace('수도권제1순환', '1순환').replace('수도권제2순환', '2순환');
    badges.push(`<span class="line-badge road-badge" style="--lc:${color};color:#fff" title="${esc(spot.road)}">${esc(label)}</span>`);
  }
  if (spot.kind === 'rest' && spot.both) badges.push('<span class="line-badge both-badge">쌍방</span>');
  if (spot.parking) badges.push('<span class="line-badge parking-badge">주차 편리</span>');
  return badges.join('');
}

function isLightColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 156;
}

function isCarMode() {
  return state.travelMode === 'car';
}

function kindKicker(spot) {
  const kind = spotKind(spot);
  if (kind === 'ktx' || kind === 'terminal') return '광역 환승 거점';
  if (kind === 'ic') return '고속도로 IC';
  if (kind === 'rest') return '휴게소 · 만남의 광장';
  if (kind === 'parking') return '대형 주차 거점';
  if (kind === 'landmark') return '추천 만남 장소';
  return '추천 만남 거점';
}

/** 참가자별 길찾기 버튼 행 — 카카오맵·네이버지도(·티맵) 원클릭 딥링크 */
function directionLinks(spot) {
  if (!spot) return '';
  const travelMode = state.travelMode;
  const rows = state.points.map((point, i) => {
    const color = PALETTE[i % PALETTE.length];
    const links = providerList(travelMode).map(key => {
      const provider = PROVIDERS[key];
      const url = provider.app({ from: point, to: spot, travelMode });
      const label = travelMode === 'car' ? provider.carLabel : provider.label;
      return `<a class="nav-chip" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${esc(point.name)} → ${esc(spot.name)} ${esc(label)} 길찾기">${esc(label)}</a>`;
    }).join('');
    return `
      <div class="dir-row">
        <span class="dir-who" style="--c:${color}">${esc(point.name)}</span>
        <span class="dir-links">${links}</span>
      </div>`;
  }).join('');
  return `
    <div class="dir-box">
      <div class="dir-head"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-walk"/></svg>여기까지 길찾기</div>
      ${rows}
    </div>`;
}

// 도차 60km/h + 도심 감속을 반영한 대략의 운전 시간(분)
function driveMinutes(km) {
  if (!Number.isFinite(km)) return '—';
  const minutes = (km / 60) * 60 + (km > 5 ? 10 : 3);
  return `${Math.max(1, Math.round(minutes))}분`;
}

/** 중심↔거점 이동 표기 — 도보 90분을 넘으면 광역 환승 거점이므로 도보 대신 접근 수단을 알려준다. */
function approachLabel(km, car) {
  if (car) return `차로 <b>${driveMinutes(km)}</b>`;
  const walk = walkingMinutes(km);
  return walk > 90 ? '<b>KTX·버스로 접근</b>' : `도보 <b>${walk}분</b>`;
}

/* ------------------------------------------------------------------
   렌더 — 주변 맛집·카페 · 1차+2차 약속 코스
   ------------------------------------------------------------------ */

function categoryBadge(place) {
  return `<span class="place-cat" data-kind="${place.kind}">${esc(place.category || (place.kind === 'cafe' ? '카페' : '음식점'))}</span>`;
}

function tagBadges(tags, category) {
  return (tags || [])
    .filter(tag => tag !== '영업시간' && tag !== category)
    .slice(0, 3)
    .map(tag => `<span class="place-tag">${esc(tag)}</span>`)
    .join('');
}

/** 네이버·카카오 지도 검색(리뷰) 링크 — POI에 저장된 링크가 없을 때 대비 */
function reviewLinks(place) {
  const query = `${place.name}`;
  const naver = place.naverUrl || placeSearchUrl('naver', query);
  const kakao = place.kakaoUrl || placeSearchUrl('kakao', query);
  return `<a class="place-link is-naver" href="${esc(naver)}" target="_blank" rel="noopener noreferrer" title="${esc(place.name)} 네이버지도 검색">네이버</a>
    <a class="place-link is-kakao" href="${esc(kakao)}" target="_blank" rel="noopener noreferrer" title="${esc(place.name)} 카카오맵 검색">카카오</a>`;
}

function focusButton(place) {
  return `<button class="mini-btn" type="button" data-focus-lat="${place.lat}" data-focus-lng="${place.lng}" data-focus-name="${esc(place.name)}">
    <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-target"/></svg>지도에서
  </button>`;
}

function placeCardHtml(place) {
  const walk = place.fromSpotMinutes ?? walkMinutesForMeters(place.fromSpotMeters);
  return `
    <li class="place-card">
      <div class="place-top">
        <span class="place-name">${esc(place.name)}</span>
        ${categoryBadge(place)}
      </div>
      <div class="place-meta">
        <span class="place-walk"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-walk"/></svg>도보 ${walk}분</span>
        <span class="place-dist">${esc(formatMeters(place.fromSpotMeters ?? 0))}</span>
        ${tagBadges(place.tags, place.category)}
      </div>
      <div class="place-actions">
        ${reviewLinks(place)}
        ${focusButton(place)}
      </div>
    </li>`;
}

function formatRadius(km) {
  const value = Number.isFinite(km) ? km : LIVE_RADIUS_KM;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** 실시간 조회 상태 칩 — 화면을 떠나지 않고 무엇을 하는지 보여 준다. */
function liveChipHtml(live) {
  const status = live?.status || 'idle';
  if (status === 'idle') return '';
  const label = status === 'loading' ? '찾는 중'
    : status === 'ready' ? `실시간 ${live.count}곳`
      : status === 'empty' ? '실시간 0곳'
        : '조회 안 됨';
  const title = status === 'error'
    ? '실시간 조회 서버가 응답하지 않았어요'
    : 'OpenStreetMap 실시간 조회 결과';
  return `<span class="nearby-live" data-live="${status}" title="${esc(title)}"><i></i>${esc(label)}</span>`;
}

/** 실시간 조회 중 스켈레톤 — 화면이 멈추지 않게 자리부터 잡아 둔다. */
function liveLoadingHtml(anchor, radiusLabel) {
  const rows = Array.from({ length: 3 }, () => `
    <li class="skel-row">
      <span class="skel-dot"></span>
      <span class="skel-lines"><i></i><i></i></span>
    </li>`).join('');
  return `
    <div class="nearby-loading" role="status" aria-live="polite">
      <p class="nearby-loading-head">
        <span class="spinner" aria-hidden="true"></span>
        <b>주변 맛집·카페 찾는 중…</b>
      </p>
      <p class="nearby-loading-sub">${esc(anchor.name)} 반경 ${radiusLabel}km · 실시간 조회</p>
      <ul class="skel-list">${rows}</ul>
    </div>`;
}

/** 반경 안에 아무것도 없을 때 — 앱 안에서 반경을 넓혀 다시 찾는다. */
function emptyNearbyHtml(anchor, view, counts = {}, live = {}, radiusKm = LIVE_RADIUS_KM) {
  const radiusLabel = formatRadius(radiusKm);
  const noRestaurant = !counts.restaurant;
  const noCafe = !counts.cafe;
  let message;
  if (view === 'restaurant') message = `반경 ${radiusLabel}km 안에서 식당을 찾지 못했어요.`;
  else if (view === 'cafe') message = `반경 ${radiusLabel}km 안에서 카페를 찾지 못했어요.`;
  else if (!noRestaurant && noCafe) message = '1차 식당은 찾았지만 이어 걸을 카페가 반경 안에 없어요.';
  else if (noRestaurant && !noCafe) message = '카페는 찾았지만 1차 식당이 반경 안에 없어 코스를 만들지 못했어요.';
  else message = `반경 ${radiusLabel}km 안에서 식당·카페를 찾지 못했어요.`;
  const failed = live.status === 'error';
  const hint = failed
    ? '실시간 조회 서버(OpenStreetMap)가 지금 붐비네요. 잠시 뒤 다시 찾아볼 수 있어요.'
    : '산길·공단처럼 상가가 드문 곳이에요. 반경을 넓히면 앱 안에서 계속 찾아볼 수 있어요.';
  const nextRadius = Math.min(MAX_LIVE_RADIUS_KM, Math.round(radiusKm) + 1);
  const canWiden = !failed && nextRadius > radiusKm;
  return `
    <div class="nearby-empty${failed ? ' is-error' : ''}">
      <p>${esc(anchor.name)} · ${esc(message)}</p>
      <p class="nearby-empty-hint">${esc(hint)}</p>
      <div class="nearby-actions">
        ${canWiden ? `<button class="nearby-btn" type="button" data-widen="${nextRadius}">반경 ${nextRadius}km로 넓혀 찾기</button>` : ''}
        <button class="nearby-btn is-ghost" type="button" data-retry-live>다시 찾기</button>
      </div>
    </div>`;
}

function courseCardHtml(course, index, active) {
  const restaurant = course.restaurant;
  const cafe = course.cafe;
  const cafeMeta = (cafe.tags || [])
    .filter(tag => tag !== '영업시간' && tag !== '체인')
    .slice(0, 2)
    .join(' · ')
    || cafe.category
    || '카페';
  return `
    <button class="course-card${active ? ' is-active' : ''}" type="button" data-course="${index}" aria-pressed="${active}">
      <span class="course-head">
        <b>${index + 1}순위</b>
        <span class="course-total">총 도보 ${course.totalMinutes}분</span>
      </span>
      <span class="course-leg">
        <span class="leg-num">1차</span>
        <span class="leg-body">
          <span class="leg-name">${esc(restaurant.name)}</span>
          <span class="leg-meta">${esc(restaurant.category || '음식점')} · 도보 ${restaurant.fromSpotMinutes}분</span>
        </span>
      </span>
      <span class="course-move">➔ 도보 ${course.walkMinutes}분 <em>${esc(formatMeters(course.walkMeters))} 이동</em></span>
      <span class="course-leg">
        <span class="leg-num is-cafe">2차</span>
        <span class="leg-body">
          <span class="leg-name">${esc(cafe.name)}</span>
          <span class="leg-meta">${esc(cafeMeta)} · 도보 ${cafe.fromSpotMinutes}분</span>
        </span>
      </span>
    </button>`;
}

function courseActionsHtml(course, anchor) {
  const restaurant = course.restaurant;
  const cafe = course.cafe;
  const toRestaurantNaver = naverDirectionsUrl({ from: anchor, to: restaurant, travelMode: 'walk' });
  const toRestaurantKakao = kakaoWalkRouteUrl({ from: anchor, to: restaurant });
  const toCafeNaver = naverDirectionsUrl({ from: restaurant, to: cafe, travelMode: 'walk' });
  const toCafeKakao = kakaoWalkRouteUrl({ from: restaurant, to: cafe });
  return `
    <div class="course-actions">
      <div class="course-action-row">
        <span class="course-action-label">1차 맛집 길찾기</span>
        <a class="nav-chip" href="${esc(toRestaurantNaver)}" target="_blank" rel="noopener noreferrer">네이버지도</a>
        <a class="nav-chip" href="${esc(toRestaurantKakao)}" target="_blank" rel="noopener noreferrer">카카오맵</a>
      </div>
      <div class="course-action-row">
        <span class="course-action-label">식당➔카페 도보</span>
        <a class="nav-chip" href="${esc(toCafeNaver)}" target="_blank" rel="noopener noreferrer">네이버지도</a>
        <a class="nav-chip" href="${esc(toCafeKakao)}" target="_blank" rel="noopener noreferrer">카카오맵</a>
      </div>
    </div>`;
}

function nearbyMarkup(result) {
  const anchor = result?.anchor;
  const courseResult = result?.nearby;
  const nearby = courseResult?.nearby;
  if (!anchor || !courseResult || !nearby) return '';

  const courses = courseResult.courses || [];
  if (state.courseIndex >= courses.length) state.courseIndex = 0;
  const view = state.placeView;
  const counts = nearby.counts || { restaurant: 0, cafe: 0 };
  const live = liveStatus(anchor);
  const tabs = [
    { key: 'course', label: '📍 추천 코스' },
    { key: 'restaurant', label: `🍽️ 맛집 (${counts.restaurant})` },
    { key: 'cafe', label: `☕ 카페 (${counts.cafe})` },
  ];

  const radiusKm = nearby.radiusKm || state.liveRadiusKm || LIVE_RADIUS_KM;
  const radiusLabel = formatRadius(radiusKm);
  const list = view === 'restaurant' ? nearby.restaurants : nearby.cafes;
  const hasContent = view === 'course' ? courses.length > 0 : list.length > 0;
  let body = '';
  if (live.status === 'loading' && !hasContent) {
    body = liveLoadingHtml(anchor, radiusLabel);
  } else if (view === 'course') {
    body = courses.length
      ? `${courses.map((course, i) => courseCardHtml(course, i, i === state.courseIndex)).join('')}
         ${courseActionsHtml(courses[state.courseIndex] || courses[0], anchor)}`
      : emptyNearbyHtml(anchor, 'course', counts, live, radiusKm);
  } else {
    body = list.length
      ? `<ul class="place-list">${list.map(placeCardHtml).join('')}</ul>`
      : emptyNearbyHtml(anchor, view, counts, live, radiusKm);
  }

  const sourceNote = live.status === 'ready'
    ? `실시간 OpenStreetMap 조회 ${live.count}곳 · `
    : '';
  return `
    <section class="nearby" id="nearbySection" aria-label="주변 맛집·카페와 약속 코스">
      <div class="nearby-head">
        <h3><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-course"/></svg>약속 코스 · 맛집·카페</h3>
        <span class="nearby-side">
          <span class="nearby-anchor">${esc(anchor.name)} 반경 ${radiusLabel}km</span>
          ${liveChipHtml(live)}
        </span>
      </div>
      <div class="nearby-tabs" role="tablist" aria-label="맛집·카페 보기">
        ${tabs.map(tab => `<button type="button" role="tab" data-place-view="${tab.key}" aria-selected="${view === tab.key}">${tab.label}</button>`).join('')}
      </div>
      <div class="nearby-body">${body}</div>
      <p class="nearby-note">${sourceNote}장소·좌표 OpenStreetMap(ODbL) · 도보 시간은 직선거리 보정값 · 평점은 네이버·카카오 리뷰로 확인</p>
    </section>`;
}

function renderResult(result) {
  if (!result || state.points.length < 2) {
    el.result.hidden = true;
    el.result.innerHTML = '';
    return;
  }
  el.result.hidden = false;

  const score = result.fairness ?? 0;
  const grade = fairnessGrade(score);
  const stats = result.stats;
  const rec = result.rec;
  const primary = rec?.primary || null;
  const alternative = rec?.alternative || null;

  const station = result.anchor;
  const car = isCarMode();

  const spreadRows = state.points.map((point, i) => {
    const d = result.distances[i];
    const max = stats?.max || 1;
    const width = Number.isFinite(d) ? Math.max(6, Math.min(100, (d / max) * 100)) : 0;
    return `
      <div class="spread-row">
        <span class="s-idx" style="color:${PALETTE[i % PALETTE.length]}">${i + 1}</span>
        <span class="s-bar"><i style="--w:${width.toFixed(1)}%"></i></span>
        <span class="s-val">${formatKm(d)}</span>
      </div>`;
  }).join('');

  const stationMarkup = station ? `
    <div class="card station-card ${car ? 'is-car' : ''}">
      <div class="station-top">
        <span class="station-kicker"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#${car ? 'i-car' : 'i-train'}"/></svg>${primary ? kindKicker(station) : '가장 가까운 곳'}</span>
        <span class="station-dist">중심에서 ${formatKm(primary ? primary.km : station.km)}</span>
      </div>
      <div class="station-name">${esc(station.name)} ${car ? spotBadges(station) : (car ? '' : lineBadges(station.lines))}</div>
      <div class="station-actions">
        <div class="station-meta">
          <span>${approachLabel(primary ? primary.km : station.km, car)}</span>
          <span>가장 먼 참가자 <b>${formatKm(stats.max)}</b></span>
        </div>
        <button class="mini-btn" type="button" data-focus-lat="${station.lat}" data-focus-lng="${station.lng}">
          <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-target"/></svg>지도에서
        </button>
      </div>
      ${directionLinks(station)}
    </div>` : `
    <div class="card station-card">
      <div class="station-top">
        <span class="station-kicker"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#${car ? 'i-car' : 'i-train'}"/></svg>추천 만남 거점</span>
      </div>
      <div class="station-name" style="font-size:15px">주변에 ${car ? '고속도로 거점이' : '지하철역이'} 없어요</div>
      <p class="lede" style="margin-top:6px">중간 지점 좌표를 확인해 보세요.</p>
    </div>`;

  el.result.innerHTML = `
    <div class="result-head">
      <h2><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-target"/></svg>중간 지점</h2>
      <button class="coord-btn" type="button" id="coordBtn" title="좌표 복사">${formatLatLng(result.center)}
        <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-copy"/></svg>
      </button>
    </div>
    <div class="card">
      <div class="fair">
        <div class="ring" style="--p:${score.toFixed(0)}">
          <div class="ring-inner"><b>${Math.round(score)}</b><span>FAIRNESS</span></div>
        </div>
        <div class="fair-copy" data-tone="${grade.tone}">
          <h3><span class="dot"></span>공평도 ${Math.round(score)}% · ${grade.label}</h3>
          <p>${grade.hint}${stats ? ` · 최대 격차 ${kmHtml(stats.spread)}` : ''}</p>
          <div class="fair-stats">
            <div><b>${state.points.length}명</b><span>참가자</span></div>
            <div><b>${formatKm(stats.mean)}</b><span>평균 거리</span></div>
            <div><b>${formatKm(stats.max)}</b><span>가장 먼 거리</span></div>
          </div>
        </div>
      </div>
      <div class="mode-switch" role="group" aria-label="계산 방식">
        <button type="button" data-mode="fair" aria-pressed="${state.mode === 'fair'}">공평점<small>최대 거리 최소</small></button>
        <button type="button" data-mode="median" aria-pressed="${state.mode === 'median'}">균형점<small>거리 합 최소</small></button>
        <button type="button" data-mode="centroid" aria-pressed="${state.mode === 'centroid'}">무게중심<small>위치 평균</small></button>
      </div>
    </div>

    ${stationMarkup}

    ${nearbyMarkup(result)}

    ${alternative ? `
      <div class="alt-station">
        <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#${car ? 'i-car' : 'i-train'}"/></svg>
        <span>더 공평한 ${car ? '거점' : '역'} <b>${esc(alternative.name)}</b> · 가장 먼 참가자 ${kmHtml(alternative.maxKm)}</span>
        <span class="alt-km">중심에서 ${formatKm(alternative.km)}</span>
      </div>` : ''}

    <div class="spread">
      <div class="spread-head"><span>참가자별 거리</span><span>${formatKm(stats.total)} 합계</span></div>
      ${spreadRows}
    </div>

    <div class="share-row">
      <button type="button" id="shareBtnInline">
        <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-share"/></svg>링크 복사
      </button>
    </div>
  `;

  el.result.querySelectorAll('[data-mode]').forEach(button => {
    button.addEventListener('click', () => {
      state.mode = button.dataset.mode;
      render();
    });
  });
  el.result.querySelectorAll('[data-focus-lat]').forEach(button => {
    button.addEventListener('click', () => {
      const lat = Number(button.dataset.focusLat);
      const lng = Number(button.dataset.focusLng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        moveTo(lat, lng, button.dataset.focusName ? 16 : 15);
        if (button.dataset.focusName) {
          focusPlace({ lat, lng, name: button.dataset.focusName });
        }
        if (isMobile()) setSheet('peek');
      }
    });
  });
  el.result.querySelectorAll('[data-place-view]').forEach(button => {
    button.addEventListener('click', () => {
      if (state.placeView === button.dataset.placeView) return;
      state.placeView = button.dataset.placeView;
      clearLayer('focus');
      render();
    });
  });
  el.result.querySelectorAll('[data-course]').forEach(button => {
    button.addEventListener('click', () => {
      const next = Number(button.dataset.course);
      if (!Number.isFinite(next)) return;
      const changed = next !== state.courseIndex;
      state.courseIndex = next;
      clearLayer('focus');
      if (changed) render();
      const course = computeResult()?.nearby?.courses?.[state.courseIndex];
      if (course && map) {
        map.fitBounds(
          boundsOf([course.restaurant, course.cafe]),
          { top: 46, left: 46, bottom: 46, right: 46, maxZoom: 17 },
        );
        if (isMobile()) setSheet('peek');
      }
    });
  });
  // 실시간 조회 — 반경 넓히기·다시 찾기 (앱 안에서 계속 탐색)
  el.result.querySelectorAll('[data-widen]').forEach(button => {
    button.addEventListener('click', () => {
      const next = Number(button.dataset.widen);
      if (!Number.isFinite(next)) return;
      state.liveRadiusKm = Math.min(MAX_LIVE_RADIUS_KM, Math.max(LIVE_RADIUS_KM, Math.round(next)));
      liveRuntime.key = '';
      liveRuntime.status = 'idle';
      render();
    });
  });
  el.result.querySelectorAll('[data-retry-live]').forEach(button => {
    button.addEventListener('click', () => {
      liveRuntime.key = '';
      liveRuntime.status = 'idle';
      render();
    });
  });
  const coordBtn = el.result.querySelector('#coordBtn');
  if (coordBtn) {
    coordBtn.addEventListener('click', async () => {
      const text = `${result.center.lat.toFixed(5)}, ${result.center.lng.toFixed(5)}`;
      const ok = await copyText(text);
      toast(ok ? '좌표를 복사했어요' : text);
    });
  }
  const inlineShare = el.result.querySelector('#shareBtnInline');
  if (inlineShare) inlineShare.addEventListener('click', copyLink);
}

/* ------------------------------------------------------------------
   렌더 — 지도
   ------------------------------------------------------------------ */
function syncMarkers(result) {
  if (!mapReady()) return;
  const live = new Set(state.points.map(p => p.id));
  for (const [id, marker] of markers) {
    if (live.has(id)) continue;
    layers.person.delete(marker);
    marker.setMap(null);
    markers.delete(id);
  }

  state.points.forEach((point, i) => {
    const color = PALETTE[i % PALETTE.length];
    let marker = markers.get(point.id);
    if (!marker) {
      marker = new naver.maps.Marker({
        position: latlng(point.lat, point.lng),
        map,
        draggable: true,
        clickable: true,
        cursor: 'grab',
        zIndex: 300 + i,
        icon: {
          content: `<span class="pin-holder"><span class="pin-person" style="--c:${color}"><span>${i + 1}</span><span class="pin-tail"></span></span><span class="pin-tip">${esc(point.name)}</span></span>`,
          size: new naver.maps.Size(30, 36),
          anchor: new naver.maps.Point(15, 30),
        },
      });
      naver.maps.Event.addListener(marker, 'drag', () => {
        const pos = marker.getPosition();
        point.lat = pos.lat();
        point.lng = pos.lng();
        updateOverlaysOnly();
        scheduleLightResult();
      });
      naver.maps.Event.addListener(marker, 'dragend', () => {
        point.address = '';
        point.addressState = 'idle';
        requestAddress(point);
        render();
      });
      naver.maps.Event.addListener(marker, 'click', () => {
        state.activeId = point.id;
        scheduleRender();
      });
      layers.person.add(marker);
      markers.set(point.id, marker);
    } else {
      marker.setPosition(latlng(point.lat, point.lng));
      marker.setZIndex(300 + i);
      const holder = marker.getElement();
      const dot = holder?.querySelector('.pin-person');
      if (dot) {
        dot.style.setProperty('--c', color);
        const num = dot.querySelector('span');
        if (num) num.textContent = String(i + 1);
      }
      const tip = holder?.querySelector('.pin-tip');
      if (tip && tip.textContent !== point.name) tip.textContent = point.name;
    }
  });
}

function updateOverlaysOnly() {
  const result = computeResult();
  if (!result) return;
  drawOverlays(result);
  updateDistancesInline(result);
}

let lightTimer = null;
function scheduleLightResult() {
  clearTimeout(lightTimer);
  lightTimer = setTimeout(() => {
    const result = computeResult();
    if (result) renderResult(result);
  }, 120);
}

function updateDistancesInline(result) {
  document.querySelectorAll('.p-km').forEach((node, i) => {
    if (!(node instanceof HTMLElement)) return;
    const d = result.distances[i];
    node.textContent = Number.isFinite(d) ? formatKm(d) : '—';
  });
}

function drawOverlays(result) {
  clearLayer('overlay');
  if (!mapReady() || !result || state.points.length === 0) return;

  if (state.points.length >= 2) {
    const { center } = result;
    const mean = result.stats?.mean || 0;
    if (mean > 0.05) {
      track('overlay', new naver.maps.Circle({
        map,
        center: latlng(center.lat, center.lng),
        radius: Math.max(mean * 1000, 60),
        strokeColor: '#ff824f',
        strokeOpacity: 0.22,
        strokeWeight: 1,
        strokeStyle: 'shortdash',
        fillColor: '#ff824f',
        fillOpacity: 0.035,
        clickable: false,
        zIndex: 110,
      }));
    }

    state.points.forEach((point, i) => {
      track('overlay', new naver.maps.Polyline({
        map,
        path: [latlng(point.lat, point.lng), latlng(center.lat, center.lng)],
        strokeColor: '#ff824f',
        strokeOpacity: 0.5,
        strokeWeight: 1.5,
        strokeStyle: 'dashed',
        clickable: false,
        zIndex: 120,
      }));

      const t = 0.55;
      const lat = point.lat + (center.lat - point.lat) * t;
      const lng = point.lng + (center.lng - point.lng) * t;
      const d = result.distances[i];
      if (Number.isFinite(d) && d > 0.05) {
        htmlMarker('overlay', {
          lat,
          lng,
          zIndex: 130,
          html: `<span class="center-holder"><span class="pin-label">${esc(formatKm(d))}</span></span>`,
        });
      }
    });

    htmlMarker('overlay', {
      lat: center.lat,
      lng: center.lng,
      size: [52, 52],
      anchor: [26, 26],
      zIndex: 800,
      html: '<span class="pin-mid"><span class="pulse"></span><span class="pulse"></span><span class="core"></span></span>',
    });
  }

  const station = result.rec?.primary;
  if (station) {
    const car = isCarMode();
    const marker = htmlMarker('overlay', {
      lat: station.lat,
      lng: station.lng,
      zIndex: 600,
      clickable: true,
      html: `<span class="above-holder"><span class="pin-station"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#${car ? 'i-car' : 'i-train'}"/></svg>${esc(station.name)}</span></span>`,
    });
    if (marker) {
      naver.maps.Event.addListener(marker, 'click', () => {
        openInfo(
          station.lat,
          station.lng,
          `<strong>${esc(station.name)}</strong><br/>중심에서 ${formatKm(station.km)} · ${car ? `차로 ${driveMinutes(station.km)}` : (walkingMinutes(station.km) > 90 ? 'KTX·버스로 접근' : `도보 ${walkingMinutes(station.km)}분`)}`,
          -32,
        );
      });
    }
  }

  // 1차 식당 ➔ 2차 카페 약속 코스
  const course = state.placeView === 'course' ? result.nearby?.courses?.[state.courseIndex] : null;
  if (course && result.anchor) drawCourseOverlay(course, result.anchor);
}

/** 지도에서 찾은 장소 한 곳을 강조한다 — 목록의 “지도에서” 버튼 */
function focusPlace(place) {
  if (!mapReady()) return;
  clearLayer('focus');
  htmlMarker('focus', {
    lat: place.lat,
    lng: place.lng,
    size: [34, 34],
    anchor: [17, 17],
    zIndex: 1200,
    html: '<span class="pin-focus"></span>',
  });
  openInfo(place.lat, place.lng, `<strong>${esc(place.name)}</strong><br/>지도에서 위치 확인`, -24);
}

function coursePin(place, number, kind) {
  const glyph = number === 1 ? '①' : number === 2 ? '②' : String(number);
  const popup = `<div class="popup-place">
      <strong>${esc(place.name)}</strong>
      <span>${esc(place.category || '')} · 도보 ${place.fromSpotMinutes ?? place.walkMinutes}분</span>
      <span class="popup-links">${reviewLinks(place)}</span>
    </div>`;
  const marker = htmlMarker('overlay', {
    lat: place.lat,
    lng: place.lng,
    size: [36, 44],
    anchor: [18, 38],
    zIndex: 1000,
    clickable: true,
    html: `<span class="pin-course is-${kind}"><b>${glyph}</b><i></i></span>`,
  });
  if (marker) naver.maps.Event.addListener(marker, 'click', () => openInfo(place.lat, place.lng, popup, -34));
  return marker;
}

function drawCourseOverlay(course, anchor) {
  const restaurant = course.restaurant;
  const cafe = course.cafe;

  track('overlay', new naver.maps.Polyline({
    map,
    path: [latlng(anchor.lat, anchor.lng), latlng(restaurant.lat, restaurant.lng)],
    strokeColor: '#ffa77f',
    strokeOpacity: 0.8,
    strokeWeight: 2,
    strokeStyle: 'dashed',
    clickable: false,
    zIndex: 200,
  }));

  track('overlay', new naver.maps.Polyline({
    map,
    path: [latlng(restaurant.lat, restaurant.lng), latlng(cafe.lat, cafe.lng)],
    strokeColor: '#ffb366',
    strokeOpacity: 0.95,
    strokeWeight: 3.5,
    strokeStyle: 'dashed',
    clickable: false,
    zIndex: 210,
  }));

  htmlMarker('overlay', {
    lat: (restaurant.lat + cafe.lat) / 2,
    lng: (restaurant.lng + cafe.lng) / 2,
    zIndex: 950,
    html: `<span class="center-holder"><span class="course-label">도보 ${course.walkMinutes}분</span></span>`,
  });

  coursePin(restaurant, '1', 'rest');
  coursePin(cafe, '2', 'cafe');
}

/* ------------------------------------------------------------------
   렌더 — 공통
   ------------------------------------------------------------------ */
function render() {
  const result = computeResult();
  ensureLiveNearby(result);
  renderList(result);
  renderResult(result);
  syncMarkers(result);
  drawOverlays(result);
  updateChrome();
  syncUrl();
}

function updateChrome() {
  const count = state.points.length;
  el.chipText.textContent = `${count}명`;
  el.mapHint.hidden = count > 0;
  el.resetBtn.disabled = count === 0;
  el.fitBtn.disabled = count === 0;
  el.fitBtnMap.disabled = count === 0;
  el.shareBtn.disabled = count === 0;
}

function syncUrl() {
  try {
    const url = state.points.length
      ? buildShareUrl(location.href, state.points, state.mode, state.travelMode)
      : `${location.origin}${location.pathname.replace(/index\.html?$/i, '')}`;
    history.replaceState(null, '', url);
  } catch {
    /* file:// 등 URL 조작이 막힌 환경에서는 조용히 넘어간다 */
  }
}

/* ------------------------------------------------------------------
   공유
   ------------------------------------------------------------------ */
async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 아래 폴백 */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

async function copyLink() {
  if (!state.points.length) {
    toast('먼저 출발지를 추가해 주세요');
    return;
  }
  const url = buildShareUrl(location.href, state.points, state.mode);
  const ok = await copyText(url);
  toast(ok ? '링크를 복사했어요 — 받은 사람은 같은 결과를 봅니다' : url, ok ? 2800 : 6000);
}

/* ------------------------------------------------------------------
   모바일 바텀 시트
   ------------------------------------------------------------------ */
function setSheet(mode) {
  if (!isMobile()) return;
  el.panel.dataset.sheet = mode;
  el.grab.setAttribute('aria-expanded', String(mode === 'full'));
  el.grabLabel.textContent = mode === 'full' ? '패널 접기' : '패널 펼치기';
  el.panel.style.transform = '';
  if (mode === 'peek') el.panelScroll.scrollTop = 0;
}

function initSheet() {
  let startY = 0;
  let startOffset = 0;
  let dragging = false;
  let moved = 0;

  const closedOffset = () => {
    const panelHeight = el.panel.getBoundingClientRect().height;
    const peek = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--peek-h')) || 200;
    return Math.max(0, panelHeight - peek);
  };

  el.grab.addEventListener('pointerdown', event => {
    if (!isMobile()) return;
    dragging = true;
    moved = 0;
    startY = event.clientY;
    startOffset = el.panel.dataset.sheet === 'full' ? 0 : closedOffset();
    el.panel.classList.add('is-dragging');
    el.grab.setPointerCapture(event.pointerId);
  });

  el.grab.addEventListener('pointermove', event => {
    if (!dragging) return;
    const dy = event.clientY - startY;
    moved = Math.max(moved, Math.abs(dy));
    const next = Math.max(0, Math.min(closedOffset(), startOffset + dy));
    el.panel.style.transform = `translateY(${next}px)`;
  });

  const end = event => {
    if (!dragging) return;
    dragging = false;
    el.panel.classList.remove('is-dragging');
    const dy = event.clientY - startY;
    const wasFull = el.panel.dataset.sheet === 'full';
    if (Math.abs(dy) < 8) {
      setSheet(wasFull ? 'peek' : 'full');
      return;
    }
    const threshold = closedOffset() / 2;
    if (wasFull) setSheet(dy > threshold ? 'peek' : 'full');
    else setSheet(dy < -40 ? 'full' : 'peek');
  };

  el.grab.addEventListener('pointerup', end);
  el.grab.addEventListener('pointercancel', end);

  el.grab.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSheet(el.panel.dataset.sheet === 'full' ? 'peek' : 'full');
    }
  });

  window.addEventListener('resize', () => {
    if (!isMobile()) {
      el.panel.style.transform = '';
      el.panel.dataset.sheet = 'peek';
    }
  });
}

/* ------------------------------------------------------------------
   이벤트 바인딩
   ------------------------------------------------------------------ */
function initPresets() {
  renderPresets();
  el.presets.addEventListener('click', event => {
    const chip = event.target.closest('[data-preset]');
    if (!chip) return;
    const lat = Number(chip.dataset.lat);
    const lng = Number(chip.dataset.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast('위치를 찾지 못했어요');
      return;
    }
    const name = chip.dataset.preset;
    const point = addPoint({ lat, lng, name, source: 'preset' });
    if (point) toast(`${name} 추가`);
  });
}

function renderPresets() {
  const presets = isCarMode() ? CAR_PRESETS : TRANSIT_PRESETS;
  el.presets.innerHTML = presets.map(preset => {
    const row = STATION_INDEX.get(preset.name) || DRIVING_INDEX.get(preset.name);
    const landmark = LANDMARKS.find(l => l[0] === preset.name);
    const lat = row ? row[1] : landmark?.[1];
    const lng = row ? row[2] : landmark?.[2];
    return `<button class="chip" type="button" data-preset="${esc(preset.name)}" data-lat="${lat ?? ''}" data-lng="${lng ?? ''}">${esc(preset.label)}</button>`;
  }).join('');
}

function setTravelMode(mode, notify = true) {
  const next = travelModeOf(mode);
  if (state.travelMode === next) return;
  state.travelMode = next;
  el.modeToggle.querySelectorAll('[data-travel]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.travel === next));
  });
  renderPresets();
  render();
  if (notify) {
    toast(next === 'car'
      ? '자차 모드 — 고속도로 IC·휴게소 거점을 추천해요'
      : '대중교통 모드 — 역·터미널 거점을 추천해요');
  }
}

function initModeToggle() {
  el.modeToggle.querySelectorAll('[data-travel]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.travel === state.travelMode));
    button.addEventListener('click', () => setTravelMode(button.dataset.travel));
  });
}

function initListEvents() {
  el.list.addEventListener('click', event => {
    const del = event.target.closest('[data-del]');
    if (del) {
      removePoint(del.dataset.del);
      return;
    }
    if (event.target.closest('input, button')) return;
    const row = event.target.closest('.participant');
    if (row) {
      state.activeId = row.dataset.id;
      const point = state.points.find(p => p.id === state.activeId);
      if (point && map) map.panTo(latlng(point.lat, point.lng), { duration: 320 });
      el.list.querySelectorAll('.participant').forEach(node => {
        node.classList.toggle('is-active', node.dataset.id === state.activeId);
      });
    }
  });

  el.list.addEventListener('input', event => {
    const input = event.target.closest('[data-name]');
    if (!input) return;
    const point = state.points.find(p => p.id === input.dataset.name);
    if (!point) return;
    point.name = sanitizeName(input.value) || DEFAULT_NAMES(state.points.indexOf(point));
    const tip = markers.get(point.id)?.getElement()?.querySelector('.pin-tip');
    if (tip) tip.textContent = point.name;
    clearTimeout(geoTimer);
    geoTimer = setTimeout(syncUrl, 400);
  });

  el.list.addEventListener('change', event => {
    const input = event.target.closest('[data-name]');
    if (!input) return;
    const point = state.points.find(p => p.id === input.dataset.name);
    if (point) input.value = point.name;
  });
}

function initSearchEvents() {
  el.searchForm.addEventListener('submit', event => {
    event.preventDefault();
    clearTimeout(suggestTimer);
    submitSearch();
  });

  el.searchInput.addEventListener('input', scheduleSuggest);
  el.searchInput.addEventListener('focus', () => {
    if (el.searchInput.value.trim()) scheduleSuggest();
  });

  el.searchInput.addEventListener('keydown', event => {
    if (event.isComposing || event.keyCode === 229) return; // 한글 조합 중에는 그대로 둔다
    if (event.key === 'Escape') {
      hideSearchResults();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const count = el.searchResults.querySelectorAll('[data-index]').length;
      if (!count) return;
      event.preventDefault();
      if (event.key === 'ArrowDown') highlightRow(activeIndex + 1 >= count ? 0 : activeIndex + 1);
      else highlightRow(activeIndex <= 0 ? count - 1 : activeIndex - 1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault(); // 폼 제출 대신 직접 처리 (조합 중 중복 방지)
      clearTimeout(suggestTimer);
      submitSearch();
    }
  });

  el.searchResults.addEventListener('click', event => {
    const more = event.target.closest('[data-remote]');
    if (more) {
      runSearch(more.dataset.remote || el.searchInput.value.trim());
      return;
    }
    const item = event.target.closest('[data-index]');
    if (!item) return;
    chooseSearchRow(Number(item.dataset.index));
  });

  document.addEventListener('click', event => {
    if (!el.searchForm.contains(event.target)) hideSearchResults();
  });
}

function initHeaderEvents() {
  el.fitBtn.addEventListener('click', () => fitAll());
  el.fitBtnMap.addEventListener('click', () => fitAll());
  el.shareBtn.addEventListener('click', copyLink);
  el.resetBtn.addEventListener('click', resetAll);
  el.styleBtn.addEventListener('click', () => {
    const next = state.mapType === 'hybrid' ? 'normal' : 'hybrid';
    applyMapType(next);
    toast(next === 'hybrid' ? '위성 지도' : '일반 지도');
  });
  el.zoomInBtn.addEventListener('click', () => zoomBy(1));
  el.zoomOutBtn.addEventListener('click', () => zoomBy(-1));

  document.addEventListener('keydown', event => {
    if (event.target.matches('input, textarea')) return;
    if (event.key === 'f' || event.key === 'F') fitAll();
    if (event.key === 'Escape') hideSearchResults();
  });

  window.addEventListener('popstate', () => {
    const parsed = parseShareState(location.href);
    if (parsed.present) loadPoints(parsed.points, parsed.mode, false, parsed.travelMode);
  });
}

/* ------------------------------------------------------------------
   초기 상태 불러오기
   ------------------------------------------------------------------ */
function loadPoints(points, mode, notify = true, travelMode = null) {
  state.points = points.map((p, i) => {
    seq += 1;
    return {
      id: `p${seq}`,
      lat: p.lat,
      lng: p.lng,
      name: p.name ? sanitizeName(p.name) : DEFAULT_NAMES(i),
      address: '',
      addressState: 'idle',
    };
  });
  if (mode) state.mode = mode;
  if (travelMode) {
    state.travelMode = travelModeOf(travelMode);
    el.modeToggle.querySelectorAll('[data-travel]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.travel === state.travelMode));
    });
    renderPresets();
  }
  state.points.forEach(point => requestAddress(point));
  render();
  fitAll(false);
  if (notify && state.points.length) toast(`공유된 ${state.points.length}곳을 불러왔어요`);
}

/* ------------------------------------------------------------------
   모바일 뷰포트 고정 — 페이지 확대/축소 차단
   (지도 핀치 줌은 네이버 지도 엔진이 직접 처리하므로 그대로 둔다)
   ------------------------------------------------------------------ */
function initViewportLock() {
  // iOS 사파리 전용 제스처 이벤트 — 페이지 자체의 핀치 확대를 막는다.
  const blockGesture = event => {
    if (event.cancelable) event.preventDefault();
  };
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(name => {
    document.addEventListener(name, blockGesture, { passive: false });
  });

  const insideMap = target => Boolean(el.map && target && el.map.contains(target));

  // 더블탭 확대 방지 — 지도(네이버 지도 더블탭 줌)와 입력·버튼은 건드리지 않는다.
  let lastTouchEnd = 0;
  document.addEventListener('touchend', event => {
    const now = Date.now();
    const doubleTap = now - lastTouchEnd <= 320;
    lastTouchEnd = now;
    if (!doubleTap || !event.cancelable || insideMap(event.target)) return;
    if (event.target.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
    event.preventDefault();
  }, { passive: false });

  // 두 손가락 확대 (사파리 밖 브라우저) — 지도 영역은 지도 엔진이 처리한다.
  document.addEventListener('touchmove', event => {
    if (event.touches.length > 1 && !insideMap(event.target) && event.cancelable) event.preventDefault();
  }, { passive: false });
}

/* ------------------------------------------------------------------
   시작
   ------------------------------------------------------------------ */
function boot() {
  initMap();
  initModeToggle();
  initPresets();
  initListEvents();
  initSearchEvents();
  initHeaderEvents();
  initSheet();
  initViewportLock();

  const parsed = parseShareState(location.href);
  if (parsed.present && parsed.points.length) {
    loadPoints(parsed.points, parsed.mode, true, parsed.travelMode);
    if (parsed.skipped) toast(`좌표 ${parsed.skipped}개는 형식이 맞지 않아 건너뛰었어요`, 3200);
  } else {
    render();
  }

  if (!isMobile() && map) {
    setTimeout(() => map.autoResize(), 120);
  }
}

boot();
