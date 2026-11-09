/**
 * PKPilot0001 · HD2Lab | Photos
 * js/store.js — 사진 라이브러리 상태 · 로컬 영속화 · 검색/그룹핑 유틸리티
 *
 * DOM에 의존하지 않으므로 Node.js 단위 테스트에서 그대로 import 할 수 있습니다.
 * 저장소(localStorage)는 주입 가능하며, 실패 시 안전하게 롤백합니다.
 */

import {
  ALBUMS,
  DEFAULT_FILTER,
  FILTER_PRESETS,
  PHOTOS,
  RECENT_WINDOW_DAYS,
  getFilterPreset,
  photoArtwork,
  photoSearchIndex,
} from './mockData.js';

export const STORAGE_KEY = 'pkpilot0001:library:v1';
export const SCHEMA_VERSION = 1;
export const MAX_UPLOADS = 12;

export class StorageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StorageError';
    this.code = 'STORAGE_WRITE_FAILED';
  }
}

/* ------------------------------------------------------------------ *
 * 저장소 어댑터
 * ------------------------------------------------------------------ */
export function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    /** 테스트용 스냅샷 */
    snapshot() {
      return Object.fromEntries(map.entries());
    },
  };
}

export function createNullStorage() {
  return {
    getItem() {
      return null;
    },
    setItem() {
      // 저장 불가 환경(사생활 보호 모드 등)에서는 조용히 무시합니다.
    },
    removeItem() {},
  };
}

/* ------------------------------------------------------------------ *
 * 날짜 유틸 — ISO 문자열의 로컬 날짜/시간 부분을 그대로 사용합니다.
 * ------------------------------------------------------------------ */
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function localParts(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(iso || ''));
  if (!match) {
    const fallback = new Date(iso);
    if (Number.isNaN(fallback.getTime())) return null;
    return {
      year: fallback.getFullYear(),
      month: fallback.getMonth() + 1,
      day: fallback.getDate(),
      hour: fallback.getHours(),
      minute: fallback.getMinutes(),
    };
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
}

export function weekdayOf(iso) {
  const parts = localParts(iso);
  if (!parts) return '';
  const stamp = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return WEEKDAYS[stamp.getUTCDay()];
}

export function formatKoreanDate(iso) {
  const parts = localParts(iso);
  if (!parts) return '날짜 미상';
  return `${parts.year}년 ${parts.month}월 ${parts.day}일 (${weekdayOf(iso)})`;
}

export function formatKoreanTime(iso) {
  const parts = localParts(iso);
  if (!parts) return '';
  const meridiem = parts.hour < 12 ? '오전' : '오후';
  const hour12 = parts.hour % 12 === 0 ? 12 : parts.hour % 12;
  return `${meridiem} ${hour12}:${String(parts.minute).padStart(2, '0')}`;
}

export function formatStamp(iso) {
  return `${formatKoreanDate(iso)} ${formatKoreanTime(iso)}`;
}

