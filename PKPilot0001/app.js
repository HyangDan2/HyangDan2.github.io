/**
 * PKPilot0001 · HD2Lab | Photos
 * app.js — 화면 렌더링 · 라우팅 · 인증 모달 · 업로드 · 토스트
 */

import { ALBUMS, SEARCH_SCOPES, getFilterPreset } from './js/mockData.js';
import {
  createMemoryStorage,
  createStore,
  formatBytes,
  formatKoreanDate,
  groupPhotos,
  localParts,
  searchPhotos,
  toLocalIso,
} from './js/store.js';
import { MEMBER_PROFILE, createAuth } from './js/auth.js';
import { createViewer } from './js/viewer.js';

/* ------------------------------------------------------------------ *
 * 기본 설정 · 저장소
 * ------------------------------------------------------------------ */
const THEME_KEY = 'pkpilot0001:theme';

function safeLocalStorage() {
  try {
    const probe = '__pkpilot_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

const local = safeLocalStorage();
const fallbackStorage = createMemoryStorage();
const storage = local || fallbackStorage;

const store = createStore({ storage });
const auth = createAuth({ storage });

const viewRoot = document.querySelector('#viewRoot');
const header = document.querySelector('#appHeader');
const memberChip = document.querySelector('#memberChip');
const memberChipLabel = document.querySelector('#memberChipLabel');
const themeBtn = document.querySelector('#themeBtn');
const tabbar = document.querySelector('.tabbar');
const modalRoot = document.querySelector('#modalRoot');
const toastStack = document.querySelector('#toastStack');
const dropOverlay = document.querySelector('#dropOverlay');
const fileInput = document.querySelector('#fileInput');

const ui = {
  view: 'library',
  albumId: null,
  groupMode: 'month',
  query: '',
  scope: 'all',
};

let currentList = [];
let pendingAuth = null;

/* ------------------------------------------------------------------ *
 * 유틸
 * ------------------------------------------------------------------ */
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function icon(name, className = '') {
  return `<svg class="ic ${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
}

const FEATURE_LABEL = {
  upload: '사진 업로드',
  edit: '메타데이터 · 태그 편집',
  filter: '필터 · 보정',
  secret: '비밀 앨범 열람',
  delete: '사진 삭제',
  download: '고해상도 원본 다운로드',
  membership: '멤버십 센터',
};

function albumById(id) {
  return ALBUMS.find((album) => album.id === id) || null;
}

function memberState() {
  return auth.isMember();
}

/* ------------------------------------------------------------------ *
 * 토스트
 * ------------------------------------------------------------------ */
function toast(message, { actionLabel, onAction, duration, tone = 'default' } = {}) {
  const lifetime = duration ?? (actionLabel ? 6500 : 3400);
  const node = document.createElement('div');
  node.className = `toast toast-${tone}`;
  node.innerHTML = `
    <span class="toast-mark" aria-hidden="true">${tone === 'success' ? icon('check') : icon('sparkles')}</span>
    <p class="toast-text">${escapeHtml(message)}</p>
    ${actionLabel ? `<button class="toast-action" type="button">${escapeHtml(actionLabel)}</button>` : ''}
  `;
  toastStack.appendChild(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));

  const dismiss = () => {
    node.classList.remove('is-visible');
    setTimeout(() => node.remove(), 260);
  };
  const timer = setTimeout(dismiss, lifetime);
  if (actionLabel) {
    node.querySelector('.toast-action').addEventListener('click', () => {
      clearTimeout(timer);
      dismiss();
      onAction?.();
    });
  }
  while (toastStack.children.length > 3) {
    toastStack.firstElementChild.remove();
  }
}

/* ------------------------------------------------------------------ *
 * 테마
 * ------------------------------------------------------------------ */
function applyTheme(theme, { persist = true } = {}) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  if (persist) {
    try {
      storage.setItem(THEME_KEY, next);
    } catch {
      /* noop */
    }
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', next === 'light' ? '#f2f2f7' : '#101110');
  themeBtn.innerHTML = icon(next === 'light' ? 'moon' : 'sun');
  themeBtn.setAttribute('aria-label', next === 'light' ? '다크 모드로 전환' : '라이트 모드로 전환');
}

/* ------------------------------------------------------------------ *
 * 렌더링 — 공통 조각
 * ------------------------------------------------------------------ */
function photoTile(item, { showMeta = false } = {}) {
  const filterCss = getFilterPreset(item.filter).css;
  return `
    <button class="tile" type="button" data-photo="${escapeHtml(item.id)}"
      aria-label="${escapeHtml(item.title)} · ${escapeHtml(item.place)} · ${escapeHtml(formatKoreanDate(item.takenAt))}">
      <span class="tile-art" style="background-image:url(&quot;${item.artwork}&quot;)"></span>
      <img class="tile-img" src="${item.thumb}" alt="" loading="lazy" decoding="async"
        data-artwork="${escapeHtml(item.artwork)}" style="filter:${filterCss}" />
      <span class="tile-vignette" aria-hidden="true"></span>
      ${item.favorite ? `<span class="tile-mark fav" aria-hidden="true">${icon('heart-filled')}</span>` : ''}
      ${item.secret ? `<span class="tile-mark lock" aria-hidden="true">${icon('lock')}</span>` : ''}
      ${showMeta ? `<span class="tile-meta"><strong>${escapeHtml(item.title)}</strong><em>${escapeHtml(item.place)}</em></span>` : ''}
    </button>
  `;
}

function photoGrid(items, options) {
  if (!items.length) return '';
  return `<div class="photo-grid">${items.map((item) => photoTile(item, options)).join('')}</div>`;
}

function groupedGallery(items) {
  const groups = groupPhotos(items, ui.groupMode);
  return groups
    .map((group) => {
      if (!group.photos.length) return '';
      return `
        <section class="photo-group">
          ${group.label ? `<header class="group-head">
            <h2>${escapeHtml(group.label)}</h2>
            <span>${group.photos.length}장</span>
          </header>` : ''}
          ${photoGrid(group.photos)}
        </section>`;
    })
    .join('');
}

function libraryRange(items) {
  if (!items.length) return '사진 없음';
  const years = [...new Set(items.map((item) => new Date(item.takenAt).getFullYear()))].sort();
  return years.length > 1 ? `${years[0]}년 – ${years[years.length - 1]}년` : `${years[0]}년`;
}

function memberBanner() {
  if (memberState()) {
    const hours = Math.max(0, Math.floor(auth.remainingMs() / 3600000));
    const minutes = Math.max(0, Math.floor((auth.remainingMs() % 3600000) / 60000));
    return `
      <div class="member-banner is-member">
        <span class="banner-badge">${icon('check')}</span>
        <div class="banner-copy">
          <p class="banner-eyebrow">HD2LAB MEMBER SESSION</p>
          <p class="banner-title">정회원 모드가 활성화되어 있습니다</p>
          <p class="banner-note">모든 잠금 기능 사용 가능 · 세션 ${hours}시간 ${minutes}분 남음</p>
        </div>
        <button class="btn ghost small" type="button" data-action="membership">멤버십 센터</button>
      </div>`;
  }
  return `
    <div class="member-banner is-guest">
      <span class="banner-badge">${icon('lock')}</span>
      <div class="banner-copy">
        <p class="banner-eyebrow">GUEST MODE</p>
        <p class="banner-title">지금은 게스트로 둘러보는 중입니다</p>
        <p class="banner-note">사진 열람과 EXIF 확인은 자유롭게 · 업로드 · 보정 · 비밀 앨범은 정회원 전용</p>
      </div>
      <button class="btn primary small" type="button" data-action="signin">정회원 인증</button>
    </div>`;
}

/* ------------------------------------------------------------------ *
 * 렌더링 — 화면
 * ------------------------------------------------------------------ */
function renderLibrary() {
  const member = memberState();
  const photos = store.photos({ member });
  currentList = photos;
  const stats = store.stats({ member });

  if (!photos.length) {
    return `
      <section class="view view-library" aria-labelledby="libraryTitle">
        <div class="view-head">
          <div>
            <p class="view-eyebrow">LIBRARY · 보관함</p>
            <h1 class="large-title" id="libraryTitle">보관함</h1>
          </div>
        </div>
        <div class="empty-state">
          <span class="empty-glyph">${icon('photo')}</span>
          <h2>사진이 없습니다</h2>
          <p>정회원으로 인증하고 기기의 사진을 추가해 보세요.</p>
          <button class="btn primary" type="button" data-action="signin">정회원 인증</button>
        </div>
      </section>`;
  }

  return `
    <section class="view view-library" aria-labelledby="libraryTitle">
      <div class="view-head">
        <div class="title-block">
          <p class="view-eyebrow">LIBRARY · 보관함</p>
          <h1 class="large-title" id="libraryTitle">보관함</h1>
          <p class="view-sub">${stats.total}장의 사진 · ${libraryRange(photos)} · ${stats.places}곳</p>
        </div>
        <div class="view-actions">
          <button class="btn primary upload-btn" type="button" data-action="upload">
            ${icon('plus')}<span>사진 추가</span>
          </button>
        </div>
      </div>

      ${memberBanner()}

      <div class="library-toolbar">
        <div class="segmented" role="group" aria-label="사진 정렬 단위">
          ${[
            ['year', '연'],
            ['month', '월'],
            ['day', '일'],
            ['all', '모든 사진'],
          ]
            .map(
              ([id, label]) => `
            <button type="button" class="segment${ui.groupMode === id ? ' is-active' : ''}" data-mode="${id}" aria-pressed="${ui.groupMode === id}">
              ${label}
            </button>`,
            )
            .join('')}
        </div>
        <p class="toolbar-count">${stats.total}장<span class="dot">·</span>${stats.favorites} 즐겨찾기</p>
      </div>

      <div class="gallery">${groupedGallery(photos)}</div>
      <p class="gallery-foot">${icon('shield')} 모든 사진은 이 브라우저에만 저장됩니다 · 서버 전송 없음</p>
    </section>`;
}

function albumCard(album, counts) {
  const member = memberState();
  const locked = album.kind === 'secret' && !member;
  let cover = '';
  if (locked) {
    cover = `
      <span class="album-cover is-locked">
        <span class="locked-glyph">${icon('lock')}</span>
        <span class="locked-label">정회원 전용</span>
      </span>`;
  } else {
    const photos = store.albumPhotos(album.id, { member });
    const covers = photos.slice(0, 3);
    if (!covers.length) {
      cover = `<span class="album-cover is-empty"><span>${icon('photo')}</span></span>`;
    } else {
      cover = `
        <span class="album-cover">
          ${covers[0] ? `<span class="cover-a" style="background-image:url(&quot;${covers[0].artwork}&quot;)"><img src="${covers[0].thumb}" alt="" loading="lazy" data-artwork="${escapeHtml(covers[0].artwork)}" /></span>` : ''}
          ${covers[1] ? `<span class="cover-b" style="background-image:url(&quot;${covers[1].artwork}&quot;)"><img src="${covers[1].thumb}" alt="" loading="lazy" data-artwork="${escapeHtml(covers[1].artwork)}" /></span>` : ''}
        </span>`;
    }
  }
  return `
    <button class="album-card" type="button" data-album="${album.id}" aria-label="${escapeHtml(album.title)} 앨범 ${locked ? '잠김' : `${counts[album.id]}장`}">
      ${cover}
      <span class="album-info">
        <span class="album-title">${escapeHtml(album.title)}${album.kind === 'secret' ? `<em class="album-lock">${icon(locked ? 'lock' : 'unlock')}</em>` : ''}</span>
        <span class="album-meta">${locked ? '정회원 인증 필요' : `${counts[album.id]}장`}${album.kind === 'smart' || album.kind === 'recent' ? ' · 스마트 앨범' : ''}</span>
      </span>
    </button>`;
}

function renderAlbums() {
  const member = memberState();
  const counts = store.albumCounts({ member });
  return `
    <section class="view view-albums" aria-labelledby="albumsTitle">
      <div class="view-head">
        <div class="title-block">
          <p class="view-eyebrow">ALBUMS · 앨범</p>
          <h1 class="large-title" id="albumsTitle">앨범</h1>
          <p class="view-sub">${ALBUMS.length}개의 앨범${member ? ' · 모든 앨범 열람 가능' : ' · 비밀 앨범은 인증 후 열람'}</p>
        </div>
      </div>
      <h2 class="section-title">나의 앨범</h2>
      <div class="album-grid">
        ${ALBUMS.filter((album) => album.kind !== 'secret').map((album) => albumCard(album, counts)).join('')}
      </div>
      <h2 class="section-title">잠금 앨범</h2>
      <div class="album-grid secret-grid">
        ${ALBUMS.filter((album) => album.kind === 'secret').map((album) => albumCard(album, counts)).join('')}
      </div>
      <p class="gallery-foot">${icon('shield')} 비밀 앨범은 정회원 세션이 있어야만 목록에 나타납니다</p>
    </section>`;
}

function renderAlbum(albumId) {
  const album = albumById(albumId);
  if (!album) {
    return `<section class="view"><div class="empty-state"><h2>앨범을 찾을 수 없습니다</h2>
      <button class="btn primary" type="button" data-action="back-albums">앨범 목록으로</button></div></section>`;
  }
  const member = memberState();
  const photos = store.albumPhotos(album.id, { member });
  const locked = album.kind === 'secret' && !member;

  if (locked) {
    return `
      <section class="view view-album" aria-labelledby="albumTitle">
        <button class="back-link" type="button" data-action="back-albums">${icon('chevron-left')} 앨범</button>
        <div class="view-head">
          <div class="title-block">
            <p class="view-eyebrow">LOCKED ALBUM</p>
            <h1 class="large-title" id="albumTitle">${escapeHtml(album.title)}</h1>
          </div>
        </div>
        <div class="lock-panel">
          <span class="lock-glyph">${icon('lock')}</span>
          <h2>정회원 전용 앨범입니다</h2>
          <p>가족·생일처럼 공개하고 싶지 않은 사진은 비밀 앨범에 담겨 있습니다.<br />HD2Lab 정회원 패스코드로 인증하면 이 기기에서만 열람할 수 있습니다.</p>
          <button class="btn primary" type="button" data-action="unlock-secret">정회원 인증하고 열기</button>
          <p class="lock-foot">${icon('shield')} 세션이 종료되면 다시 잠깁니다</p>
        </div>
      </section>`;
  }

  currentList = photos;
  return `
    <section class="view view-album" aria-labelledby="albumTitle">
      <button class="back-link" type="button" data-action="back-albums">${icon('chevron-left')} 앨범</button>
      <div class="view-head">
        <div class="title-block">
          <p class="view-eyebrow">${album.kind === 'secret' ? 'SECRET ALBUM · 정회원' : 'ALBUM'}</p>
          <h1 class="large-title" id="albumTitle">${escapeHtml(album.title)}</h1>
          <p class="view-sub">${photos.length}장 · ${escapeHtml(album.description)}</p>
        </div>
      </div>
      ${photos.length ? photoGrid(photos) : `<div class="empty-state"><span class="empty-glyph">${icon(album.kind === 'secret' ? 'lock' : 'photo')}</span><h2>아직 사진이 없습니다</h2><p>${escapeHtml(album.description)}</p></div>`}
    </section>`;
}

function suggestions() {
  const photos = store.allPhotos();
  const countBy = (getter) => {
    const map = new Map();
    photos.forEach((item) => {
      const values = [].concat(getter(item)).filter(Boolean);
      values.forEach((value) => map.set(value, (map.get(value) || 0) + 1));
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };
  const tags = countBy((item) => item.tags).slice(0, 3);
  const cameras = countBy((item) => item.camera).slice(0, 2);
  const regions = countBy((item) => item.region).slice(0, 3);
  return [
    ...regions.map(([value]) => ({ label: value, query: value, type: '장소' })),
    ...tags.map(([value]) => ({ label: `#${value}`, query: value, type: '태그' })),
    ...cameras.map(([value]) => ({ label: value, query: value, type: '카메라' })),
  ];
}

function searchResultsHtml() {
  const member = memberState();
  const trimmed = ui.query.trim();
  if (!trimmed) {
    const items = suggestions();
    return `
      <div class="suggest-block">
        <p class="suggest-title">추천 검색</p>
        <div class="suggest-grid">
          ${items
            .map(
              (item) => `
            <button class="suggest-chip" type="button" data-suggest="${escapeHtml(item.query)}">
              <span class="suggest-type">${item.type}</span>
              <span class="suggest-label">${escapeHtml(item.label)}</span>
            </button>`,
            )
            .join('')}
        </div>
      </div>
      <p class="search-hint">${icon('sparkles')} 장소 · 태그 · 카메라 · 날짜를 한 번에 검색합니다. 예: <code>부산 바다</code>, <code>2026년 4월</code></p>`;
  }
  const results = searchPhotos(store.photos({ member }), trimmed, { scope: ui.scope });
  currentList = results;
  return `
    <div class="search-summary">
      <p><strong>${results.length}</strong>장의 사진<span>· "${escapeHtml(trimmed)}"</span></p>
      <button class="btn ghost small" type="button" data-action="clear-search">지우기</button>
    </div>
    ${results.length ? photoGrid(results, { showMeta: true }) : `
      <div class="empty-state">
        <span class="empty-glyph">${icon('search')}</span>
        <h2>검색 결과가 없습니다</h2>
        <p>"${escapeHtml(trimmed)}"와 일치하는 사진을 찾지 못했습니다.<br />다른 장소 · 태그 · 카메라 이름으로 시도해 보세요.</p>
      </div>`}`;
}

function renderSearch() {
  return `
    <section class="view view-search" aria-labelledby="searchTitle">
      <div class="view-head">
        <div class="title-block">
          <p class="view-eyebrow">SEARCH · 검색</p>
          <h1 class="large-title" id="searchTitle">검색</h1>
          <p class="view-sub">${store.photos({ member: memberState() }).length}장 · ${store.stats({ member: memberState() }).places}곳의 기록</p>
        </div>
      </div>

      <div class="search-bar">
        ${icon('search')}
        <input id="searchInput" type="search" inputmode="search" autocomplete="off" placeholder="장소, 태그, 카메라, 날짜 검색" value="${escapeHtml(ui.query)}" aria-label="사진 검색" />
        <button class="search-clear" type="button" data-action="clear-search" aria-label="검색어 지우기" ${ui.query ? '' : 'hidden'}>${icon('close')}</button>
      </div>

      <div class="scope-row" role="group" aria-label="검색 범위">
        ${SEARCH_SCOPES.map(
          (scope) => `
          <button class="scope-chip${ui.scope === scope.id ? ' is-active' : ''}" type="button" data-scope="${scope.id}" aria-pressed="${ui.scope === scope.id}">${scope.label}</button>`,
        ).join('')}
      </div>

      <div id="searchResults" class="search-results">${searchResultsHtml()}</div>
    </section>`;
}

function renderMember() {
  const member = memberState();
  const stats = store.stats({ member });
  const session = auth.session();
  const benefits = MEMBER_PROFILE.perks;

  if (!member) {
    return `
      <section class="view view-member" aria-labelledby="memberTitle">
        <div class="view-head">
          <div class="title-block">
            <p class="view-eyebrow">MEMBERSHIP · 멤버십</p>
            <h1 class="large-title" id="memberTitle">멤버십 센터</h1>
            <p class="view-sub">HD2Lab 정회원 인증 · 이 기기에서만 유효한 세션</p>
          </div>
        </div>

        <div class="member-hero">
          <div class="member-hero-main">
            <span class="member-glyph">${icon('lock')}</span>
            <p class="banner-eyebrow">HD2LAB MEMBER PASS</p>
            <h2>정회원 인증</h2>
            <p class="member-hero-desc">패스코드 하나로 사진 업로드, EXIF·태그 편집, 필터 보정, 원본 다운로드, 비밀 앨범까지 모두 열립니다.</p>
            <form class="passcode-form" data-form="member-passcode" novalidate>
              <label for="memberPasscode">멤버 패스코드</label>
              <div class="passcode-field">
                <input id="memberPasscode" name="passcode" type="password" autocomplete="off" spellcheck="false" placeholder="HD2-2026" aria-describedby="memberPassHint memberPassError" />
                <button class="reveal-btn" type="button" data-reveal aria-label="패스코드 보기">${icon('eye')}</button>
              </div>
              <p class="form-error" id="memberPassError" role="alert" hidden></p>
              <label class="remember-row"><input type="checkbox" name="remember" checked /> <span>이 기기에서 12시간 유지</span></label>
              <button class="btn primary block" type="submit">${icon('unlock')} 인증하고 잠금 해제</button>
            </form>
            <p class="member-hint" id="memberPassHint">체험용 패스코드 <code>HD2-2026</code> · 데모이므로 브라우저 번들에 포함되어 있습니다</p>
          </div>

          <div class="member-hero-side">
            <p class="side-title">정회원 전용 기능</p>
            <ul class="benefit-list">
              ${benefits.map((benefit) => `<li>${icon('check')}<span>${escapeHtml(benefit)}</span></li>`).join('')}
            </ul>
            <div class="benefit-note">
              ${icon('shield')}
              <p>패스코드와 사진은 어디로도 전송되지 않습니다.<br />서버 없는 정적 앱이며, 저장은 이 브라우저의 localStorage에만 이루어집니다.</p>
            </div>
          </div>
        </div>

        <div class="stat-grid">
          ${[
            ['사진', `${stats.total}장`],
            ['장소', `${stats.places}곳`],
            ['즐겨찾기', `${stats.favorites}장`],
            ['저장 공간', formatBytes(stats.storageBytes)],
          ]
            .map(
              ([label, value]) => `<div class="stat-card"><span>${label}</span><strong>${value}</strong></div>`,
            )
            .join('')}
        </div>
      </section>`;
  }

  const expires = session ? new Date(session.expiresAt) : null;
  const remainMinutes = Math.max(0, Math.floor(auth.remainingMs() / 60000));
  const remainText = remainMinutes >= 60 ? `${Math.floor(remainMinutes / 60)}시간 ${remainMinutes % 60}분` : `${remainMinutes}분`;
  return `
    <section class="view view-member" aria-labelledby="memberTitle">
      <div class="view-head">
        <div class="title-block">
          <p class="view-eyebrow">MEMBERSHIP · 멤버십</p>
          <h1 class="large-title" id="memberTitle">멤버십 센터</h1>
          <p class="view-sub">정회원 세션 활성 · 잠금 기능 모두 사용 가능</p>
        </div>
      </div>

      <div class="member-hero is-active">
        <div class="member-hero-main">
          <span class="member-glyph is-check">${icon('check')}</span>
          <p class="banner-eyebrow">✓ HD2LAB MEMBER</p>
          <h2>${escapeHtml(MEMBER_PROFILE.name)} <span class="member-tier">${escapeHtml(MEMBER_PROFILE.tier)}</span></h2>
          <p class="member-hero-desc">${escapeHtml(MEMBER_PROFILE.handle)} · ${escapeHtml(MEMBER_PROFILE.since)} 가입<br />
            세션 만료 ${expires ? `${expires.getMonth() + 1}월 ${expires.getDate()}일 ${String(expires.getHours()).padStart(2, '0')}:${String(expires.getMinutes()).padStart(2, '0')}` : '—'} · 남은 시간 ${remainText}</p>
          <div class="member-actions">
            <button class="btn ghost" type="button" data-action="upload">${icon('upload')} 사진 추가</button>
            <button class="btn danger ghost" type="button" data-action="signout">${icon('unlock')} 세션 종료</button>
          </div>
        </div>
        <div class="member-hero-side">
          <p class="side-title">열린 기능</p>
          <ul class="benefit-list is-unlocked">
            ${benefits.map((benefit) => `<li>${icon('check')}<span>${escapeHtml(benefit)}</span></li>`).join('')}
          </ul>
        </div>
      </div>

      <div class="stat-grid">
        ${[
          ['보관함', `${stats.total}장`],
          ['즐겨찾기', `${stats.favorites}장`],
          ['내 업로드', `${stats.uploads}장`],
          ['보정된 사진', `${stats.filtered}장`],
          ['비밀 앨범', `${stats.secret}장`],
          ['저장 공간', formatBytes(stats.storageBytes)],
        ]
          .map(([label, value]) => `<div class="stat-card"><span>${label}</span><strong>${value}</strong></div>`)
          .join('')}
      </div>

      <div class="system-card">
        <h2>시스템</h2>
        <dl>
          <div><dt>호스팅</dt><dd>GitHub Pages · 정적 SPA</dd></div>
          <div><dt>런타임</dt><dd>Vanilla JS (ES2022 Modules)</dd></div>
          <div><dt>저장</dt><dd>${local ? 'localStorage · 이 기기에만' : '메모리 전용 (저장 제한 감지)'}</dd></div>
          <div><dt>PWA</dt><dd>${'serviceWorker' in navigator ? 'Service Worker 등록 가능' : '미지원 브라우저'}</dd></div>
          <div><dt>세션</dt><dd>12시간 · 패스코드 재인증</dd></div>
        </dl>
        <div class="system-actions">
          <button class="btn ghost small" type="button" data-action="reset-demo">${icon('trash')} 데모 데이터 초기화</button>
          <p>즐겨찾기 · 보정 · 편집 · 업로드를 모두 지우고 목업 상태로 돌립니다.</p>
        </div>
      </div>
    </section>`;
}

/* ------------------------------------------------------------------ *
 * 렌더 · 라우팅
 * ------------------------------------------------------------------ */
function render() {
  const member = memberState();
  memberChip.classList.toggle('is-member', member);
  memberChipLabel.textContent = member ? '정회원' : '게스트';
  memberChip.querySelector('use').setAttribute('href', member ? '#i-check' : '#i-lock');
  memberChip.setAttribute('aria-label', member ? 'HD2Lab 정회원 인증됨 · 멤버십 센터 열기' : '게스트 모드 · 정회원 인증하기');

  let html = '';
  if (ui.view === 'albums') html = renderAlbums();
  else if (ui.view === 'album') html = renderAlbum(ui.albumId);
  else if (ui.view === 'search') html = renderSearch();
  else if (ui.view === 'member') html = renderMember();
  else html = renderLibrary();

  viewRoot.innerHTML = html;

  const tabTarget = ui.view === 'album' ? 'albums' : ui.view;
  tabbar.querySelectorAll('.tab').forEach((tab) => {
    const active = tab.dataset.tab === tabTarget;
    tab.classList.toggle('is-active', active);
    if (active) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });

  const titleMap = {
    library: 'HD2Lab | Photos (PKPilot0001)',
    albums: '앨범 · HD2Lab Photos',
    album: `${albumById(ui.albumId)?.title || '앨범'} · HD2Lab Photos`,
    search: '검색 · HD2Lab Photos',
    member: '멤버십 · HD2Lab Photos',
  };
  document.title = titleMap[ui.view] || titleMap.library;

  if (ui.view === 'search') {
    const input = viewRoot.querySelector('#searchInput');
    if (input && document.activeElement !== input && window.__pkFocusSearch) {
      input.focus({ preventScroll: true });
      window.__pkFocusSearch = false;
    }
  }
}

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  if (!raw) return { view: 'library' };
  const [head, tail] = raw.split('/');
  if (head === 'album' && tail) return { view: 'album', albumId: decodeURIComponent(tail) };
  if (['library', 'albums', 'search', 'member'].includes(head)) return { view: head };
  return { view: 'library' };
}

