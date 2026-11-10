/* ==================================================================
   HD2Lab | Midpoint (PKPilot0002)
   app.js — 지도·참가자·결과 UI (Leaflet + 순수 로직 core.js)
   ================================================================== */

import {
  DEFAULT_NAMES,
  MAX_PARTICIPANTS,
  buildShareUrl,
  distanceStats,
  distancesKm,
  fairnessGrade,
  fairnessScore,
  formatKm,
  formatLatLng,
  haversineKm,
  lineMeta,
  midpoint,
  nearestStations,
  parseShareState,
  recommendMeetingSpot,
  sanitizeName,
  walkingMinutes,
} from './js/core.js';
import { LINES, STATIONS } from './js/stations.js';
import { LANDMARKS } from './js/landmarks.js';

/* ------------------------------------------------------------------
   상수
   ------------------------------------------------------------------ */
const PALETTE = [
  '#5ec8ff', '#7ddba3', '#ffd166', '#c792ea', '#ff8fab', '#9be8d8',
  '#f4a261', '#a0c4ff', '#e0e08a', '#ff9f9f', '#b8e986', '#d0bfff',
];

const PRESETS = [
  { label: '강남', name: '강남역' },
  { label: '홍대입구', name: '홍대입구역' },
  { label: '종로3가', name: '종로3가역' },
  { label: '신도림', name: '신도림역' },
  { label: '여의도', name: '여의도역' },
  { label: '잠실', name: '잠실역' },
  { label: '판교', name: '판교역' },
  { label: '광화문', name: '광화문역' },
];

const SEOUL_CENTER = { lat: 37.5665, lng: 126.978 };

const TILES = {
  // 외부 API 키가 필요 없는 OSM 표준 타일. 다크 테마는 CSS 필터로 톤을 바꾼다(style.css).
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  options: {
    maxZoom: 19,
    crossOrigin: true,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  },
};

const STATION_INDEX = new Map(STATIONS.map(row => [row[0], row]));

// 추천 후보: 지하철역 + 주요 랜드마크 (중심에서 가장 가까운 곳을 제안)
const SPOTS = [
  ...STATIONS.map(([name, lat, lng, lines]) => [name, lat, lng, lines, { kind: 'station' }]),
  ...LANDMARKS.map(([name, lat, lng, note]) => [name, lat, lng, [], { kind: 'landmark', note }]),
];

/* ------------------------------------------------------------------
   상태
   ------------------------------------------------------------------ */
let seq = 0;
const state = {
  points: [], // { id, lat, lng, name, address, addressState }
  mode: 'fair',
  activeId: null,
  style: 'dark',
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
  searchForm: document.getElementById('searchForm'),
  searchInput: document.getElementById('searchInput'),
  searchBtn: document.getElementById('searchBtn'),
  searchResults: document.getElementById('searchResults'),
  resetBtn: document.getElementById('resetBtn'),
  fitBtn: document.getElementById('fitBtn'),
  fitBtnMap: document.getElementById('fitBtnMap'),
  shareBtn: document.getElementById('shareBtn'),
  styleBtn: document.getElementById('styleBtn'),
  mapHint: document.getElementById('mapHint'),
  toast: document.getElementById('toast'),
};

let map = null;
let tileLayer = null;
let personLayer = null;
let overlayLayer = null;
const markers = new Map();
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
  map = L.map('map', {
    center: [SEOUL_CENTER.lat, SEOUL_CENTER.lng],
    zoom: 11,
    zoomControl: true,
    zoomSnap: 0.5,
    wheelPxPerZoomLevel: 90,
    minZoom: 6,
    maxZoom: 16,
    worldCopyJump: true,
  });
  map.zoomControl.setPosition('bottomright');

  applyTileStyle(state.style);

  personLayer = L.layerGroup().addTo(map);
  overlayLayer = L.layerGroup().addTo(map);

  map.on('click', event => {
    addPoint({ lat: event.latlng.lat, lng: event.latlng.lng, source: 'map' });
  });
}

function applyTileStyle(style) {
  state.style = style === 'light' ? 'light' : 'dark';
  document.body.dataset.mapstyle = state.style;
  el.styleBtn.setAttribute(
    'aria-label',
    state.style === 'dark' ? '지도 스타일: 다크 (누르면 라이트)' : '지도 스타일: 라이트 (누르면 다크)',
  );

  if (tileLayer) {
    tileLayer.setUrl(TILES.url);
    return;
  }
  tileLayer = L.tileLayer(TILES.url, TILES.options);
  let failures = 0;
  tileLayer.on('tileerror', () => {
    failures += 1;
    if (failures === 8) toast('지도 타일을 불러오지 못했어요 — 네트워크를 확인해 주세요', 3400);
  });
  tileLayer.addTo(map);
  tileLayer.bringToBack();
}