export function toLocalIso(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const offsetHours = pad(Math.floor(Math.abs(offsetMinutes) / 60));
  const offsetMins = pad(Math.abs(offsetMinutes) % 60);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${offsetHours}:${offsetMins}`
  );
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ *
 * 검색 · 그룹핑 (순수 함수)
 * ------------------------------------------------------------------ */
export function searchPhotos(items, query, { scope = 'all' } = {}) {
  const term = String(query || '').trim().toLowerCase();
  if (!term) return [...items];
  const tokens = term.split(/\s+/).filter(Boolean);

  const fieldOf = (item) => {
    switch (scope) {
      case 'place':
        return `${item.place || ''} ${item.region || ''}`.toLowerCase();
      case 'tag':
        return (item.tags || []).join(' ').toLowerCase();
      case 'camera':
        return `${item.camera || ''} ${item.cameraModel || ''} ${item.lens || ''}`.toLowerCase();
      case 'date': {
        const parts = localParts(item.takenAt);
        if (!parts) return '';
        return `${parts.year} ${parts.month} ${parts.day} ${parts.year}년 ${parts.month}월 ${parts.day}일`.toLowerCase();
      }
      default:
        return photoSearchIndex(item);
    }
  };

  return items.filter((item) => {
    const haystack = fieldOf(item);
    return tokens.every((token) => haystack.includes(token));
  });
}

const GROUP_LABEL = {
  year: (parts) => `${parts.year}년`,
  month: (parts) => `${parts.year}년 ${parts.month}월`,
  day: (parts) => `${parts.month}월 ${parts.day}일 ${weekdayOfText(parts)}`.trim(),
};

function weekdayOfText(parts) {
  const stamp = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return `${WEEKDAYS[stamp.getUTCDay()]}요일`;
}

export function groupPhotos(items, mode = 'month') {
  if (mode === 'all') {
    return [{ key: 'all', label: '', hint: 'ALL PHOTOS', photos: [...items] }];
  }
  const groups = new Map();
  items.forEach((item) => {
    const parts = localParts(item.takenAt) || { year: 0, month: 0, day: 0 };
    const key =
      mode === 'year'
        ? String(parts.year)
        : mode === 'day'
          ? `${parts.year}-${parts.month}-${parts.day}`
          : `${parts.year}-${parts.month}`;
    if (!groups.has(key)) {
      const label =
        mode === 'year'
          ? GROUP_LABEL.year(parts)
          : mode === 'day'
            ? GROUP_LABEL.day(parts)
            : GROUP_LABEL.month(parts);
      groups.set(key, { key, label, hint: mode.toUpperCase(), photos: [] });
    }
    groups.get(key).photos.push(item);
  });
  return [...groups.values()];
}

/* ------------------------------------------------------------------ *
 * 스토어
 * ------------------------------------------------------------------ */
function normalizePhoto(record, now) {
  const stamp = record.takenAt && localParts(record.takenAt) ? record.takenAt : toLocalIso(new Date(now));
  return {
    id: record.id,
    title: record.title || '제목 없음',
    caption: record.caption || '',
    fileName: record.fileName || `${record.id}.jpg`,
    takenAt: stamp,
    place: record.place || '위치 미확인',
    region: record.region || '기기',
    lat: typeof record.lat === 'number' ? record.lat : null,
    lng: typeof record.lng === 'number' ? record.lng : null,
    camera: record.camera || '기기 업로드',
    cameraModel: record.cameraModel || '',
    lens: record.lens || '—',
    focal: record.focal || '—',
    aperture: record.aperture || '—',
    shutter: record.shutter || '—',
    iso: record.iso ?? '—',
    exposure: record.exposure || '0 EV',
    wb: record.wb || '자동',
    sizeLabel: record.sizeLabel || `${Math.max(1, Math.round((record.src || '').length / 1024))} KB`,
    tags: Array.isArray(record.tags) && record.tags.length ? record.tags : ['업로드'],
    albums: Array.isArray(record.albums) ? record.albums : ['recent'],
    favorite: Boolean(record.favorite),
    secret: Boolean(record.secret),
    uploaded: true,
    source: '기기 업로드',
    width: record.width || 1400,
    height: record.height || 1050,
    src: record.src,
    thumb: record.thumb || record.src,
    art: record.art || { scene: 'portrait', palette: ['#22252a', '#4b525c', '#ff824f', '#14161a'], seed: 7 },
    createdAt: now,
  };
}

export function createStore({
  seedPhotos = PHOTOS,
  storage = createNullStorage(),
  now = () => Date.now(),
  key = STORAGE_KEY,
  maxUploads = MAX_UPLOADS,
} = {}) {
  let lastError = null;

  const seedFavorites = seedPhotos.filter((item) => item.favorite).map((item) => item.id);

  const state = {
    version: SCHEMA_VERSION,
    favorites: [...seedFavorites],
    filters: {},
    edits: {},
    deleted: [],
    uploads: [],
  };

  /** 저장된 스키마를 안전하게 읽어옵니다. 손상된 값은 버리고 새로 시작합니다. */
  function hydrate() {
    let raw = null;
    try {
      raw = storage.getItem(key);
    } catch (error) {
      lastError = error;
      return;
    }
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      if (parsed.version !== SCHEMA_VERSION) return;
      if (Array.isArray(parsed.favorites)) {
        state.favorites = parsed.favorites.filter((id) => typeof id === 'string');
      }
      if (parsed.filters && typeof parsed.filters === 'object') {
        Object.entries(parsed.filters).forEach(([photoId, presetId]) => {
          if (FILTER_PRESETS.some((preset) => preset.id === presetId)) {
            state.filters[photoId] = presetId;
          }
        });
      }
      if (parsed.edits && typeof parsed.edits === 'object') {
        Object.entries(parsed.edits).forEach(([photoId, patch]) => {
          if (patch && typeof patch === 'object') state.edits[photoId] = { ...patch };
        });
      }
      if (Array.isArray(parsed.deleted)) {
        state.deleted = parsed.deleted.filter((id) => typeof id === 'string');
      }
      if (Array.isArray(parsed.uploads)) {
        state.uploads = parsed.uploads
          .filter((item) => item && typeof item.id === 'string' && typeof item.src === 'string')
          .map((item) => normalizePhoto(item, now()));
      }
    } catch (error) {
      lastError = error;
      // 손상된 스토리지는 초기 상태로 대체합니다.
    }
  }

  function serialize() {
    return JSON.stringify({
      version: SCHEMA_VERSION,
      favorites: state.favorites,
      filters: state.filters,
      edits: state.edits,
      deleted: state.deleted,
      uploads: state.uploads,
    });
  }

  function persist() {
    try {
      storage.setItem(key, serialize());
      lastError = null;
      return true;
    } catch (error) {
      lastError = error;
      return false;
    }
  }

  hydrate();

  function allPhotos() {
    const seen = new Set();
    const merged = [];
    const push = (item) => {
      if (!item || seen.has(item.id)) return;
      seen.add(item.id);
      merged.push(item);
    };
    state.uploads.forEach(push);
    seedPhotos.forEach((item) => {
      if (!state.deleted.includes(item.id)) push(item);
    });
    return merged
      .map((item) => ({
        ...item,
        ...(state.edits[item.id] || {}),
        favorite: state.favorites.includes(item.id),
        filter: state.filters[item.id] || DEFAULT_FILTER,
        artwork: photoArtwork(item),
        uploaded: Boolean(item.uploaded),
      }))
      .sort((a, b) => new Date(b.takenAt) - new Date(a.takenAt));
  }

  function visiblePhotos({ member = false } = {}) {
    return allPhotos().filter((item) => member || !item.secret);
  }

  function getPhoto(id, { member = true } = {}) {
    const found = allPhotos().find((item) => item.id === id);
    if (!found) return null;
    if (found.secret && !member) return null;
    return found;
  }

  function newestStamp() {
    const list = allPhotos();
    return list.length ? new Date(list[0].takenAt).getTime() : now();
  }

  function albumPhotos(albumId, { member = false } = {}) {
    const album = ALBUMS.find((entry) => entry.id === albumId);
    if (!album) return [];
    if (album.kind === 'secret' && !member) return [];
    const list = allPhotos();
    switch (album.kind) {
      case 'smart':
        return list.filter((item) => item.favorite);
      case 'recent': {
        const cutoff = newestStamp() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
        return list.filter((item) => !item.secret && new Date(item.takenAt).getTime() >= cutoff);
      }
      case 'secret':
        return list.filter((item) => item.secret);
      default:
        return list.filter((item) => !item.secret && item.albums.includes(albumId));
    }
  }

  function albumCounts({ member = false } = {}) {
    const counts = {};
    ALBUMS.forEach((album) => {
      counts[album.id] = albumPhotos(album.id, { member }).length;
    });
    return counts;
  }

  function toggleFavorite(id) {
    const index = state.favorites.indexOf(id);
    const previous = state.favorites.slice();
    if (index >= 0) {
      state.favorites.splice(index, 1);
    } else {
      state.favorites.push(id);
    }
    if (!persist()) {
      state.favorites = previous;
      return null;
    }
    return state.favorites.includes(id);
  }

  function setFilter(id, presetId) {
    if (!FILTER_PRESETS.some((preset) => preset.id === presetId)) return false;
    const preset = getFilterPreset(presetId);
    const previous = state.filters[id];
    if (preset.id === DEFAULT_FILTER) {
      delete state.filters[id];
    } else {
      state.filters[id] = preset.id;
    }
    if (!persist()) {
      if (previous === undefined) delete state.filters[id];
      else state.filters[id] = previous;
      return false;
    }
    return true;
  }

  function addUpload(record) {
    if (state.uploads.length >= maxUploads) {
      const error = new Error('UPLOAD_LIMIT');
      error.code = 'UPLOAD_LIMIT';
      throw error;
    }
    if (!record || typeof record.src !== 'string' || !record.src.startsWith('data:image/')) {
      const error = new Error('INVALID_UPLOAD');
      error.code = 'INVALID_UPLOAD';
      throw error;
    }
    const id = record.id || `up-${now()}-${Math.random().toString(36).slice(2, 8)}`;
    const photo = normalizePhoto({ ...record, id }, now());
    state.uploads.push(photo);
    if (!persist()) {
      state.uploads = state.uploads.filter((item) => item.id !== id);
      throw new StorageError('저장 공간이 부족해 사진을 추가하지 못했습니다.');
    }
    return photo;
  }

  function updatePhotoDetails(id, patch = {}) {
    if (!getPhoto(id, { member: true })) return false;
    if (!patch || typeof patch !== 'object') return false;
    const clean = {};
    if (typeof patch.title === 'string') {
      const title = patch.title.trim();
      if (title) clean.title = title.slice(0, 80);
    }
    if (typeof patch.caption === 'string') clean.caption = patch.caption.trim().slice(0, 280);
    if (typeof patch.place === 'string') {
      const place = patch.place.trim();
      if (place) clean.place = place.slice(0, 90);
    }
    if (Array.isArray(patch.tags)) {
      clean.tags = [...new Set(patch.tags.map((tag) => String(tag).trim().replace(/^#/, '')).filter(Boolean))]
        .slice(0, 12);
    }
    if (Array.isArray(patch.albums)) {
      const valid = [...new Set(patch.albums.filter((albumId) => ALBUMS.some((album) => album.id === albumId)))];
      const editable = valid.filter((albumId) => {
        const album = ALBUMS.find((entry) => entry.id === albumId);
        return album && album.kind !== 'smart' && album.kind !== 'recent' && album.kind !== 'secret';
      });
      clean.albums = editable;
    }
    if (!Object.keys(clean).length) return false;

    const previous = state.edits[id] ? { ...state.edits[id] } : null;
    state.edits[id] = { ...(state.edits[id] || {}), ...clean };
    if (!persist()) {
      if (previous) state.edits[id] = previous;
      else delete state.edits[id];
      return false;
    }
    return true;
  }

  function deletePhoto(id) {
    const seedIndex = seedPhotos.findIndex((item) => item.id === id);
    const uploadIndex = state.uploads.findIndex((item) => item.id === id);
    if (seedIndex < 0 && uploadIndex < 0) return null;

    const previousFavorites = state.favorites.slice();
    const previousFilters = { ...state.filters };
    let snapshot;

    if (uploadIndex >= 0) {
      const [removed] = state.uploads.splice(uploadIndex, 1);
      snapshot = { kind: 'upload', photo: removed, index: uploadIndex };
    } else {
      const photo = seedPhotos[seedIndex];
      state.deleted.push(id);
      snapshot = { kind: 'seed', photo, index: state.deleted.length - 1 };
    }
    state.favorites = state.favorites.filter((favoriteId) => favoriteId !== id);
    delete state.filters[id];

    if (!persist()) {
      if (uploadIndex >= 0) state.uploads.splice(uploadIndex, 0, snapshot.photo);
      if (snapshot.kind === 'seed') state.deleted.pop();
      state.favorites = previousFavorites;
      state.filters = previousFilters;
      return null;
    }
    return snapshot;
  }

  function reset() {
    state.favorites = [...seedFavorites];
    state.filters = {};
    state.edits = {};
    state.deleted = [];
    state.uploads = [];
    return persist();
  }

  function restorePhoto(snapshot) {
    if (!snapshot) return false;
    if (snapshot.kind === 'upload') {
      state.uploads.splice(snapshot.index, 0, snapshot.photo);
    } else {
      const position = state.deleted.indexOf(snapshot.photo.id);
      if (position >= 0) state.deleted.splice(position, 1);
    }
    if (!persist()) return false;
    return true;
  }

  function search(query, { member = false, scope = 'all' } = {}) {
    return searchPhotos(visiblePhotos({ member }), query, { scope });
  }

  function stats({ member = false } = {}) {
    const list = visiblePhotos({ member });
    const favorites = list.filter((item) => item.favorite).length;
    const uploads = list.filter((item) => item.uploaded).length;
    const secret = allPhotos().filter((item) => item.secret).length;
    const places = new Set(list.map((item) => item.place));
    return {
      total: list.length,
      favorites,
      uploads,
      secret,
      places: places.size,
      filtered: Object.values(state.filters).filter((preset) => preset !== DEFAULT_FILTER).length,
      storageBytes: serialize().length * 2,
    };
  }

  function mostRecentStamp() {
    return allPhotos().length ? allPhotos()[allPhotos().length - 1].takenAt : null;
  }

  return {
    // 조회
    allPhotos,
    photos: visiblePhotos,
    getPhoto,
    albumPhotos,
    albumCounts,
    search,
    stats,
    mostRecentStamp,
    // 변경
    toggleFavorite,
    setFilter,
    updatePhotoDetails,
    addUpload,
    deletePhoto,
    restorePhoto,
    reset,
    // 진단
    get lastError() {
      return lastError;
    },
    get rawState() {
      return {
        favorites: [...state.favorites],
        filters: { ...state.filters },
        edits: { ...state.edits },
        deleted: [...state.deleted],
        uploads: state.uploads.map((item) => item.id),
      };
    },
  };
}
