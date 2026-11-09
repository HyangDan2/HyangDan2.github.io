/**
 * PKPilot0001 · HD2Lab | Photos
 * js/viewer.js — iOS Photos 스타일 풀스크린 라이트박스
 *   · 이전/다음, 필름스트립, 확대/이동, 정보(EXIF) 패널, 필터 보정, 즐겨찾기
 *   · 게스트가 잠금 기능(보정/원본 다운로드/삭제)을 누르면 인증 요청을 위임합니다.
 */

import { ALBUMS, FILTER_PRESETS, getFilterPreset } from './mockData.js';
import { formatKoreanDate, formatKoreanTime, formatStamp } from './store.js';

function icon(name, className = '') {
  return `<svg class="ic ${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

export function createViewer({ root, store, auth, requireAuth, toast, onClose } = {}) {
  let list = [];
  let index = 0;
  let photo = null;
  let infoOpen = false;
  let editOpen = false;
  let metaOpen = false;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let dragging = null;
  let lastTap = 0;
  let pointerStart = null;
  let returnFocus = null;

  root.innerHTML = `
    <div class="viewer" id="viewer" role="dialog" aria-modal="true" aria-label="사진 뷰어" hidden>
      <div class="viewer-bg" data-v="close" aria-hidden="true"></div>

      <header class="viewer-top">
        <button class="v-btn" type="button" data-v="close" aria-label="닫기">${icon('close')}</button>
        <div class="viewer-heading">
          <p class="viewer-title" id="vTitle">사진</p>
          <p class="viewer-stamp" id="vStamp"></p>
        </div>
        <div class="viewer-tools">
          <button class="v-btn" type="button" data-v="edit" aria-label="보정" title="필터 · 보정 (E)">${icon('sliders')}</button>
          <button class="v-btn" type="button" data-v="favorite" aria-label="즐겨찾기" aria-pressed="false" title="즐겨찾기 (F)">${icon('heart')}</button>
          <button class="v-btn" type="button" data-v="download" aria-label="원본 다운로드" title="원본 다운로드">${icon('download')}</button>
          <button class="v-btn" type="button" data-v="delete" aria-label="삭제" title="삭제">${icon('trash')}</button>
          <button class="v-btn" type="button" data-v="info" aria-label="정보" aria-pressed="false" title="정보 (I)">${icon('info')}</button>
        </div>
      </header>

      <div class="viewer-stage" id="vStage">
        <button class="viewer-nav" type="button" data-v="prev" aria-label="이전 사진">${icon('chevron-left')}</button>
        <figure class="viewer-frame" id="vFrame" tabindex="0" aria-label="사진 확대 및 이동">
          <span class="viewer-art" id="vArt" aria-hidden="true"></span>
          <img class="viewer-image" id="vImage" alt="" draggable="false" />
          <span class="viewer-spinner" id="vSpinner" aria-hidden="true"></span>
          <span class="viewer-filterbadge" id="vFilterBadge" hidden></span>
          <span class="viewer-secretbadge" id="vSecretBadge" hidden>${icon('lock')} 비밀 앨범</span>
        </figure>
        <button class="viewer-nav" type="button" data-v="next" aria-label="다음 사진">${icon('chevron-right')}</button>
      </div>

      <div class="viewer-zoom" id="vZoom">
        <button class="v-chip" type="button" data-v="zoom-out" aria-label="축소">−</button>
        <span class="v-zoom-value" id="vZoomValue">100%</span>
        <button class="v-chip" type="button" data-v="zoom-in" aria-label="확대">+</button>
        <button class="v-chip" type="button" data-v="zoom-reset" aria-label="원래 크기">FIT</button>
      </div>

      <footer class="viewer-bottom">
        <div class="viewer-place">
          ${icon('pin')}
          <span id="vPlace"></span>
        </div>
        <div class="viewer-caption" id="vCaption"></div>
        <div class="viewer-count" id="vCount"></div>
      </footer>

      <div class="filmstrip" id="vFilmstrip" aria-label="사진 목록"></div>

      <aside class="panel info-panel" id="vInfo" aria-label="사진 정보" hidden>
        <div class="panel-head">
          <h2>사진 정보</h2>
          <button class="v-btn small" type="button" data-v="info" aria-label="정보 닫기">${icon('close')}</button>
        </div>
        <div class="panel-body" id="vInfoBody"></div>
      </aside>

      <aside class="panel meta-panel" id="vMeta" aria-label="사진 정보 편집" hidden>
        <div class="panel-head">
          <h2>정보 편집</h2>
          <button class="v-btn small" type="button" data-v="meta" aria-label="정보 편집 닫기">${icon('close')}</button>
        </div>
        <form class="meta-form" id="vMetaForm" novalidate>
          <label class="meta-field"><span>제목</span><input name="title" type="text" maxlength="80" autocomplete="off" /></label>
          <label class="meta-field"><span>설명</span><textarea name="caption" rows="3" maxlength="280"></textarea></label>
          <label class="meta-field"><span>장소</span><input name="place" type="text" maxlength="90" autocomplete="off" /></label>
          <label class="meta-field"><span>태그 <em>쉼표로 구분</em></span><input name="tags" type="text" autocomplete="off" /></label>
          <fieldset class="meta-albums"><legend>앨범</legend><div id="vMetaAlbums"></div></fieldset>
          <p class="form-error" data-error hidden></p>
          <div class="panel-foot">
            <button class="btn ghost" type="button" data-v="meta">취소</button>
            <button class="btn primary" type="submit">저장</button>
          </div>
        </form>
      </aside>

      <aside class="panel edit-panel" id="vEdit" aria-label="필터와 보정" hidden>
        <div class="panel-head">
          <h2>필터 · 보정</h2>
          <button class="v-btn small" type="button" data-v="edit" aria-label="보정 닫기">${icon('close')}</button>
        </div>
        <p class="panel-note">${icon('lock')} 정회원 전용 보정 엔진 <span>원본 파일은 변경되지 않습니다</span></p>
        <div class="filter-grid" id="vFilterGrid"></div>
        <div class="panel-foot">
          <button class="btn ghost" type="button" data-v="filter-reset">원본으로</button>
          <button class="btn primary" type="button" data-v="edit">완료</button>
        </div>
      </aside>
    </div>
  `;

  const el = {
    viewer: root.querySelector('#viewer'),
    title: root.querySelector('#vTitle'),
    stamp: root.querySelector('#vStamp'),
    stage: root.querySelector('#vStage'),
    frame: root.querySelector('#vFrame'),
    art: root.querySelector('#vArt'),
    image: root.querySelector('#vImage'),
    spinner: root.querySelector('#vSpinner'),
    filterBadge: root.querySelector('#vFilterBadge'),
    secretBadge: root.querySelector('#vSecretBadge'),
    zoomValue: root.querySelector('#vZoomValue'),
    zoomBox: root.querySelector('#vZoom'),
    place: root.querySelector('#vPlace'),
    caption: root.querySelector('#vCaption'),
    count: root.querySelector('#vCount'),
    filmstrip: root.querySelector('#vFilmstrip'),
    info: root.querySelector('#vInfo'),
    infoBody: root.querySelector('#vInfoBody'),
    edit: root.querySelector('#vEdit'),
    meta: root.querySelector('#vMeta'),
    metaForm: root.querySelector('#vMetaForm'),
    metaAlbums: root.querySelector('#vMetaAlbums'),
    filterGrid: root.querySelector('#vFilterGrid'),
    favBtn: root.querySelector('[data-v="favorite"]'),
    infoBtn: root.querySelector('.viewer-tools [data-v="info"]'),
  };

  /* ---------------------------- 이미지 로딩 ---------------------------- */
  function loadImage(item) {
    el.art.style.backgroundImage = `url("${item.artwork}")`;
    el.image.classList.remove('is-loaded');
    el.image.style.filter = getFilterPreset(item.filter).css;
    el.spinner.hidden = false;
    el.image.alt = `${item.title} — ${item.place}`;
    const source = item.src;
    el.image.onload = () => {
      el.image.classList.add('is-loaded');
      el.spinner.hidden = true;
    };
    el.image.onerror = () => {
      // 원격 이미지 실패 → 오프라인 SVG 아트워크로 폴백합니다.
      el.image.onerror = null;
      el.image.src = item.artwork;
    };
    el.image.src = source;
    if (el.image.complete && el.image.naturalWidth > 0) {
      el.image.classList.add('is-loaded');
      el.spinner.hidden = true;
    }
  }

  /* ---------------------------- 필름스트립 ---------------------------- */
  function renderFilmstrip() {
    if (!list.length) {
      el.filmstrip.innerHTML = '';
      el.filmstrip.hidden = true;
      return;
    }
    el.filmstrip.hidden = list.length < 2;
    const frag = document.createDocumentFragment();
    list.forEach((item, itemIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `film-thumb${itemIndex === index ? ' is-active' : ''}`;
      button.dataset.index = String(itemIndex);
      button.setAttribute('aria-label', `${item.title} 사진으로 이동`);
      button.style.backgroundImage = `url("${item.artwork}")`;
      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.src = item.thumb;
      img.onerror = () => {
        img.remove();
      };
      button.appendChild(img);
      frag.appendChild(button);
    });
    el.filmstrip.replaceChildren(frag);
    const active = el.filmstrip.querySelector('.film-thumb.is-active');
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }

  /* ---------------------------- 정보 패널 ---------------------------- */
  function exifRows(item) {
    const coordinates =
      typeof item.lat === 'number' && typeof item.lng === 'number'
        ? `${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}`
        : '—';
    const camera = item.cameraModel && item.cameraModel !== item.camera ? `${item.camera} · ${item.cameraModel}` : item.camera;
    return [
      ['촬영일시', formatStamp(item.takenAt)],
      ['카메라', camera],
      ['렌즈', item.lens],
      ['초점거리', item.focal],
      ['조리개', item.aperture],
      ['셔터스피드', item.shutter],
      ['ISO', String(item.iso)],
      ['노출 보정', item.exposure],
      ['화이트밸런스', item.wb],
      ['장소', item.place],
      ['좌표', coordinates],
      ['해상도 · 용량', `${item.width} × ${item.height} · ${item.sizeLabel}`],
      ['파일명', item.fileName],
      ['출처', item.uploaded ? '기기 업로드 · 이 브라우저에만 저장' : item.source || 'HD2Lab 목업'],
    ];
  }

  function renderInfo() {
    if (!photo) return;
    const activeFilter = getFilterPreset(photo.filter);
    el.infoBody.innerHTML = `
      <div class="info-hero">
        <p class="info-title">${escapeHtml(photo.title)}</p>
        <p class="info-caption">${escapeHtml(photo.caption || '설명 없음')}</p>
      </div>
      <dl class="exif-list">
        ${exifRows(photo)
          .map(
            ([label, value]) => `
          <div class="exif-row">
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(value)}</dd>
          </div>`,
          )
          .join('')}
      </dl>
      <div class="info-block">
        <p class="info-label">태그</p>
        <div class="tag-row">
          ${(photo.tags || []).map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}
        </div>
      </div>
      <div class="info-block">
        <p class="info-label">현재 보정</p>
        <p class="info-value">${escapeHtml(activeFilter.label)} <span class="muted">${escapeHtml(activeFilter.hint)}</span></p>
      </div>
      <div class="info-block info-actions">
        <button class="btn ghost" type="button" data-v="meta">${icon('pencil')} 정보 · 태그 편집</button>
        <button class="btn ghost" type="button" data-v="edit">${icon('sliders')} 필터 · 보정</button>
        <button class="btn ghost" type="button" data-v="download">${icon('download')} 원본 다운로드</button>
        <button class="btn danger" type="button" data-v="delete">${icon('trash')} 사진 삭제</button>
      </div>
      <p class="info-foot">이 기기의 브라우저에만 저장됩니다 · 서버 전송 없음</p>
    `;
  }

  /* ---------------------------- 필터 패널 ---------------------------- */
  function renderFilters() {
    if (!photo) return;
    el.filterGrid.innerHTML = FILTER_PRESETS.map((preset) => {
      const active = (photo.filter || 'none') === preset.id;
      return `
        <button class="filter-card${active ? ' is-active' : ''}" type="button" data-preset="${preset.id}" aria-pressed="${active}">
          <span class="filter-preview" style="background-image:url(&quot;${photo.thumb}&quot;)">
            <img src="${photo.thumb}" alt="" loading="lazy" style="filter:${preset.css}" data-artwork="${photo.artwork.replace(/"/g, '&quot;')}" />
          </span>
          <span class="filter-name">${preset.label}</span>
          <span class="filter-hint">${preset.hint}</span>
        </button>`;
    }).join('');
    el.filterGrid.querySelectorAll('img').forEach((img) => {
      img.addEventListener('error', () => {
        img.src = img.dataset.artwork;
      });
    });
  }

  /* ---------------------------- 상태 반영 ---------------------------- */
  function syncPanelState() {
    el.viewer.classList.toggle('has-panel', infoOpen || editOpen || metaOpen);
  }

  function applyChrome() {
    if (!photo) return;
    el.title.textContent = photo.title;
    el.stamp.textContent = `${formatKoreanDate(photo.takenAt)} · ${formatKoreanTime(photo.takenAt)}`;
    el.place.textContent = photo.place;
    el.caption.textContent = photo.caption || '';
    el.count.textContent = `${index + 1} / ${list.length}`;
    el.favBtn.classList.toggle('is-active', Boolean(photo.favorite));
    el.favBtn.setAttribute('aria-pressed', String(Boolean(photo.favorite)));
    el.favBtn.innerHTML = icon(photo.favorite ? 'heart-filled' : 'heart');
    el.infoBtn.classList.toggle('is-active', infoOpen);
    el.infoBtn.setAttribute('aria-pressed', String(infoOpen));
    const preset = getFilterPreset(photo.filter);
    el.filterBadge.hidden = preset.id === 'none';
    el.filterBadge.textContent = `${preset.label} · ${preset.hint}`;
    el.secretBadge.hidden = !photo.secret;
    el.image.style.filter = preset.css;
    el.zoomBox.hidden = false;
    renderInfo();
    if (editOpen) renderFilters();
  }

  function setPhoto(nextIndex, { animate = true } = {}) {
    if (!list.length) return;
    index = (nextIndex + list.length) % list.length;
    photo = list[index];
    infoOpen = false;
    el.info.hidden = true;
    editOpen = false;
    el.edit.hidden = true;
    metaOpen = false;
    el.meta.hidden = true;
    syncPanelState();
    resetZoom();
    if (animate) {
      el.frame.classList.remove('is-switching');
      // 강제 리플로우로 애니메이션 재시작
      void el.frame.offsetWidth;
      el.frame.classList.add('is-switching');
    }
    loadImage(photo);
    applyChrome();
    renderFilmstrip();
  }

  /* ---------------------------- 확대 / 이동 ---------------------------- */
  function updateZoom() {
    el.image.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    el.zoomValue.textContent = `${Math.round(zoom * 100)}%`;
    el.frame.classList.toggle('is-zoomed', zoom > 1.01);
    if (zoom <= 1.01) {
      panX = 0;
      panY = 0;
      el.image.style.transform = 'none';
    }
  }

  function setZoom(value) {
    zoom = Math.min(4, Math.max(1, Number(value.toFixed(2))));
    updateZoom();
  }

  function resetZoom() {
    zoom = 1;
    panX = 0;
    panY = 0;
    updateZoom();
  }

  /* ---------------------------- 잠금 기능 ---------------------------- */
  function guarded(feature, run) {
    if (auth.isMember()) {
      run();
      return;
    }
    requireAuth({ feature, run });
  }

  async function downloadOriginal() {
    if (!photo) return;
    const item = photo;
    toast(`${item.title} 원본을 내려받는 중…`);
    try {
      let href = item.src;
      if (!item.uploaded) {
        const response = await fetch(item.src, { mode: 'cors' });
        if (!response.ok) throw new Error('fetch failed');
        const blob = await response.blob();
        href = URL.createObjectURL(blob);
      }
      const link = document.createElement('a');
      link.href = href;
      link.download = `HD2Lab_${item.fileName.replace(/\.[^.]+$/, '')}${item.uploaded ? '' : '.jpg'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      if (href.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(href), 4000);
      toast('✓ 원본 다운로드를 시작했습니다');
    } catch {
      // 네트워크 실패 시 오프라인 아트워크(SVG)를 저장합니다.
      const link = document.createElement('a');
      link.href = item.artwork;
      link.download = `HD2Lab_${item.fileName.replace(/\.[^.]+$/, '')}_artwork.svg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast('네트워크가 없어 오프라인 아트워크로 저장했습니다');
    }
  }

  function requestDelete() {
    if (!photo) return;
    const item = photo;
    const remove = () => {
      const snapshot = store.deletePhoto(item.id);
      if (!snapshot) {
        toast('사진을 삭제하지 못했습니다');
        return;
      }
      toast(`'${item.title}' 사진을 삭제했습니다`, {
        actionLabel: '실행 취소',
        onAction: () => {
          store.restorePhoto(snapshot);
          toast('사진을 복구했습니다');
          onClose?.(true);
        },
      });
      close({ skipCallback: true });
      onClose?.(true);
    };

    // iOS 스타일 확인 시트
    const sheet = document.createElement('div');
    sheet.className = 'action-sheet';
    sheet.innerHTML = `
      <div class="action-sheet-card" role="alertdialog" aria-label="사진 삭제 확인">
        <p class="sheet-title">이 사진을 삭제할까요?</p>
        <p class="sheet-text">삭제 후에도 토스트의 <strong>실행 취소</strong>로 되돌릴 수 있습니다.<br />${escapeHtml(item.title)} · ${escapeHtml(item.place)}</p>
        <button class="sheet-action danger" type="button" data-sheet="confirm">사진 삭제</button>
        <button class="sheet-action" type="button" data-sheet="cancel">취소</button>
      </div>`;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (event) => {
      const target = event.target.closest('[data-sheet]');
      if (!target && event.target !== sheet) return;
      if (target && target.dataset.sheet === 'confirm') remove();
      sheet.remove();
    });
  }

  /* ---------------------------- 이벤트 ---------------------------- */
  function open(id, options = {}) {
    const source = options.list || store.photos({ member: auth.isMember() });
    const position = source.findIndex((item) => item.id === id);
    if (position < 0) return false;
    list = source;
    returnFocus = options.returnFocus || document.activeElement;
    root.querySelector('#viewer').hidden = false;
    root.querySelector('#viewer').classList.add('is-open');
    document.body.classList.add('viewer-open');
    setPhoto(position, { animate: false });
    el.viewer.focus?.();
    document.addEventListener('keydown', onKeydown);
    requestAnimationFrame(() => {
      root.querySelector('.v-btn[data-v="close"]')?.focus({ preventScroll: true });
    });
    return true;
  }

  function close({ skipCallback = false } = {}) {
    if (!root.querySelector('#viewer') || el.viewer.hidden) return;
    el.viewer.classList.remove('is-open');
    el.viewer.hidden = true;
    document.body.classList.remove('viewer-open');
    infoOpen = false;
    editOpen = false;
    metaOpen = false;
    el.info.hidden = true;
    el.edit.hidden = true;
    el.meta.hidden = true;
    syncPanelState();
    document.removeEventListener('keydown', onKeydown);
    if (returnFocus && typeof returnFocus.focus === 'function') {
      returnFocus.focus({ preventScroll: true });
    }
    if (!skipCallback) onClose?.(false);
  }

  function isOpen() {
    return !el.viewer.hidden;
  }

  function refresh() {
    if (!isOpen() || !photo) return;
    const refreshed = store.getPhoto(photo.id, { member: auth.isMember() });
    if (!refreshed) {
      close({ skipCallback: true });
      onClose?.(true);
      return;
    }
    list = list
      .map((item) => store.getPhoto(item.id, { member: auth.isMember() }) || item)
      .filter(Boolean);
    const position = list.findIndex((item) => item.id === photo.id);
    if (position >= 0) {
      photo = list[position];
      index = position;
    } else {
      photo = refreshed;
      list = [photo, ...list];
      index = 0;
    }
    applyChrome();
    renderFilmstrip();
  }

  function onKeydown(event) {
    const tag = (event.target && event.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || (event.target && event.target.isContentEditable)) return;
    switch (event.key) {
      case 'Escape':
        if (metaOpen) {
          metaOpen = false;
          el.meta.hidden = true;
          syncPanelState();
        } else if (editOpen) {
          editOpen = false;
          el.edit.hidden = true;
          syncPanelState();
        } else if (infoOpen) {
          infoOpen = false;
          el.info.hidden = true;
          el.infoBtn.classList.remove('is-active');
          el.infoBtn.setAttribute('aria-pressed', 'false');
          syncPanelState();
        } else {
          close();
        }
        e_prevent(event);
        break;
      case 'ArrowLeft':
        setPhoto(index - 1);
        e_prevent(event);
        break;
      case 'ArrowRight':
        setPhoto(index + 1);
        e_prevent(event);
        break;
      case 'i':
      case 'I':
        toggleInfo();
        e_prevent(event);
        break;
      case 'e':
      case 'E':
        toggleEdit();
        e_prevent(event);
        break;
      case 'f':
      case 'F':
        toggleFavorite();
        e_prevent(event);
        break;
      case '+':
      case '=':
        setZoom(zoom + 0.5);
        e_prevent(event);
        break;
      case '-':
        setZoom(zoom - 0.5);
        e_prevent(event);
        break;
      case '0':
        resetZoom();
        e_prevent(event);
        break;
      default:
        break;
    }
  }

  function e_prevent(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function toggleInfo() {
    infoOpen = !infoOpen;
    el.info.hidden = !infoOpen;
    el.edit.hidden = true;
    editOpen = false;
    el.infoBtn.classList.toggle('is-active', infoOpen);
    el.infoBtn.setAttribute('aria-pressed', String(infoOpen));
    if (infoOpen) renderInfo();
    syncPanelState();
  }

  function toggleEdit() {
    guarded('filter', () => {
      editOpen = !editOpen;
      el.edit.hidden = !editOpen;
      el.info.hidden = true;
      infoOpen = false;
      metaOpen = false;
      el.meta.hidden = true;
      el.infoBtn.classList.remove('is-active');
      el.infoBtn.setAttribute('aria-pressed', 'false');
      if (editOpen) renderFilters();
      syncPanelState();
    });
  }

  function renderMetaForm() {
    if (!photo) return;
    const form = el.metaForm;
    form.elements.title.value = photo.title || '';
    form.elements.caption.value = photo.caption || '';
    form.elements.place.value = photo.place || '';
    form.elements.tags.value = (photo.tags || []).join(', ');
    const editable = ALBUMS.filter((album) => album.kind === 'category');
    el.metaAlbums.innerHTML = editable
      .map(
        (album) => `
        <label class="album-toggle">
          <input type="checkbox" name="albums" value="${album.id}" ${photo.albums?.includes(album.id) ? 'checked' : ''} />
          <span>${escapeHtml(album.title)}</span>
        </label>`,
      )
      .join('');
    const error = form.querySelector('[data-error]');
    error.hidden = true;
    error.textContent = '';
  }

  function toggleMeta() {
    guarded('edit', () => {
      metaOpen = !metaOpen;
      el.meta.hidden = !metaOpen;
      el.info.hidden = true;
      infoOpen = false;
      editOpen = false;
      el.edit.hidden = true;
      el.infoBtn.classList.remove('is-active');
      el.infoBtn.setAttribute('aria-pressed', 'false');
      if (metaOpen) renderMetaForm();
      syncPanelState();
    });
  }

  function toggleFavorite() {
    if (!photo) return;
    const result = store.toggleFavorite(photo.id);
    if (result === null) {
      toast('즐겨찾기를 저장하지 못했습니다 (저장 공간 확인)');
      return;
    }
    photo.favorite = result;
    applyChrome();
    renderFilmstrip();
    toast(result ? '♥ 즐겨찾기에 추가했습니다' : '즐겨찾기에서 제거했습니다');
  }

  el.viewer.addEventListener('click', (event) => {
    const target = event.target.closest('[data-v]');
    if (!target) return;
    const action = target.dataset.v;
    switch (action) {
      case 'close':
        close();
        break;
      case 'prev':
        setPhoto(index - 1);
        break;
      case 'next':
        setPhoto(index + 1);
        break;
      case 'favorite':
        toggleFavorite();
        break;
      case 'info':
        toggleInfo();
        break;
      case 'edit':
        toggleEdit();
        break;
      case 'meta':
        toggleMeta();
        break;
      case 'download':
        guarded('download', downloadOriginal);
        break;
      case 'delete':
        guarded('delete', requestDelete);
        break;
      case 'zoom-in':
        setZoom(zoom + 0.5);
        break;
      case 'zoom-out':
        setZoom(zoom - 0.5);
        break;
      case 'zoom-reset':
        resetZoom();
        break;
      case 'filter-reset':
        store.setFilter(photo.id, 'none');
        photo.filter = 'none';
        el.image.style.filter = 'none';
        applyChrome();
        renderFilters();
        toast('원본 상태로 되돌렸습니다');
        break;
      default:
        break;
    }
  });

  el.filterGrid.addEventListener('click', (event) => {
    const card = event.target.closest('[data-preset]');
    if (!card || !photo) return;
    const presetId = card.dataset.preset;
    const ok = store.setFilter(photo.id, presetId);
    if (!ok) {
      toast('보정 값을 저장하지 못했습니다');
      return;
    }
    photo.filter = presetId;
    el.image.style.filter = getFilterPreset(presetId).css;
    applyChrome();
    renderFilters();
    toast(`${getFilterPreset(presetId).label} 톤을 적용했습니다`);
  });

  el.filmstrip.addEventListener('click', (event) => {
    const thumb = event.target.closest('.film-thumb');
    if (!thumb) return;
    setPhoto(Number(thumb.dataset.index));
  });

  /* 확대 · 이동 · 스와이프 */
  el.frame.addEventListener('wheel', (event) => {
    event.preventDefault();
    setZoom(zoom + (event.deltaY < 0 ? 0.25 : -0.25));
  }, { passive: false });

  el.frame.addEventListener('dblclick', (event) => {
    event.preventDefault();
    if (zoom > 1.01) resetZoom();
    else setZoom(2.4);
  });

  el.frame.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    pointerStart = { x: event.clientX, y: event.clientY, zoom, panX, panY, at: Date.now() };
    if (zoom > 1.01) {
      dragging = { x: event.clientX, y: event.clientY, panX, panY };
      el.frame.setPointerCapture?.(event.pointerId);
      el.frame.classList.add('is-panning');
    }
  });

  el.frame.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    panX = dragging.panX + (event.clientX - dragging.x);
    panY = dragging.panY + (event.clientY - dragging.y);
    updateZoom();
  });

  el.frame.addEventListener('pointerup', (event) => {
    el.frame.classList.remove('is-panning');
    if (pointerStart && !dragging) {
      const deltaX = event.clientX - pointerStart.x;
      const deltaY = event.clientY - pointerStart.y;
      const elapsed = Date.now() - pointerStart.at;
      if (Math.abs(deltaX) > 64 && Math.abs(deltaY) < 46 && elapsed < 900 && zoom <= 1.01) {
        setPhoto(index + (deltaX < 0 ? 1 : -1));
      } else if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) {
        const now = Date.now();
        if (now - lastTap < 320) {
          if (zoom > 1.01) resetZoom();
          else setZoom(2.4);
          lastTap = 0;
        } else {
          lastTap = now;
        }
      }
    }
    dragging = null;
    pointerStart = null;
  });

  el.frame.addEventListener('pointercancel', () => {
    dragging = null;
    pointerStart = null;
    el.frame.classList.remove('is-panning');
  });

  el.metaForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!photo) return;
    const form = el.metaForm;
    const error = form.querySelector('[data-error]');
    const title = form.elements.title.value.trim();
    if (!title) {
      error.hidden = false;
      error.textContent = '제목을 입력해 주세요.';
      form.elements.title.focus();
      return;
    }
    const tags = form.elements.tags.value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const albums = [...form.querySelectorAll('input[name="albums"]:checked')].map((input) => input.value);
    const patch = {
      title,
      caption: form.elements.caption.value,
      place: form.elements.place.value,
      tags,
      albums,
    };
    if (!store.updatePhotoDetails(photo.id, patch)) {
      error.hidden = false;
      error.textContent = '저장하지 못했습니다. 저장 공간을 확인해 주세요.';
      return;
    }
    Object.assign(photo, {
      title: title,
      caption: form.elements.caption.value.trim(),
      place: form.elements.place.value.trim() || photo.place,
      tags,
      albums,
    });
    metaOpen = false;
    el.meta.hidden = true;
    syncPanelState();
    applyChrome();
    renderInfo();
    renderFilmstrip();
    toast('✓ 사진 정보를 저장했습니다', { tone: 'success' });
  });

  el.frame.addEventListener('error', () => {}, true);

  return { open, close, isOpen, refresh, setPhoto, next: () => setPhoto(index + 1), prev: () => setPhoto(index - 1) };
}