function applyRoute() {
  const route = parseRoute();
  ui.view = route.view;
  ui.albumId = route.albumId || null;
  render();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function navigate(view, { albumId = null, replace = false } = {}) {
  const hash = view === 'album' ? `#/album/${encodeURIComponent(albumId)}` : `#/${view}`;
  if (location.hash === hash) {
    applyRoute();
    return;
  }
  if (replace) {
    history.replaceState(null, '', hash);
    applyRoute();
  } else {
    location.hash = hash;
  }
}

/* ------------------------------------------------------------------ *
 * 인증 모달
 * ------------------------------------------------------------------ */
function requireAuth({ feature = 'membership', run = null } = {}) {
  if (memberState()) {
    run?.();
    return true;
  }
  pendingAuth = { feature, run };
  openAuthModal(feature);
  return false;
}

function openAuthModal(feature = 'membership') {
  const label = FEATURE_LABEL[feature] || '이 기능';
  modalRoot.innerHTML = `
    <div class="modal is-open" id="authModal">
      <div class="modal-backdrop" data-close-modal></div>
      <div class="auth-card" role="dialog" aria-modal="true" aria-labelledby="authTitle" aria-describedby="authDesc">
        <button class="auth-dismiss" type="button" data-close-modal aria-label="닫기">${icon('close')}</button>
        <div class="auth-lockup">
          <span class="auth-glyph">${icon('lock')}</span>
          <span class="auth-rings" aria-hidden="true"></span>
        </div>
        <p class="auth-eyebrow">HD2LAB MEMBERSHIP</p>
        <h2 id="authTitle">정회원 인증</h2>
        <p id="authDesc" class="auth-desc"><strong>${escapeHtml(label)}</strong> 기능은 HD2Lab 정회원만 사용할 수 있습니다.</p>

        <form class="passcode-form" data-form="modal-passcode" novalidate>
          <label for="modalPasscode">멤버 패스코드</label>
          <div class="passcode-field">
            <input id="modalPasscode" name="passcode" type="password" autocomplete="off" spellcheck="false" placeholder="HD2-2026" aria-describedby="authHint authError" />
            <button class="reveal-btn" type="button" data-reveal aria-label="패스코드 보기">${icon('eye')}</button>
          </div>
          <p class="form-error" id="authError" role="alert" hidden></p>
          <label class="remember-row"><input type="checkbox" name="remember" checked /> <span>이 기기에서 12시간 유지</span></label>
          <button class="btn primary block" type="submit">${icon('unlock')} 인증하고 계속</button>
        </form>

        <p class="member-hint" id="authHint">체험용 패스코드 <code>HD2-2026</code></p>
        <button class="auth-later" type="button" data-close-modal>나중에</button>
      </div>
    </div>`;

  const modal = modalRoot.querySelector('#authModal');
  const input = modal.querySelector('#modalPasscode');
  const form = modal.querySelector('form');
  input.focus({ preventScroll: true });

  const close = () => {
    modalRoot.innerHTML = '';
    pendingAuth = null;
  };
  modal.querySelectorAll('[data-close-modal]').forEach((node) => node.addEventListener('click', close));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handleSignIn(form, {
      onSuccess: () => {
        const run = pendingAuth?.run;
        close();
        render();
        toast('✓ HD2Lab 정회원 인증 완료', { tone: 'success' });
        run?.();
      },
    });
  });

  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
    if (event.key === 'Tab') {
      const focusables = [...modal.querySelectorAll('button, input, [href], [tabindex]:not([tabindex="-1"])')].filter(
        (node) => !node.disabled && !node.hidden,
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
}

function handleSignIn(form, { onSuccess } = {}) {
  const input = form.querySelector('input[name="passcode"]');
  const remember = form.querySelector('input[name="remember"]')?.checked ?? true;
  const errorBox = form.querySelector('.form-error');
  const submit = form.querySelector('button[type="submit"]');

  errorBox.hidden = true;
  submit.disabled = true;
  submit.classList.add('is-loading');
  const value = input.value;

  setTimeout(() => {
    const result = auth.signIn(value, { remember });
    submit.disabled = false;
    submit.classList.remove('is-loading');

    if (result.ok) {
      form.classList.add('is-granted');
      const modal = form.closest('.auth-card');
      if (modal) modal.classList.add('is-granted');
      input.blur();
      if (onSuccess) setTimeout(onSuccess, modal ? 620 : 0);
      return;
    }

    errorBox.hidden = false;
    form.classList.remove('is-shake');
    void form.offsetWidth;
    form.classList.add('is-shake');
    if (result.reason === 'locked') {
      errorBox.textContent = `시도 횟수를 초과했습니다. ${Math.ceil((result.retryAfterMs || 0) / 1000)}초 후 다시 시도해 주세요.`;
    } else {
      errorBox.textContent = `패스코드가 올바르지 않습니다. 남은 시도 ${result.attemptsLeft}회.`;
    }
    input.select();
  }, 320);
}

/* ------------------------------------------------------------------ *
 * 업로드
 * ------------------------------------------------------------------ */
function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImageEl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
    img.src = src;
  });
}