function fitAll(animate = true) {
  if (!state.points.length) {
    map.setView([SEOUL_CENTER.lat, SEOUL_CENTER.lng], 11, { animate });
    return;
  }
  if (state.points.length === 1) {
    map.setView([state.points[0].lat, state.points[0].lng], Math.max(map.getZoom(), 13), { animate });
    return;
  }
  const bounds = L.latLngBounds(state.points.map(p => [p.lat, p.lng]));
  const mobile = isMobile();
  const peek = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--peek-h')) || 200;
  const options = mobile
    ? { paddingTopLeft: [26, 70], paddingBottomRight: [26, peek + 26], maxZoom: 14, animate }
    : { paddingTopLeft: [56, 70], paddingBottomRight: [56, 70], maxZoom: 14, animate };
  map.fitBounds(bounds, options);
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
    personLayer.removeLayer(marker);
    markers.delete(id);
  }
  if (state.activeId === id) state.activeId = null;
  render();
}

function resetAll() {
  if (!state.points.length) return;
  state.points = [];
  markers.forEach(marker => personLayer.removeLayer(marker));
  markers.clear();
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
   검색 (Nominatim forward)
   ------------------------------------------------------------------ */
let searchResults = [];
let searchToken = 0;

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
    searchResults = data.map(item => ({
      name: item.name || (item.display_name || '').split(',')[0],
      address: item.display_name || '',
      lat: Number(item.lat),
      lng: Number(item.lon),
    })).filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng));
    renderSearchResults();
  } catch {
    if (token === searchToken) {
      searchResults = [];
      renderSearchResults('검색에 실패했어요. 잠시 후 다시 시도해 주세요.');
    }
  } finally {
    if (token === searchToken) el.searchBtn.disabled = false;
  }
}

function renderSearchResults(emptyText) {
  if (!el.searchInput.value.trim()) {
    hideSearchResults();
    return;
  }
  el.searchResults.hidden = false;
  if (!searchResults.length) {
    el.searchResults.innerHTML = `<li class="res-empty">${esc(emptyText || '검색 결과가 없어요. 지도에서 직접 찍어 보세요.')}</li>`;
    return;
  }
  el.searchResults.innerHTML = searchResults.map((item, i) => `
    <li role="option" tabindex="-1" data-result="${i}">
      <svg class="ic" viewBox="0 0 24 24" aria-hidden="true" style="color:var(--accent);margin-top:2px"><use href="#i-pin"/></svg>
      <span><span class="res-name">${esc(item.name)}</span><span class="res-addr">${esc(item.address)}</span></span>
    </li>`).join('');
}

function hideSearchResults() {
  el.searchResults.hidden = true;
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
  const rec = recommendMeetingSpot(points, SPOTS, { mode: state.mode, stations: STATIONS });
  return { center, distances, stats, fairness, rec };
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

function isLightColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 156;
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

  const stationFallback = !primary && rec ? nearestStations(rec.center, SPOTS, 1, Infinity)[0] : null;
  const station = primary || stationFallback;

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
    <div class="card station-card">
      <div class="station-top">
        <span class="station-kicker"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-train"/></svg>${primary ? (station.kind === 'landmark' ? '추천 만남 장소' : '추천 만남 거점') : '가장 가까운 곳'}</span>
        <span class="station-dist">중심에서 ${formatKm(primary ? primary.km : station.km)}</span>
      </div>
      <div class="station-name">${esc(station.name)} ${lineBadges(station.lines)}${station.kind === 'landmark' && station.note ? `<em>${esc(station.note)}</em>` : ''}</div>
      <div class="station-actions">
        <div class="station-meta">
          <span>도보 <b>${walkingMinutes(primary ? primary.km : station.km)}분</b></span>
          <span>가장 먼 참가자 <b>${formatKm(stats.max)}</b></span>
        </div>
        <button class="mini-btn" type="button" data-focus-lat="${station.lat}" data-focus-lng="${station.lng}">
          <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-target"/></svg>지도에서
        </button>
      </div>
    </div>` : `
    <div class="card station-card">
      <div class="station-top">
        <span class="station-kicker"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-train"/></svg>추천 만남 거점</span>
      </div>
      <div class="station-name" style="font-size:15px">주변에 지하철역이 없어요</div>
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

    ${alternative ? `
      <div class="alt-station">
        <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-train"/></svg>
        <span>더 공평한 역 <b>${esc(alternative.name)}</b> · 가장 먼 참가자 ${kmHtml(alternative.maxKm)}</span>
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
  const focusSpot = el.result.querySelector('[data-focus-lat]');
  if (focusSpot) {
    focusSpot.addEventListener('click', () => {
      const lat = Number(focusSpot.dataset.focusLat);
      const lng = Number(focusSpot.dataset.focusLng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        map.setView([lat, lng], 15, { animate: true });
        if (isMobile()) setSheet('peek');
      }
    });
  }
}

/* ------------------------------------------------------------------
   렌더 — 지도
   ------------------------------------------------------------------ */
function syncMarkers(result) {
  const live = new Set(state.points.map(p => p.id));
  for (const [id, marker] of markers) {
    if (!live.has(id)) {
      personLayer.removeLayer(marker);
      markers.delete(id);
    }
  }

  state.points.forEach((point, i) => {
    const color = PALETTE[i % PALETTE.length];
    let marker = markers.get(point.id);
    if (!marker) {
      const icon = L.divIcon({
        className: 'pin-wrap',
        html: `<span class="pin-person" style="--c:${color}"><span>${i + 1}</span><span class="pin-tail"></span></span>`,
        iconSize: [30, 36],
        iconAnchor: [15, 30],
      });
      marker = L.marker([point.lat, point.lng], { icon, draggable: true, riseOnHover: true });
      marker.on('drag', () => {
        const latlng = marker.getLatLng();
        point.lat = latlng.lat;
        point.lng = latlng.lng;
        updateOverlaysOnly();
        scheduleLightResult();
      });
      marker.on('dragend', () => {
        point.address = '';
        point.addressState = 'idle';
        requestAddress(point);
        render();
      });
      marker.on('click', () => {
        state.activeId = point.id;
        scheduleRender();
      });
      marker.addTo(personLayer);
      markers.set(point.id, marker);
    } else {
      marker.setLatLng([point.lat, point.lng]);
      const dot = marker.getElement()?.querySelector('.pin-person');
      if (dot) {
        dot.style.setProperty('--c', color);
        const num = dot.querySelector('span');
        if (num) num.textContent = String(i + 1);
      }
    }
    marker.unbindTooltip();
    marker.bindTooltip(point.name, {
      permanent: true,
      direction: 'bottom',
      offset: [0, 6],
      className: 'pin-tip',
    });
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
  overlayLayer.clearLayers();
  if (!result || state.points.length === 0) return;

  if (state.points.length >= 2) {
    const { center } = result;
    const mean = result.stats?.mean || 0;
    if (mean > 0.05) {
      L.circle([center.lat, center.lng], {
        radius: Math.max(mean * 1000, 60),
        color: '#ff824f',
        weight: 1,
        opacity: 0.22,
        fillColor: '#ff824f',
        fillOpacity: 0.035,
        dashArray: '2 8',
        interactive: false,
      }).addTo(overlayLayer);
    }

    state.points.forEach((point, i) => {
      L.polyline([[point.lat, point.lng], [center.lat, center.lng]], {
        color: '#ff824f',
        weight: 1.5,
        opacity: 0.5,
        dashArray: '5 7',
        interactive: false,
      }).addTo(overlayLayer);

      const t = 0.55;
      const lat = point.lat + (center.lat - point.lat) * t;
      const lng = point.lng + (center.lng - point.lng) * t;
      const d = result.distances[i];
      if (Number.isFinite(d) && d > 0.05) {
        L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'label-wrap',
            html: `<span class="pin-label">${formatKm(d)}</span>`,
            iconSize: [1, 1],
            iconAnchor: [0, 0],
          }),
          interactive: false,
          keyboard: false,
        }).addTo(overlayLayer);
      }
    });

    L.marker([center.lat, center.lng], {
      icon: L.divIcon({
        className: 'mid-wrap',
        html: '<span class="pin-mid"><span class="pulse"></span><span class="pulse"></span><span class="core"></span></span>',
        iconSize: [52, 52],
        iconAnchor: [26, 26],
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: 800,
    }).addTo(overlayLayer);
  }

  const station = result.rec?.primary;
  if (station) {
    L.marker([station.lat, station.lng], {
      icon: L.divIcon({
        className: 'station-wrap',
        html: `<span class="pin-station"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-train"/></svg>${esc(station.name)}</span>`,
        iconSize: [10, 10],
        iconAnchor: [5, 26],
      }),
      zIndexOffset: 600,
      keyboard: false,
    })
      .bindPopup(`<strong>${esc(station.name)}</strong><br/>중심에서 ${formatKm(station.km)} · 도보 ${walkingMinutes(station.km)}분`)
      .addTo(overlayLayer);
  }
}