function drawScaled(image, maxEdge, quality) {
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return {
    dataUrl: canvas.toDataURL('image/jpeg', quality),
    width: canvas.width,
    height: canvas.height,
  };
}

async function buildUploadRecord(file, index) {
  const original = await readAsDataUrl(file);
  const image = await loadImageEl(original);
  const large = drawScaled(image, 1600, 0.82);
  const thumb = drawScaled(image, 640, 0.7);
  const stamp = file.lastModified ? toLocalIso(new Date(file.lastModified)) : toLocalIso(new Date());
  const rawName = file.name.replace(/\.[^.]+$/, '');
  const stampParts = localParts(stamp) || { month: 1, day: 1 };
  const genericName = !rawName || /^(img|dsc|dscn|dscf|pxl|photo|image|screenshot|kakaotalk|untitled|k-?\d+)[-_ ]?\d+/i.test(rawName);
  const baseName = genericName ? `새 사진 · ${stampParts.month}월 ${stampParts.day}일` : rawName;
  return {
    id: `up-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    title: baseName,
    caption: '기기에서 추가한 사진',
    fileName: file.name,
    takenAt: stamp,
    place: '위치 미확인 · 기기 업로드',
    region: '기기',
    lat: null,
    lng: null,
    camera: '기기 업로드',
    cameraModel: '',
    lens: '—',
    focal: '—',
    aperture: '—',
    shutter: '—',
    iso: '—',
    exposure: '0 EV',
    wb: '자동',
    sizeLabel: formatBytes(file.size),
    tags: ['업로드', '개인'],
    albums: ['recent'],
    favorite: false,
    secret: false,
    src: large.dataUrl,
    thumb: thumb.dataUrl,
    width: large.width,
    height: large.height,
    source: '기기 업로드',
  };
}

async function handleUpload(files) {
  const images = [...(files || [])].filter((file) => file.type.startsWith('image/')).slice(0, 6);
  if (!images.length) {
    toast('이미지 파일만 추가할 수 있습니다');
    return;
  }
  requireAuth({
    feature: 'upload',
    run: async () => {
      toast(`${images.length}장의 사진을 처리하는 중…`);
      let added = 0;
      let limitHit = false;
      for (let index = 0; index < images.length; index += 1) {
        try {
          const record = await buildUploadRecord(images[index], index);
          store.addUpload(record);
          added += 1;
        } catch (error) {
          if (error.code === 'UPLOAD_LIMIT') {
            limitHit = true;
            break;
          }
          if (error.code === 'STORAGE_WRITE_FAILED') {
            toast('저장 공간이 부족합니다. 사진 몇 장을 삭제한 뒤 다시 시도해 주세요.');
            break;
          }
        }
      }
      if (limitHit) toast(`업로드 한도에 도달했습니다 (최대 ${12}장)`);
      if (added) {
        if (ui.view === 'member' || ui.view === 'album') navigate('library');
        else render();
        toast(`✓ 사진 ${added}장을 보관함에 추가했습니다`, { tone: 'success' });
      } else if (!limitHit) {
        toast('추가된 사진이 없습니다 (지원하지 않는 형식)');
      }
    },
  });
}

/* ------------------------------------------------------------------ *
 * 앨범 · 잠금 진입
 * ------------------------------------------------------------------ */
function confirmReset() {
  const sheet = document.createElement('div');
  sheet.className = 'action-sheet';
  sheet.innerHTML = `
    <div class="action-sheet-card" role="alertdialog" aria-label="데모 데이터 초기화 확인">
      <p class="sheet-title">데모 데이터를 초기화할까요?</p>
      <p class="sheet-text">즐겨찾기 · 보정 · 태그 편집 · 업로드한 사진이 모두 지워지고<br />처음 목업 상태로 돌아갑니다.</p>
      <button class="sheet-action danger" type="button" data-sheet="confirm">초기화</button>
      <button class="sheet-action" type="button" data-sheet="cancel">취소</button>
    </div>`;
  document.body.appendChild(sheet);
  sheet.addEventListener('click', (event) => {
    const target = event.target.closest('[data-sheet]');
    if (!target && event.target !== sheet) return;
    if (target && target.dataset.sheet === 'confirm') {
      store.reset();
      render();
      toast('데모 데이터를 초기화했습니다');
    }
    sheet.remove();
  });
}

function openSecretAlbum() {
  requireAuth({
    feature: 'secret',
    run: () => {
      navigate('album', { albumId: 'secret' });
    },
  });
}

/* ------------------------------------------------------------------ *
 * 이벤트
 * ------------------------------------------------------------------ */
document.addEventListener('click', (event) => {
  const target = event.target.closest(
    '[data-tab], [data-action], [data-mode], [data-scope], [data-suggest], [data-photo], [data-album], [data-reveal]',
  );
  if (!target) return;

  if (target.dataset.reveal !== undefined && target.hasAttribute('data-reveal')) {
    const field = target.closest('.passcode-field');
    const input = field?.querySelector('input');
    if (input) {
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      target.setAttribute('aria-label', showing ? '패스코드 보기' : '패스코드 숨기기');
      input.focus();
    }
    return;
  }

  if (target.dataset.tab) {
    navigate(target.dataset.tab);
    return;
  }

  if (target.dataset.mode) {
    ui.groupMode = target.dataset.mode;
    render();
    return;
  }

  if (target.dataset.scope) {
    ui.scope = target.dataset.scope;
    render();
    const input = viewRoot.querySelector('#searchInput');
    input?.focus({ preventScroll: true });
    return;
  }

  if (target.dataset.suggest) {
    ui.query = target.dataset.suggest;
    ui.view = 'search';
    navigate('search');
    render();
    return;
  }

  if (target.dataset.photo) {
    viewer.open(target.dataset.photo, { list: currentList, returnFocus: target });
    return;
  }

  if (target.dataset.album) {
    const album = albumById(target.dataset.album);
    if (!album) return;
    if (album.kind === 'secret' && !memberState()) {
      openSecretAlbum();
      return;
    }
    navigate('album', { albumId: album.id });
    return;
  }

  const action = target.dataset.action;
  switch (action) {
    case 'upload':
      requireAuth({ feature: 'upload', run: () => fileInput.click() });
      break;
    case 'signin':
      requireAuth({ feature: 'membership' });
      break;
    case 'membership':
      navigate('member');
      break;
    case 'signout':
      auth.signOut();
      render();
      toast('정회원 세션을 종료했습니다. 잠금 기능이 다시 제한됩니다.');
      break;
    case 'unlock-secret':
      openSecretAlbum();
      break;
    case 'back-albums':
      navigate('albums');
      break;
    case 'reset-demo':
      confirmReset();
      break;
    case 'clear-search':
      ui.query = '';
      render();
      viewRoot.querySelector('#searchInput')?.focus({ preventScroll: true });
      break;
    default:
      break;
  }
});

document.addEventListener('input', (event) => {
  if (event.target.id !== 'searchInput') return;
  ui.query = event.target.value;
  const results = viewRoot.querySelector('#searchResults');
  if (results) results.innerHTML = searchResultsHtml();
  const clear = viewRoot.querySelector('.search-clear');
  if (clear) clear.hidden = !ui.query;
});

document.addEventListener('submit', (event) => {
  if (event.target.dataset.form !== 'member-passcode') return;
  event.preventDefault();
  handleSignIn(event.target, {
    onSuccess: () => {
      render();
      toast('✓ HD2Lab 정회원 인증 완료', { tone: 'success' });
    },
  });
});

themeBtn.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
});

window.addEventListener('keydown', (event) => {
  const tag = (event.target && event.target.tagName) || '';
  const typing = /INPUT|TEXTAREA|SELECT/.test(tag) || event.target?.isContentEditable;
  if (typing) return;
  if (event.key === 't' || event.key === 'T') {
    applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  }
  if (event.key === '/') {
    event.preventDefault();
    window.__pkFocusSearch = true;
    navigate('search');
  }
});

let scrollTick = false;
window.addEventListener('scroll', () => {
  if (scrollTick) return;
  scrollTick = true;
  requestAnimationFrame(() => {
    header.classList.toggle('is-scrolled', window.scrollY > 16);
    scrollTick = false;
  });
}, { passive: true });

/* 드래그 앤 드롭 업로드 */
let dragDepth = 0;
window.addEventListener('dragenter', (event) => {
  if (![...(event.dataTransfer?.types || [])].includes('Files')) return;
  dragDepth += 1;
  dropOverlay.hidden = false;
});
window.addEventListener('dragover', (event) => {
  if (event.dataTransfer?.types?.includes?.('Files')) event.preventDefault();
});
window.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) dropOverlay.hidden = true;
});
window.addEventListener('drop', (event) => {
  event.preventDefault();
  dragDepth = 0;
  dropOverlay.hidden = true;
  const files = event.dataTransfer?.files;
  if (files && files.length) handleUpload(files);
});

fileInput.addEventListener('change', () => {
  const files = Array.from(fileInput.files || []);
  fileInput.value = '';
  if (files.length) handleUpload(files);
});

/* 원격 이미지 실패 → SVG 아트워크로 자동 폴백 */
document.addEventListener(
  'error',
  (event) => {
    const node = event.target;
    if (!(node instanceof HTMLImageElement)) return;
    const artwork = node.dataset.artwork;
    if (!artwork || node.dataset.fallbackApplied === 'true') {
      node.style.visibility = 'hidden';
      return;
    }
    node.dataset.fallbackApplied = 'true';
    node.src = artwork;
  },
  true,
);

/* ------------------------------------------------------------------ *
 * 뷰어 · 초기화
 * ------------------------------------------------------------------ */
const viewer = createViewer({
  root: document.querySelector('#viewerRoot'),
  store,
  auth,
  requireAuth: (options) => requireAuth(options),
  toast,
  onClose: () => render(),
});

function init() {
  const savedTheme = (() => {
    try {
      return storage.getItem(THEME_KEY);
    } catch {
      return null;
    }
  })();
  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
  applyTheme(savedTheme || (prefersLight ? 'light' : 'dark'), { persist: false });

  window.addEventListener('hashchange', applyRoute);

  applyRoute();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  if (!local) {
    setTimeout(() => toast('이 브라우저에서는 저장이 제한됩니다 · 새로고침하면 변경 사항이 사라집니다'), 1200);
  }
}

init();