/* ------------------------------------------------------------------
   렌더 — 공통
   ------------------------------------------------------------------ */
function render() {
  const result = computeResult();
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
      ? buildShareUrl(location.href, state.points, state.mode)
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
  el.presets.innerHTML = PRESETS.map(preset => {
    const row = STATION_INDEX.get(preset.name);
    const landmark = LANDMARKS.find(l => l[0] === preset.name);
    const lat = row ? row[1] : landmark?.[1];
    const lng = row ? row[2] : landmark?.[2];
    return `<button class="chip" type="button" data-preset="${esc(preset.name)}" data-lat="${lat}" data-lng="${lng}">${esc(preset.label)}</button>`;
  }).join('');

  el.presets.addEventListener('click', event => {
    const chip = event.target.closest('[data-preset]');
    if (!chip) return;
    const lat = Number(chip.dataset.lat);
    const lng = Number(chip.dataset.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast('위치를 찾지 못했어요');
      return;
    }
    const name = chip.dataset.preset.replace(/역$/, '');
    const point = addPoint({ lat, lng, name, source: 'preset' });
    if (point) toast(`${name} 추가`);
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
      if (point && map) map.panTo([point.lat, point.lng], { animate: true });
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
    const marker = markers.get(point.id);
    if (marker) {
      marker.unbindTooltip();
      marker.bindTooltip(point.name, { permanent: true, direction: 'bottom', offset: [0, 6], className: 'pin-tip' });
    }
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
    hideSearchResults();
    runSearch(el.searchInput.value);
  });

  el.searchInput.addEventListener('input', () => {
    if (!el.searchInput.value.trim()) hideSearchResults();
  });

  el.searchInput.addEventListener('keydown', event => {
    if (event.key === 'Escape') hideSearchResults();
  });

  el.searchResults.addEventListener('click', event => {
    const item = event.target.closest('[data-result]');
    if (!item) return;
    const result = searchResults[Number(item.dataset.result)];
    if (!result) return;
    const point = addPoint({
      lat: result.lat,
      lng: result.lng,
      name: result.name,
      address: result.address.split(',').slice(0, 3).join(' ').trim(),
      source: 'search',
    });
    if (point) {
      el.searchInput.value = '';
      hideSearchResults();
    }
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
    applyTileStyle(state.style === 'dark' ? 'light' : 'dark');
    toast(state.style === 'dark' ? '다크 지도' : '라이트 지도');
  });

  document.addEventListener('keydown', event => {
    if (event.target.matches('input, textarea')) return;
    if (event.key === 'f' || event.key === 'F') fitAll();
    if (event.key === 'Escape') hideSearchResults();
  });

  window.addEventListener('popstate', () => {
    const parsed = parseShareState(location.href);
    if (parsed.present) loadPoints(parsed.points, parsed.mode, false);
  });
}

/* ------------------------------------------------------------------
   초기 상태 불러오기
   ------------------------------------------------------------------ */
function loadPoints(points, mode, notify = true) {
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
  state.points.forEach(point => requestAddress(point));
  render();
  fitAll(false);
  if (notify && state.points.length) toast(`공유된 ${state.points.length}곳을 불러왔어요`);
}

/* ------------------------------------------------------------------
   시작
   ------------------------------------------------------------------ */
function boot() {
  initMap();
  initPresets();
  initListEvents();
  initSearchEvents();
  initHeaderEvents();
  initSheet();

  const parsed = parseShareState(location.href);
  if (parsed.present && parsed.points.length) {
    loadPoints(parsed.points, parsed.mode, true);
    if (parsed.skipped) toast(`좌표 ${parsed.skipped}개는 형식이 맞지 않아 건너뛰었어요`, 3200);
  } else {
    render();
  }

  if (!isMobile()) {
    setTimeout(() => map.invalidateSize(), 120);
  }
}

boot();
