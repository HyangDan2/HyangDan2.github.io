/* ============================================================================
 * HD2Lab · Shutterplate (PKPilot0003)
 * Studio wiring: upload → EXIF → live canvas → 8-frame strip → 1:1 export.
 * ==========================================================================*/
(function () {
  'use strict';

  var EX = window.SPExif;
  var PL = window.SPPlate;
  var EM = window.SPEmblems;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var SAMPLES = [
    { file: 'assets/samples/sample-01.jpg', label: 'Sony α7 IV' },
    { file: 'assets/samples/sample-02.jpg', label: 'FUJIFILM X-T5' },
    { file: 'assets/samples/sample-03.jpg', label: 'Canon EOS R5' }
  ];

  /* 제목의 "원본 1:1" 계약이 우선한다 — 내보내기는 사진의 원래 픽셀 그대로다.
     기기가 그만한 캔버스를 못 들면 아래 사다리를 한 칸씩 내려가며 재시도한다. */
  var FALLBACK_EDGES = [4096, 3072, 2048];

  /* ── in-app browsers ──────────────────────────────────────────────────────
     KakaoTalk's Android WebView — and Instagram's, Facebook's, Naver's — will
     not take a blob: download and can refuse to decode a blob: image either.
     That is the "지원하지 않는 파일 형식" a visitor in the chat app runs into.
     Naming the host lets the studio say what to do instead of failing mute. */
  var IN_APP_SIGNATURES = [
    { name: '카카오톡', re: /KAKAOTALK/i },
    { name: '카카오스토리', re: /KAKAOSTORY/i },
    { name: '인스타그램', re: /Instagram/i },
    { name: '페이스북', re: /FBAN|FBAV|FB_IAB|FB4A|FBIOS/i },
    { name: '네이버', re: /NAVER\(inapp/i },
    { name: '다음', re: /DaumApps|Daum ?App/i },
    { name: '라인', re: /\bLine\/\d/i },
    { name: '에브리타임', re: /everytime/i },
    { name: '밴드', re: /\bBAND\//i },
    { name: '인앱 브라우저', re: /;\s*wv\)/i }
  ];

  function inAppName(ua) {
    var s = String(ua || (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '');
    for (var i = 0; i < IN_APP_SIGNATURES.length; i++) {
      if (IN_APP_SIGNATURES[i].re.test(s)) return IN_APP_SIGNATURES[i].name;
    }
    return '';
  }

  /* The host's name inside an in-app browser (truthy), false outside it — so
     both `if (isInAppBrowser())` and `isInAppBrowser() === '카카오톡'` read. */
  function isInAppBrowser(ua) {
    return inAppName(ua) || false;
  }

  var SHEETS = {
    exif: { title: 'EXIF 편집', kicker: 'EXIF METADATA' },
    geometry: { title: '프레임 · 여백', kicker: 'GEOMETRY & RATIO' },
    emblem: { title: '메이커 엠블럼', kicker: 'MAKER EMBLEMS' },
    export: { title: '내보내기', kicker: 'EXPORT ENGINE' }
  };

  var state = {
    photo: null,
    exifTags: null,
    fields: EX.templateFor(new Date()),
    style: PL.ORDER[0],
    emblemChoice: 'auto',
    autoEmblem: 'hd2lab',
    emblemMono: false,      // false — makers' own colours, true — All Black 단색
    geo: PL.defaults(PL.ORDER[0]),
    ratio: 0,
    font: 'sans',
    stock: 'KODAK PORTRA 400',
    frameNo: '#03',
    format: 'jpeg',
    quality: 95,
    bg: 'dark',
    zoom: 1,
    panX: 0, panY: 0,
    sampleIdx: 0,
    fitScale: 1,
    sheet: null,
    pane: 'exif',        // which inspector pane is on screen (always on PC, in the sheet on mobile)
    /* PC workspace: the photos opened together, or the folder a visitor picked.
       Everything stays local — handles and Files never leave this device. */
    ws: {
      open: false, fromFolder: false, name: '', entries: [], activeId: null,
      sort: 'name', collapsed: false, scanning: false, bulk: null
    },
    inApp: ''            // host name when the page runs inside a chat app's WebView
  };

  /* ── DOM ──────────────────────────────────────────────────────────────── */
  var el = {
    stage: $('#stage'),
    stageCanvas: $('#stageCanvas'),
    canvas: $('#plateCanvas'),
    empty: $('#emptyState'),
    photoChip: $('#photoChip'),
    styleChip: $('#styleChip'),
    renderChip: $('#renderChip'),
    zoomLabel: $('#zoomLabel'),
    fileInput: $('#fileInput'),
    dropzone: $('#dropzone'),
    sessionCard: $('#sessionCard'),
    sessionThumb: $('#sessionThumb'),
    metaName: $('#metaName'),
    metaSize: $('#metaSize'),
    metaBytes: $('#metaBytes'),
    metaExif: $('#metaExif'),
    strip: $('#frameStrip'),
    frameCount: $('#frameCount'),
    emblemGrid: $('#emblemGrid'),
    emblemMonoSeg: $('#emblemMonoSeg'),
    emblemHint: $('#emblemHint'),
    padRange: $('#padRange'), extraRange: $('#extraRange'), radiusRange: $('#radiusRange'),
    padVal: $('#padVal'), extraVal: $('#extraVal'), radiusVal: $('#radiusVal'),
    ratioSelect: $('#ratioSelect'),
    stockSelect: $('#stockSelect'),
    fontSelect: $('#fontSelect'),
    formatSeg: $('#formatSeg'),
    qualityRow: $('#qualityRow'),
    qualityRange: $('#qualityRange'),
    qualityVal: $('#qualityVal'),
    exportSize: $('#exportSize'),
    exportName: $('#exportName'),
    exportStyle: $('#exportStyle'),
    downloadBtn: $('#downloadBtn'),
    shareBtn: $('#shareBtn'),
    previewBtn: $('#previewBtn'),
    headerDownloadBtn: $('#headerDownloadBtn'),
    exportModal: $('#exportModal'),
    exportImg: $('#exportImg'),
    exportMeta: $('#exportMeta'),
    exportShare: $('#exportShare'),
    exportSave: $('#exportSave'),
    exportClose: $('#exportClose'),
    exportShot: $('#exportShot'),
    exportHintText: $('#exportHintText'),
    exportHint: $('#exportHint'),
    previewTip: $('#previewTip'),
    previewOverlay: $('#previewOverlay'),
    previewImg: $('#previewImg'),
    previewName: $('#previewName'),
    previewClose: $('#previewClose'),
    toasts: $('#toasts'),
    portalMenu: $('#portalMenu'),
    portalMenuBtn: $('#portalMenuBtn'),
    portalMenuDropdown: $('#portalMenuDropdown'),
    sheet: $('#sheet'),
    sheetBackdrop: $('#sheetBackdrop'),
    sheetTitle: $('#sheetTitle'),
    sheetKicker: $('#sheetKicker'),
    sheetClose: $('#sheetClose'),
    toolbar: $('#toolbar'),
    insTabs: $('#insTabs'),
    formatSegDock: $('#formatSegDock'),
    qualityRangeDock: $('#qualityRangeDock'),
    qualityValDock: $('#qualityValDock'),
    qualityRowDock: $('#qualityRowDock'),
    dockSaveBtn: $('#dockSaveBtn'),
    dockSize: $('#dockSize'),
    dockCount: $('#dockCount'),
    wsStrip: $('#wsStrip'),
    wsTrack: $('#wsTrack'),
    wsName: $('#wsName'),
    wsCount: $('#wsCount'),
    wsStatus: $('#wsStatus'),
    wsSort: $('#wsSort'),
    wsToggle: $('#wsToggle'),
    wsFileInput: $('#wsFileInput'),
    wsFolderInput: $('#wsFolderInput'),
    recursiveToggle: $('#recursiveToggle'),
    bulkBtn: $('#bulkBtn'),
    bulkLabel: $('#bulkLabel'),
    bulkStatus: $('#bulkStatus')
  };

  var FIELD_INPUTS = {
    make: $('#fMake'), model: $('#fModel'), lens: $('#fLens'), focal: $('#fFocal'),
    aperture: $('#fAperture'), shutter: $('#fShutter'), iso: $('#fIso'),
    datetime: $('#fDate'), caption: $('#fCaption')
  };

  /* ── toasts ───────────────────────────────────────────────────────────── */
  function toast(message, kind) {
    var d = document.createElement('div');
    d.className = 'toast' + (kind ? ' is-' + kind : '');
    var icon = kind === 'error' || kind === 'warn' ? 'i-info' : 'i-check';
    d.innerHTML = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#' + icon + '"/></svg><span></span>';
    d.lastChild.textContent = message;
    el.toasts.appendChild(d);
    while (el.toasts.children.length > 2) el.toasts.firstElementChild.remove();
    setTimeout(function () {
      d.classList.add('is-out');
      setTimeout(function () { d.remove(); }, 240);
    }, 3200);
  }

  /* ── in-app notice & address copy ─────────────────────────────────────── */
  /* A WebView that blocks the download cannot be talked into it, so the one
     thing worth offering there is the page's own address: copy it, paste it
     into a real browser, and the plate saves the normal way. */
  function copyLegacy(text) {
    var t = document.createElement('textarea');
    t.value = text;
    t.setAttribute('readonly', '');
    t.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:0;';
    document.body.appendChild(t);
    var ok = false;
    try {
      t.focus();
      t.select();
      t.setSelectionRange(0, t.value.length);
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    t.remove();
    return ok;
  }

  function copyUrl() {
    var url = location.href.split('#')[0];
    var report = function (ok) {
      if (ok) toast('주소를 복사했어요 — 브라우저에 붙여넣어 열어 주세요');
      else toast('주소를 복사하지 못했어요 — ' + url, 'warn');
    };
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(url).then(
        function () { report(true); },
        function () { report(copyLegacy(url)); }
      );
      return;
    }
    report(copyLegacy(url));
  }

  function paintInAppNotice() {
    var name = state.inApp;
    $$('[data-inapp-banner]').forEach(function (b) {
      b.hidden = !name;
      if (!name) return;
      $$('[data-inapp-name]', b).forEach(function (n) { n.textContent = name; });
    });
    $$('[data-copy-url]').forEach(function (b) {
      b.addEventListener('click', copyUrl);
    });
    if (!name) return;
    var card = $('.export-card');
    if (card) card.classList.add('is-inapp');
    if (el.previewTip) el.previewTip.textContent = '길게 눌러 ‘이미지 저장’을 고르면 사진 앨범에 들어갑니다';
    if (el.exportHint) {
      el.exportHint.textContent = name + '에서는 파일 저장이 막힙니다 · 미리보기를 길게 눌러 저장하거나 ⋯ → ‘다른 브라우저로 열기’로 크롬에서 저장해 주세요';
    }
  }

  /* ── emblems ──────────────────────────────────────────────────────────── */
  var INK = '#d9ded6', ACCENT = '#ff824f', BASE = '#121412';

  function emblemTile(id, name, inner) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'emblem-tile';
    b.dataset.emblem = id;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', 'false');
    b.innerHTML = '<span class="emblem-mark">' + inner + '</span><span class="emblem-name">' + name + '</span>';
    return b;
  }

  /* The tiles sit on the panel's dark ground, so they ask for the night value
     of each maker's colour — Samsung blue is lifted to #3B6BFF there — while
     All Black hands every tile the one panel ink. */
  function tileColors() {
    return { ink: INK, accent: ACCENT, base: BASE, light: false, mono: !!state.emblemMono };
  }

  function buildEmblems() {
    var auto = emblemTile('auto', 'Auto', '');
    auto.querySelector('.emblem-mark').innerHTML = EM.svg(state.autoEmblem, tileColors());
    el.emblemGrid.appendChild(auto);

    EM.list.forEach(function (e) {
      el.emblemGrid.appendChild(emblemTile(e.id, e.name, EM.svg(e.id, tileColors())));
    });

    var none = emblemTile('none', 'None', '<span style="font-family:var(--mono);font-size:16px;color:#6b746a">—</span>');
    el.emblemGrid.appendChild(none);

    $$('.emblem-tile', el.emblemGrid).forEach(function (tile) {
      tile.addEventListener('click', function () {
        state.emblemChoice = tile.dataset.emblem;
        syncEmblems();
        renderAll();
      });
    });
    syncEmblems();
  }

  function resolveEmblem() {
    return state.emblemChoice === 'auto' ? state.autoEmblem : state.emblemChoice;
  }

  function syncEmblems() {
    var colors = tileColors();
    $$('.emblem-tile', el.emblemGrid).forEach(function (t) {
      t.setAttribute('aria-checked', t.dataset.emblem === state.emblemChoice ? 'true' : 'false');
      var mark = $('.emblem-mark', t);
      var id = t.dataset.emblem;
      if (!mark) return;
      if (id === 'auto') mark.innerHTML = EM.svg(state.autoEmblem, colors);
      else if (id !== 'none') mark.innerHTML = EM.svg(id, colors);
    });
    $$('button', el.emblemMonoSeg).forEach(function (b) {
      b.setAttribute('aria-pressed', String((b.dataset.emblemMono === 'mono') === !!state.emblemMono));
    });
    var mode = state.emblemMono ? ' All Black — 한 가지 잉크로 인쇄합니다.' : '';
    el.emblemHint.textContent = (state.emblemChoice === 'auto'
      ? 'EXIF Make 기준 자동 선택 — 현재 ' + EM.get(state.autoEmblem).name
      : '수동 선택 — EXIF와 무관하게 고정됩니다.') + mode;
  }

  function setEmblemMono(on) {
    state.emblemMono = !!on;
    syncEmblems();
    renderAll();
  }

  /* ── fields ───────────────────────────────────────────────────────────── */
  function paintFields() {
    Object.keys(FIELD_INPUTS).forEach(function (k) {
      FIELD_INPUTS[k].value = state.fields[k] || '';
    });
  }

  function readField(key) {
    state.fields[key] = FIELD_INPUTS[key].value;
    if (key === 'make' || key === 'model') {
      state.autoEmblem = EM.fromMake(state.fields.make, state.fields.model);
      syncEmblems();
    }
    renderAll();
  }

  /* ── image plumbing ───────────────────────────────────────────────────── */
  function decodeImage(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.decoding = 'sync';
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('decode failed')); };
      img.src = url;
    });
  }

  function readAsDataURL(blob) {
    return new Promise(function (resolve, reject) {
      if (typeof FileReader !== 'function') { reject(new Error('no FileReader')); return; }
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result || '')); };
      fr.onerror = function () { reject(fr.error || new Error('read failed')); };
      fr.readAsDataURL(blob);
    });
  }

  function previewBitmap(img) {
    var maxEdge = 2200;
    var w = img.naturalWidth, h = img.naturalHeight;
    if (Math.max(w, h) <= maxEdge) return img;
    var k = maxEdge / Math.max(w, h);
    var c = document.createElement('canvas');
    c.width = Math.round(w * k);
    c.height = Math.round(h * k);
    var ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  function bytes(n) {
    if (!n && n !== 0) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
  }

  /* exifr wrapped once, so the studio and the workspace's batch export read
     the same tags the same way. */
  function readTags(file) {
    if (!window.exifr || !file) return Promise.resolve(null);
    var opts = {
      tiff: true, ifd0: true, exif: true, gps: false, interop: false,
      translateValues: true, reviveValues: true
    };
    return Promise.resolve(exifr.parse(file, opts)).then(
      function (t) { return t || null; },
      function () { return null; }
    );
  }

  async function loadFile(file, note, opts) {
    var isImage = /^image\//.test(file.type || '') || /\.(jpe?g|png|webp|avif|heic|heif)$/i.test(file.name || '');
    if (!isImage) {
      toast('이미지 파일이 아닙니다 — JPEG · PNG · WebP', 'error');
      return false;
    }
    /* A file opened on its own leaves the workspace; a step through the
       workspace keeps it. */
    if (!(opts && opts.keepWorkspace) && state.ws.open) wsClose();

    var url = URL.createObjectURL(file);
    var img = null;
    try {
      img = await decodeImage(url);
    } catch (e) {
      URL.revokeObjectURL(url);
      img = null;
    }
    if (!img) {
      /* A WebView that will not decode blob: still takes the same bytes inline,
         so the photo gets one more chance before we call it unreadable. */
      try {
        var inline = await readAsDataURL(file);
        img = await decodeImage(inline);
        url = inline;
      } catch (e2) {
        toast(state.inApp
          ? state.inApp + ' 안에서는 이 사진을 열 수 없어요 — 다른 브라우저로 열어 주세요'
          : '이 브라우저에서 열 수 없는 형식입니다', 'error');
        return false;
      }
    }

    var tags = await readTags(file);
    var count = tags ? EX.tagCount(tags) : 0;

    var parsed = EX.fromTags(tags || {});
    var hasCamera = !!(parsed.make || parsed.model);
    var fields;
    if (hasCamera) {
      fields = EX.merge(parsed, {});
      if (!fields.datetime) fields.datetime = EX.fmtDateTime(file.lastModified ? new Date(file.lastModified) : new Date());
    } else {
      fields = EX.templateFor(file.lastModified ? new Date(file.lastModified) : new Date());
    }

    if (state.photo && state.photo.objectUrl) URL.revokeObjectURL(state.photo.objectUrl);

    state.photo = {
      file: file,
      img: img,
      preview: previewBitmap(img),
      w: img.naturalWidth,
      h: img.naturalHeight,
      name: file.name || 'photo',
      bytes: file.size || 0,
      inline: url.indexOf('blob:') !== 0,          // decoded from inline bytes, not a blob URL
      objectUrl: url.indexOf('blob:') === 0 ? url : ''   // an inline data: URL needs no revoke
    };
    state.exifTags = tags;
    state.fields = fields;
    state.autoEmblem = EM.fromMake(fields.make, fields.model);
    state.frameNo = frameNumber(fields.datetime);
    state.zoom = 1; state.panX = 0; state.panY = 0;
    stripSrcCache = null;

    paintFields();
    syncEmblems();
    syncPhotoUI(count);
    renderAll();

    if (!(opts && opts.silent)) {
      toast((note ? note + ' · ' : '') + (hasCamera ? 'EXIF ' + count + '개 항목을 읽었습니다' : 'EXIF 없음 — 템플릿 값으로 시작합니다'));
    }
    return true;
  }

  function frameNumber(datetime) {
    var m = String(datetime || '').match(/(\d{1,2}):(\d{2})/);
    var n = m ? (parseInt(m[1], 10) * 60 + parseInt(m[2], 10)) % 36 + 1 : 3;
    return '#' + (n < 10 ? '0' + n : n);
  }

  function syncPhotoUI(tagCount) {
    var p = state.photo;
    if (!p) {
      el.empty.hidden = false;
      el.sessionCard.hidden = true;
      el.photoChip.lastElementChild.textContent = '사진 없음';
      el.downloadBtn.disabled = true;
      el.headerDownloadBtn.disabled = true;
      if (el.shareBtn) el.shareBtn.disabled = true;
      if (el.previewBtn) el.previewBtn.disabled = true;
      $('#resetMetaBtn').disabled = true;
      return;
    }
    el.empty.hidden = true;
    el.sessionCard.hidden = false;
    el.metaName.textContent = p.name;
    el.metaSize.textContent = p.w + ' × ' + p.h;
    el.metaBytes.textContent = bytes(p.bytes);
    el.metaExif.textContent = (tagCount || 0) + ' tags';
    el.photoChip.lastElementChild.textContent = p.w + ' × ' + p.h;
    el.downloadBtn.disabled = false;
    el.headerDownloadBtn.disabled = false;
    if (el.shareBtn) el.shareBtn.disabled = false;
    if (el.previewBtn) el.previewBtn.disabled = false;
    $('#resetMetaBtn').disabled = false;
    paintSessionThumb();
  }

  function paintSessionThumb() {
    var cv = el.sessionThumb;
    if (!cv) return;
    var size = 72, ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    if (!state.photo) return;
    var src = state.photo.preview;
    var w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
    var k = Math.max(size / w, size / h);
    var dw = w * k, dh = h * k;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, (size - dw) / 2, (size - dh) / 2, dw, dh);
  }

  async function loadSample() {
    var s = SAMPLES[state.sampleIdx % SAMPLES.length];
    state.sampleIdx++;
    try {
      var res = await fetch(s.file, { cache: 'force-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var blob = await res.blob();
      var file = new File([blob], s.file.split('/').pop(), { type: blob.type || 'image/jpeg' });
      await loadFile(file, s.label + ' 샘플');
    } catch (e) {
      toast('샘플을 불러오지 못했습니다 — 사진을 직접 선택해 주세요', 'error');
    }
  }

  function clearPhoto() {
    if (state.photo && state.photo.objectUrl) URL.revokeObjectURL(state.photo.objectUrl);
    state.photo = null;
    state.exifTags = null;
    state.fields = EX.templateFor(new Date());
    state.zoom = 1; state.panX = 0; state.panY = 0;
    stripSrcCache = null;
    wsClose();
    paintFields();
    syncPhotoUI(0);
    renderAll();
    toast('캔버스를 비웠습니다');
  }

  /* ── workspace (PC) ───────────────────────────────────────────────────────
     Photos opened together, or a folder read through the File System Access
     API. Entries keep the handles the browser handed us and are opened one by
     one; nothing is copied anywhere but this tab's memory. */
  function isPC() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1024px)').matches;
  }

  function isPhotoName(name) { return /\.(jpe?g|png|webp|avif|heic|heif)$/i.test(String(name || '')); }

  var entrySeq = 0;
  function newEntryId() { return 'e' + (++entrySeq); }

  function entryFromFile(file, path) {
    return {
      id: newEntryId(),
      name: file.name || path,
      path: path || file.name,
      getFile: function () { return Promise.resolve(file); },
      thumb: '', queued: false
    };
  }

  function entryFromHandle(handle, path) {
    var id = newEntryId();
    return {
      id: id,
      name: handle.name || path,
      path: path,
      getFile: function () { return handle.getFile(); },
      thumb: '', queued: false
    };
  }

  function byPath(a, b) { return a.path.localeCompare(b.path, undefined, { numeric: true }); }

  /* `<input multiple>` and the webkitdirectory fallback both land here. */
  function entriesFromFiles(files, recursive) {
    var out = [];
    Array.prototype.slice.call(files || []).forEach(function (file) {
      if (!isPhotoName(file.name)) return;
      var path = file.webkitRelativePath || file.name;
      /* webkitdirectory always hands over the subfolders too; with the option
         off only the picked folder's own photos are kept. */
      if (!recursive && path.split('/').length > 2) return;
      out.push(entryFromFile(file, path));
    });
    out.sort(byPath);
    return out;
  }

  function wsEntry(id) {
    for (var i = 0; i < state.ws.entries.length; i++) {
      if (state.ws.entries[i].id === id) return state.ws.entries[i];
    }
    return null;
  }

  function wsIndex() {
    for (var i = 0; i < state.ws.entries.length; i++) {
      if (state.ws.entries[i].id === state.ws.activeId) return i;
    }
    return -1;
  }

  function wsVisible() {
    var ws = state.ws;
    return ws.open && (ws.entries.length >= 2 || (ws.fromFolder && ws.entries.length >= 1));
  }

  function wsClose() {
    state.ws.open = false;
    state.ws.fromFolder = false;
    state.ws.name = '';
    state.ws.entries = [];
    state.ws.activeId = null;
    state.ws.sort = 'name';
    state.ws.scanning = false;
    state.ws.collapsed = false;
    if (el.wsTrack) el.wsTrack.textContent = '';
    if (thumbObserver && thumbObserver.disconnect) thumbObserver.disconnect();
    thumbQueue.length = 0;
    syncWsUI();
  }

  function syncWsUI() {
    var ws = state.ws;
    var idx = wsIndex();
    var show = wsVisible();
    if (el.wsStrip) el.wsStrip.hidden = !show;
    if (el.wsName) el.wsName.textContent = ws.name || '워크스페이스';
    if (el.wsCount) el.wsCount.textContent = (idx >= 0 ? idx + 1 : 0) + ' / ' + ws.entries.length;
    if (el.wsSort) el.wsSort.value = ws.sort;
    if (el.wsStrip) el.wsStrip.classList.toggle('is-collapsed', !!ws.collapsed);
    if (el.wsToggle) el.wsToggle.setAttribute('aria-expanded', ws.collapsed ? 'false' : 'true');
    if (el.wsTrack) {
      $$('.ws-item', el.wsTrack).forEach(function (n) {
        n.setAttribute('aria-selected', n.dataset.entry === ws.activeId ? 'true' : 'false');
      });
    }
    if (el.wsStatus) {
      el.wsStatus.hidden = !ws.scanning;
      if (ws.scanning) el.wsStatus.textContent = '목록 탐색 중…';
    }
    if (el.bulkBtn) {
      var multi = ws.entries.length >= 2;
      el.bulkBtn.hidden = !multi;
      el.bulkBtn.disabled = !!ws.bulk;
      if (multi && el.bulkLabel) el.bulkLabel.textContent = '전체 일괄 저장 (' + ws.entries.length + '장)';
    }
    if (el.dockCount) el.dockCount.textContent = show ? ((idx >= 0 ? idx + 1 : 0) + ' / ' + ws.entries.length) : '';
  }

  function scrollWsIntoView() {
    var track = el.wsTrack;
    if (!track) return;
    var item = $('.ws-item[aria-selected="true"]', track);
    if (!item) return;
    var r = item.getBoundingClientRect(), t = track.getBoundingClientRect();
    if (r.left < t.left || r.right > t.right) {
      track.scrollLeft += (r.left - t.left) - (t.width - r.width) / 2;
    }
  }

  function buildWsStrip() {
    if (!el.wsTrack) return;
    if (thumbObserver && thumbObserver.disconnect) thumbObserver.disconnect();
    thumbObserver = null;
    el.wsTrack.textContent = '';

    var frag = document.createDocumentFragment();
    state.ws.entries.forEach(function (entry) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ws-item';
      b.dataset.entry = entry.id;
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', entry.id === state.ws.activeId ? 'true' : 'false');
      b.setAttribute('aria-label', entry.name + ' 열기');
      b.title = entry.path;
      b.innerHTML = '<span class="ws-thumb"><img alt="" hidden /></span>' +
                    '<span class="ws-name"></span>';
      $('.ws-name', b).textContent = entry.name;
      if (entry.thumb) {
        var im = $('img', b);
        im.src = entry.thumb;
        im.hidden = false;
      }
      b.addEventListener('click', function () { selectEntry(entry.id); });
      frag.appendChild(b);
    });
    el.wsTrack.appendChild(frag);

    /* Only the thumbnails on screen are decoded — a folder of 800 photos must
       not cost 800 decodes before the first one shows. */
    if (typeof IntersectionObserver === 'function') {
      thumbObserver = new IntersectionObserver(function (rows) {
        rows.forEach(function (row) {
          if (!row.isIntersecting) return;
          var entry = wsEntry(row.target.dataset.entry);
          if (entry && !entry.thumb) queueThumb(entry);
        });
      }, { root: el.wsTrack, rootMargin: '240px' });
      $$('.ws-item', el.wsTrack).forEach(function (n) { thumbObserver.observe(n); });
    } else {
      state.ws.entries.forEach(queueThumb);
    }
  }

  var thumbQueue = [];
  var thumbBusy = false;
  var thumbObserver = null;

  function queueThumb(entry) {
    if (!entry || entry.thumb || entry.queued) return;
    entry.queued = true;
    thumbQueue.push(entry);
    pumpThumbs();
  }

  function pumpThumbs() {
    if (thumbBusy || !thumbQueue.length) return;
    thumbBusy = true;
    var entry = thumbQueue.shift();
    var next = function () {
      thumbBusy = false;
      setTimeout(pumpThumbs, 12);   // one decode at a time; yields between them
    };
    var drawn = function () { applyThumb(entry); next(); };
    Promise.resolve(entry.getFile()).then(function (file) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth || 1, h = img.naturalHeight || 1;
          var k = Math.min(1, 168 / Math.max(w, h));
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(w * k));
          c.height = Math.max(1, Math.round(h * k));
          var cx = c.getContext('2d');
          cx.imageSmoothingQuality = 'high';
          cx.drawImage(img, 0, 0, c.width, c.height);
          entry.thumb = c.toDataURL('image/jpeg', 0.72) || '';
        } catch (e) {
          entry.thumb = '';
        }
        URL.revokeObjectURL(url);
        drawn();
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        entry.thumb = '';
        drawn();
      };
      img.src = url;
    }, next);
  }

  function applyThumb(entry) {
    if (!el.wsTrack || !entry.thumb) return;
    var item = $('.ws-item[data-entry="' + entry.id + '"]', el.wsTrack);
    if (!item) return;
    var img = $('img', item);
    if (img) { img.src = entry.thumb; img.hidden = false; }
  }

  function wsOpen(entries, name, fromFolder) {
    state.ws.open = entries.length > 0;
    state.ws.fromFolder = !!fromFolder;
    state.ws.name = name || '';
    state.ws.entries = entries;
    state.ws.activeId = null;
    state.ws.sort = 'name';
    state.ws.collapsed = false;
    state.ws.scanning = false;
    buildWsStrip();
    syncWsUI();
    if (!entries.length) return Promise.resolve(false);
    return selectEntry(entries[0].id);
  }

  /* Selecting a photo re-reads its EXIF and repaints, but leaves the frame
     style, padding, ratio, typeface and emblem the visitor chose alone. */
  function selectEntry(id) {
    var entry = wsEntry(id);
    if (!entry) return Promise.resolve(false);
    state.ws.activeId = id;
    syncWsUI();
    scrollWsIntoView();
    return Promise.resolve(entry.getFile()).then(function (file) {
      return loadFile(file, entry.name, { silent: true, keepWorkspace: true });
    }).then(function (ok) {
      if (ok === false) toast('이 사진을 열지 못했습니다 — ' + entry.name, 'error');
      renderAll();
      return ok;
    }, function () {
      toast('이 사진을 열지 못했습니다 — ' + entry.name, 'error');
      return false;
    });
  }

  function stepEntry(delta) {
    if (state.ws.entries.length < 2) return Promise.resolve(false);
    var i = wsIndex();
    if (i < 0) i = 0;
    var next = Math.max(0, Math.min(state.ws.entries.length - 1, i + delta));
    if (next === i) return Promise.resolve(false);
    return selectEntry(state.ws.entries[next].id);
  }

  function sortWs(mode) {
    state.ws.sort = mode === 'reverse' ? 'reverse' : 'name';
    state.ws.entries.sort(function (a, b) {
      var c = byPath(a, b);
      return state.ws.sort === 'reverse' ? -c : c;
    });
    buildWsStrip();
    syncWsUI();
    scrollWsIntoView();
  }

  /* Photos picked together become a workspace; one photo is just a photo. */
  function openFiles(list) {
    var files = Array.prototype.slice.call(list || []);
    if (!files.length) return Promise.resolve(false);
    if (files.length === 1) {
      if (state.ws.open) wsClose();
      return loadFile(files[0]);
    }
    if (!isPC()) {
      /* The workspace strip lives on the wide layout; on a phone the first
         photo opens the usual way and the rest are left where they are. */
      toast('여러 장 보기는 PC 화면에서 열립니다 — 첫 장을 열었습니다', 'warn');
      return loadFile(files[0]);
    }
    var entries = entriesFromFiles(files, true);
    if (!entries.length) {
      toast('불러올 사진이 없습니다 — JPEG · PNG · WebP', 'error');
      return Promise.resolve(false);
    }
    var rel = (files[0] && files[0].webkitRelativePath) || '';
    var name = rel ? rel.split('/')[0] : '여러 장 · ' + entries.length + '장';
    return wsOpen(entries, name, false).then(function () {
      toast(entries.length + '장을 열었습니다 — ←/→ 로 넘겨 보세요');
      return true;
    });
  }

  function openFolder() {
    var recursive = !!(el.recursiveToggle && el.recursiveToggle.checked);
    if (typeof window.showDirectoryPicker === 'function') {
      var pick = null;
      try { pick = window.showDirectoryPicker({ mode: 'read' }); } catch (e) { pick = null; }
      if (pick && typeof pick.then === 'function') {
        pick.then(function (handle) {
          return scanAndOpen(handle, recursive);
        }, function (err) {
          if (err && (err.name === 'AbortError' || err.code === 20)) return;   // dismissed, stay quiet
          if (el.wsFolderInput) el.wsFolderInput.click();
        });
        return;
      }
    }
    /* Browser without the File System Access API: the directory input opens
       the same picker and yields the files with their relative paths. */
    if (el.wsFolderInput) el.wsFolderInput.click();
  }

  function scanAndOpen(handle, recursive) {
    state.ws.open = true;
    state.ws.fromFolder = true;
    state.ws.name = handle.name || 'Workspace';
    state.ws.entries = [];
    state.ws.activeId = null;
    state.ws.sort = 'name';
    state.ws.collapsed = false;
    state.ws.scanning = true;
    buildWsStrip();
    syncWsUI();
    var lastBuild = 0;
    return scanDirectory(handle, !!recursive, '', function (entry) {
      state.ws.entries.push(entry);
      if (state.ws.entries.length - lastBuild >= 24) {   // show the list as it fills
        lastBuild = state.ws.entries.length;
        state.ws.entries.sort(byPath);
        buildWsStrip();
        syncWsUI();
      }
    }).then(function () {
      state.ws.scanning = false;
      state.ws.entries.sort(byPath);
      buildWsStrip();
      syncWsUI();
      if (!state.ws.entries.length) {
        toast('이 폴더에 불러올 사진이 없습니다', 'warn');
        return false;
      }
      return selectEntry(state.ws.entries[0].id).then(function () {
        toast(state.ws.name + ' · 사진 ' + state.ws.entries.length + '장을 열었습니다');
        return true;
      });
    }, function () {
      state.ws.scanning = false;
      syncWsUI();
      toast('폴더를 읽지 못했습니다 — 다시 선택해 주세요', 'error');
      return false;
    });
  }

  async function scanDirectory(handle, recursive, prefix, onEntry) {
    var it = handle.values();
    var res = await it.next();
    while (!res.done) {
      var child = res.value;
      var path = prefix + child.name;
      if (child.kind === 'file' && isPhotoName(child.name)) {
        onEntry(entryFromHandle(child, path));
      } else if (child.kind === 'directory' && recursive) {
        await scanDirectory(child, true, path + '/', onEntry);
      }
      res = await it.next();
    }
  }

  /* ── batch export ────────────────────────────────────────────────────── */
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function canvasBlob(canvas, mime, quality) {
    return new Promise(function (resolve) {
      if (!canvas || !canvas.toBlob) { resolve(null); return; }
      try {
        canvas.toBlob(function (b) { resolve(b || null); }, mime, quality);
      } catch (e) { resolve(null); }
    });
  }

  /* ── export resolution ──────────────────────────────────────────────────
     A plate leaves at the photo's own resolution: a 6000×4000 frame becomes a
     6000×4000 JPEG, because a print only ever holds the pixels it was given.
     Only a device that cannot hold that many pixels steps down, and only as
     far as it must. iOS Safari refuses a canvas allocation by total area
     without raising: the canvas keeps a stale width, getContext() comes back
     null, or toBlob hands over null / 0 bytes. So each rung is judged by what
     it actually produced, never by whether it was asked. */
  function exportRungs(L) {
    var native = Math.max(L.W, L.H);
    var rungs = [0];                 // 0 — the frame's own 1:1 pixel size
    FALLBACK_EDGES.forEach(function (edge) {
      if (edge < native) rungs.push(edge);
    });
    return rungs;
  }

  function paintPlateCanvas(L, edge) {
    var k = edge ? Math.min(1, edge / Math.max(L.W, L.H)) : 1;
    var ow = Math.max(1, Math.round(L.W * k));
    var oh = Math.max(1, Math.round(L.H * k));
    var off = document.createElement('canvas');
    off.width = ow;
    off.height = oh;
    if (off.width !== ow || off.height !== oh) return null;    // allocation refused
    var ctx = null;
    try { ctx = off.getContext('2d'); } catch (e) { ctx = null; }
    if (!ctx) return null;
    try {
      ctx.fillStyle = L.colors.base;
      ctx.fillRect(0, 0, ow, oh);
      if (k !== 1) ctx.setTransform(k, 0, 0, k, 0, 0);
      PL.paint(ctx, L);
    } catch (e) {
      return null;                                             // the paint died
    }
    return { canvas: off, w: ow, h: oh, k: k, edge: edge || 0 };
  }

  /* The first rung that yields real bytes wins. A reduced rung carries the
     edge it was reduced to, so the studio can say what it saved. */
  function encodePlate(L, mime, quality) {
    var rungs = exportRungs(L);
    var i = 0;
    function attempt() {
      if (i >= rungs.length) return Promise.resolve(null);
      var edge = rungs[i++];
      var job = paintPlateCanvas(L, edge);
      if (!job) return attempt();
      return canvasBlob(job.canvas, mime, quality).then(function (blob) {
        if (!blob || !blob.size) {
          job.canvas.width = 0;
          job.canvas.height = 0;          // hand the pixels back before the next rung
          return attempt();
        }
        job.blob = blob;
        job.reduced = !!edge;
        job.reducedEdge = edge ? Math.max(job.w, job.h) : 0;
        job.attempts = i;
        return job;
      }, function () { return attempt(); });
    }
    return attempt();
  }

  function saveBlob(blob, name) {
    if (!blob) return false;
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 12000);
    return true;
  }

  /* One plate for one file, painted with *this* file's EXIF and the frame the
     visitor has chosen — the same geometry the live preview uses. */
  function plateJobForFile(file) {
    var url = URL.createObjectURL(file);
    var release = function () { try { URL.revokeObjectURL(url); } catch (e) { /* noop */ } };
    return decodeImage(url).then(function (img) { return img; }, function () {
      return readAsDataURL(file).then(decodeImage);
    }).then(function (img) {
      if (!img) { release(); return null; }
      return readTags(file).then(function (tags) {
        var parsed = EX.fromTags(tags || {});
        var stamp = file.lastModified ? new Date(file.lastModified) : new Date();
        var fields = (parsed.make || parsed.model)
          ? EX.merge(parsed, {})
          : EX.templateFor(stamp);
        if (!fields.datetime) fields.datetime = EX.fmtDateTime(stamp);
        var emblem = state.emblemChoice === 'auto'
          ? EM.fromMake(fields.make, fields.model)
          : state.emblemChoice;
        var L = PL.layout({ w: img.naturalWidth, h: img.naturalHeight, img: img }, {
          style: state.style, fields: fields, emblem: emblem, emblemMono: state.emblemMono,
          padPct: state.geo.padPct, extraPct: state.geo.extraPct, radiusPct: state.geo.radiusPct,
          ratio: state.ratio, font: state.font, stock: state.stock,
          frameNo: frameNumber(fields.datetime)
        });
        var png = state.format === 'png';
        /* same contract as the single save: 1:1 first, the ladder only if the
           device refuses the pixels */
        return encodePlate(L, png ? 'image/png' : 'image/jpeg', state.quality / 100)
          .then(function (job) {
            release();
            if (!job) return null;
            job.mime = png ? 'image/png' : 'image/jpeg';
            job.ext = png ? 'png' : 'jpg';
            job.name = EX.fileName(fields, job.ext);
            return job;
          });
      });
    }).catch(function () { release(); return null; });
  }

  async function bulkExport() {
    var ws = state.ws;
    if (ws.bulk || ws.entries.length < 2) return null;
    var total = ws.entries.length, saved = 0, failed = 0, reduced = 0;
    ws.bulk = { total: total, saved: 0 };
    var say = function (text) {
      if (!el.bulkStatus) return;
      el.bulkStatus.hidden = false;
      el.bulkStatus.textContent = text;
    };
    syncWsUI();
    say('0 / ' + total + ' · 저장 준비…');
    for (var i = 0; i < total; i++) {
      var entry = ws.entries[i];
      say((i + 1) + ' / ' + total + ' · ' + entry.name);
      try {
        var file = await entry.getFile();
        var job = await plateJobForFile(file);
        if (!job) {
          failed++;
        } else {
          if (job.reduced) {
            reduced++;
            say((i + 1) + ' / ' + total + ' · ' + entry.name +
              ' · 기기 메모리 제한으로 ' + job.reducedEdge + 'px');
          }
          if (saveBlob(job.blob, job.name)) {
            saved++;
            window.__lastExport = {
              name: job.name, bytes: job.blob.size, w: job.w, h: job.h,
              format: job.ext === 'png' ? 'png' : 'jpeg', style: state.style,
              reducedEdge: job.reducedEdge || 0
            };
          } else {
            failed++;
          }
        }
      } catch (e) {
        failed++;
      }
      ws.bulk.saved = saved;
      await sleep(180);   // one download at a time, and the UI keeps breathing
    }
    ws.bulk = null;
    syncWsUI();
    say(saved + ' / ' + total + '장 저장 완료' + (failed ? ' · ' + failed + '장 실패' : '')
      + (reduced ? ' · ' + reduced + '장은 기기 메모리 제한으로 축소' : ''));
    setTimeout(function () {
      if (el.bulkStatus && !state.ws.bulk) el.bulkStatus.hidden = true;
    }, 6000);
    toast(saved
      ? saved + '장을 저장했습니다' + (failed ? ' · ' + failed + '장 실패' : '')
        + (reduced ? ' · ' + reduced + '장은 기기 메모리 제한으로 축소 저장' : '')
      : '일괄 저장에 실패했습니다', saved ? (reduced ? 'warn' : '') : 'error');
    return { saved: saved, failed: failed, total: total, reduced: reduced };
  }

  /* ── placeholder art (so the strip previews before a photo arrives) ────── */
  var placeholderCanvas = null;
  function placeholderSource() {
    if (placeholderCanvas) return placeholderCanvas;
    var W = 900, H = 600;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var ctx = c.getContext('2d');

    var sky = ctx.createLinearGradient(0, 0, 0, H * 0.72);
    sky.addColorStop(0, '#f2c78d');
    sky.addColorStop(0.55, '#e9a273');
    sky.addColorStop(1, '#b87558');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    var g = ctx.createRadialGradient(W * 0.68, H * 0.46, 0, W * 0.68, H * 0.46, H * 0.2);
    g.addColorStop(0, 'rgba(255,245,220,0.95)');
    g.addColorStop(1, 'rgba(255,226,180,0)');
    ctx.fillStyle = g;
    ctx.fillRect(W * 0.4, H * 0.1, W * 0.56, H * 0.6);
    ctx.fillStyle = '#fff4d8';
    ctx.beginPath();
    ctx.arc(W * 0.68, H * 0.46, H * 0.075, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#7d6a5e';
    ctx.beginPath();
    ctx.moveTo(-10, H * 0.78);
    ctx.lineTo(W * 0.2, H * 0.46);
    ctx.lineTo(W * 0.44, H * 0.8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#5d5248';
    ctx.beginPath();
    ctx.moveTo(W * 0.28, H * 0.82);
    ctx.lineTo(W * 0.56, H * 0.52);
    ctx.lineTo(W * 0.96, H * 0.86);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#3f4034';
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, H * 0.82);
    ctx.lineTo(W * 0.32, H * 0.7);
    ctx.lineTo(W * 0.68, H * 0.9);
    ctx.lineTo(W, H * 0.78);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(28,30,24,0.55)';
    ctx.fillRect(0, H * 0.94, W, H * 0.06);

    placeholderCanvas = c;
    return c;
  }

  var stripSrcCache = null;
  function stripSource() {
    if (stripSrcCache) return stripSrcCache;
    var target = state.photo ? state.photo.preview : placeholderSource();
    var w = target.naturalWidth || target.width;
    var h = target.naturalHeight || target.height;
    var maxEdge = 440;
    var k = Math.min(1, maxEdge / Math.max(w, h));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(h * k));
    var ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(target, 0, 0, c.width, c.height);
    c.__w = w; c.__h = h;
    stripSrcCache = c;
    return c;
  }

  /* ── layout / render ──────────────────────────────────────────────────── */
  function layoutFor(img, w, h, styleId) {
    return PL.layout({ w: w, h: h, img: img }, {
      style: styleId || state.style,
      fields: state.fields,
      emblem: resolveEmblem(),
      emblemMono: state.emblemMono,
      padPct: state.geo.padPct,
      extraPct: state.geo.extraPct,
      radiusPct: state.geo.radiusPct,
      ratio: state.ratio,
      font: state.font,
      stock: state.stock,
      frameNo: state.frameNo
    });
  }

  function currentLayout() {
    var p = state.photo;
    if (!p) return null;
    return layoutFor(p.preview, p.w, p.h);
  }

  function render() {
    var L = currentLayout();
    var cw = el.stageCanvas.clientWidth;
    var ch = el.stageCanvas.clientHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    if (el.canvas.width !== Math.round(cw * dpr) || el.canvas.height !== Math.round(ch * dpr)) {
      el.canvas.width = Math.round(cw * dpr);
      el.canvas.height = Math.round(ch * dpr);
    }
    var ctx = el.canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    if (L && cw > 0 && ch > 0) {
      var pad = cw < 520 ? 16 : 40;
      var fit = Math.min((cw - pad) / L.W, (ch - pad) / L.H);
      state.fitScale = fit;
      var s = fit * state.zoom;
      var limitX = Math.max(0, (L.W * s - cw) / 2) + 48;
      var limitY = Math.max(0, (L.H * s - ch) / 2) + 48;
      state.panX = Math.max(-limitX, Math.min(limitX, state.panX));
      state.panY = Math.max(-limitY, Math.min(limitY, state.panY));
      var x = cw / 2 - (L.W * s) / 2 + state.panX;
      var y = ch / 2 - (L.H * s) / 2 + state.panY;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.shadowColor = state.bg === 'dark' ? 'rgba(0,0,0,0.62)' : 'rgba(30,36,28,0.22)';
      ctx.shadowBlur = L.W * 0.02;
      ctx.shadowOffsetY = L.W * 0.005;
      ctx.fillStyle = L.colors.base;
      PL.helpers.roundRect(ctx, 0, 0, L.W, L.H, L.radius);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      PL.paint(ctx, L);
      ctx.restore();

      el.zoomLabel.textContent = state.zoom === 1 ? '맞춤' : '×' + state.zoom.toFixed(1);
    }
    updateReadout(L);
  }

  /* ── frame strip thumbnails ───────────────────────────────────────────── */
  var stripCanvases = [];
  var stripTimer = 0;

  function buildStrip() {
    el.frameCount.textContent = String(PL.ORDER.length);
    PL.ORDER.forEach(function (id) {
      var S = PL.STYLES[id];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'frame-card';
      b.dataset.style = id;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');
      b.setAttribute('aria-label', S.label + ' — ' + S.tag);
      b.innerHTML =
        '<span class="frame-thumb"><canvas aria-hidden="true"></canvas></span>' +
        '<span class="frame-foot">' +
          '<span class="frame-name">' + S.label + '</span>' +
          '<span class="frame-badge">' + S.tag + '</span>' +
        '</span>';
      el.strip.appendChild(b);
      stripCanvases.push($('canvas', b));
    });
  }

  function paintStrip() {
    var src = stripSource();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    PL.ORDER.forEach(function (id, i) {
      var cv = stripCanvases[i];
      if (!cv) return;
      var rect = cv.getBoundingClientRect();
      var cw = Math.round(rect.width) || 116;
      var chh = Math.round(rect.height) || 70;
      if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(chh * dpr)) {
        cv.width = Math.round(cw * dpr);
        cv.height = Math.round(chh * dpr);
      }
      var ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, chh);

      var L = PL.layout({ w: src.__w, h: src.__h, img: src }, {
        style: id,
        fields: state.fields,
        emblem: resolveEmblem(),
        font: state.font,
        stock: state.stock,
        frameNo: state.frameNo
      });
      var s = Math.min(cw / L.W, chh / L.H) * 0.94;
      ctx.save();
      ctx.translate((cw - L.W * s) / 2, (chh - L.H * s) / 2);
      ctx.scale(s, s);
      ctx.fillStyle = L.colors.base;
      PL.helpers.roundRect(ctx, 0, 0, L.W, L.H, L.radius);
      ctx.fill();
      PL.paint(ctx, L);
      ctx.restore();
    });
  }

  function scheduleStrip() {
    if (stripTimer) clearTimeout(stripTimer);
    stripTimer = setTimeout(function () {
      stripTimer = 0;
      paintStrip();
    }, 140);
  }

  var raf = 0;
  function renderAll() {
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      render();
    });
    scheduleStrip();
  }

  function updateReadout(L) {
    el.styleChip.textContent = PL.STYLES[state.style].label.toUpperCase();
    el.exportStyle.textContent = PL.STYLES[state.style].label;
    if (!L) {
      el.renderChip.textContent = '—';
      el.exportSize.textContent = '—';
      el.exportName.textContent = '—';
      if (el.dockSize) el.dockSize.textContent = '—';
      if (el.dockSaveBtn) el.dockSaveBtn.disabled = true;
      return;
    }
    /* 1:1 — the frame is the photo plus its borders, so this is exactly what
       the file will measure unless the device has to step down. */
    var ow = L.W, oh = L.H;
    el.renderChip.textContent = ow + ' × ' + oh;
    el.exportSize.textContent = ow + ' × ' + oh + ' px';
    el.exportName.textContent = EX.fileName(state.fields, state.format === 'png' ? 'png' : 'jpg');
    if (el.dockSize) el.dockSize.textContent = ow + ' × ' + oh + ' px';
    if (el.dockSaveBtn) el.dockSaveBtn.disabled = false;
  }

  /* ── export ───────────────────────────────────────────────────────────── */
  /* One render, three doors — the photo album, the file system, a full-screen
     look. iOS only lets a page open the share sheet from a live tap, so a
     prepared file is cached and handed over inside the click; when the cache
     is stale the result card opens and carries its own share button, which is
     a fresh tap again. */
  var prepared = null;

  function canShareFiles() {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' ||
        typeof navigator.canShare !== 'function') return false;
    try {
      if (typeof File !== 'function') return false;
      var probe = new File(['probe'], 'probe.jpg', { type: 'image/jpeg' });
      return !!navigator.canShare({ files: [probe] });
    } catch (e) {
      return false;
    }
  }

  function canShareThis(p) {
    if (!p || !p.file || typeof navigator.share !== 'function') return false;
    if (typeof navigator.canShare !== 'function') return true;
    try { return !!navigator.canShare({ files: [p.file] }); } catch (e) { return false; }
  }

  function shareCancelled(err) {
    if (!err) return false;
    var name = err.name || '';
    var msg = String(err.message || '').toLowerCase();
    return name === 'AbortError' || err.code === 20 ||
      msg.indexOf('abort') >= 0 || msg.indexOf('cancel') >= 0;
  }

  /* Everything that changes the bitmap — a prepared file only counts while it
     still matches what the sheet says it will save. */
  function exportSignature() {
    return [state.style, state.format, state.quality, state.ratio, state.font, state.stock,
      state.emblemChoice, resolveEmblem(), state.emblemMono ? 'mono' : 'color',
      state.geo.padPct, state.geo.extraPct, state.geo.radiusPct,
      state.fields.make, state.fields.model, state.fields.lens, state.fields.focal,
      state.fields.aperture, state.fields.shutter, state.fields.iso,
      state.fields.datetime, state.fields.caption,
      state.photo ? state.photo.name : ''].join('|');
  }

  function lockExport(busy) {
    el.downloadBtn.disabled = !!busy || !state.photo;
    el.headerDownloadBtn.disabled = !!busy || !state.photo;
    if (el.shareBtn) el.shareBtn.disabled = !!busy || !state.photo;
    if (el.previewBtn) el.previewBtn.disabled = !!busy || !state.photo;
  }

  function prepareExport() {
    if (!state.photo) return Promise.resolve(null);
    var sig = exportSignature();
    if (prepared && prepared.signature === sig) return Promise.resolve(prepared);

    var p = state.photo;
    var L = layoutFor(p.img, p.w, p.h);      // the photo's own bitmap, 1:1
    var format = state.format === 'png' ? 'png' : 'jpeg';
    var mime = format === 'png' ? 'image/png' : 'image/jpeg';
    var name = EX.fileName(state.fields, format === 'png' ? 'png' : 'jpg');
    lockExport(true);

    /* The data URL is prepared alongside the blob: in-app browsers refuse a
       blob: download, and the result card's long-press save needs an <img>
       source the WebView will actually render. */
    return encodePlate(L, mime, state.quality / 100).then(function (job) {
      lockExport(false);
      if (!job) {
        toast('내보내기에 실패했습니다 — 사진 크기를 줄여 보세요', 'error');
        return null;
      }
      return readAsDataURL(job.blob).then(
        function (dataUrl) { return dataUrl; },
        function () { return ''; }
      ).then(function (dataUrl) {
        var file = null;
        try {
          file = new File([job.blob], name, {
            type: job.blob.type || mime, lastModified: Date.now()
          });
        } catch (e) {
          file = job.blob;
        }
        if (prepared && prepared.url) URL.revokeObjectURL(prepared.url);
        prepared = {
          blob: job.blob, file: file, url: URL.createObjectURL(job.blob),
          dataUrl: dataUrl || '',      // the same bytes inline: what a WebView can take
          name: name, bytes: job.blob.size, w: job.w, h: job.h,
          format: format, style: state.style, signature: sig,
          reducedEdge: job.reducedEdge || 0   // 0 — saved at the photo's own size
        };
        window.__lastExport = {
          name: name, bytes: job.blob.size, w: job.w, h: job.h,
          format: format, style: state.style, reducedEdge: job.reducedEdge || 0
        };
        return prepared;
      });
    });
  }

  /* Normal browsers keep the blob: download; a chat-app WebView is handed the
     data URL, which is the only form some of them will consider at all. */
  function saveFile(p) {
    if (!p) return false;
    var inline = !!(state.inApp && p.dataUrl);
    var made = false;
    var href = inline ? p.dataUrl : (p.url || ((made = true), URL.createObjectURL(p.blob)));
    var a = document.createElement('a');
    a.href = href;
    a.download = p.name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (made) setTimeout(function () { URL.revokeObjectURL(href); }, 12000);
    return true;
  }

  /* What the result card and the full-screen look should show: inline bytes in
     an in-app browser (long-press must find a real image), blob elsewhere. */
  function exportSrc(p) {
    if (!p) return '';
    return (state.inApp && p.dataUrl) ? p.dataUrl : p.url;
  }

  /* Must stay synchronous up to navigator.share() so the tap still counts. */
  function shareNow(p) {
    if (!canShareThis(p)) {
      saveFile(p);
      toast('이 브라우저는 공유 시트가 없어 파일로 저장했습니다', 'warn');
      return Promise.resolve({ shared: false, fallback: true });
    }
    var data = {
      files: [p.file],
      title: p.name,
      text: 'HD2Lab Shutterplate로 만든 플레이트'
    };
    var call;
    try {
      call = navigator.share(data);
    } catch (err) {
      if (shareCancelled(err)) return Promise.resolve({ shared: false, cancelled: true });
      saveFile(p);
      toast('공유 시트를 열지 못해 파일로 저장했습니다', 'warn');
      return Promise.resolve({ shared: false, fallback: true });
    }
    return Promise.resolve(call).then(function () {
      if (p.reducedEdge) {
        toast('기기 메모리 제한으로 ' + p.reducedEdge + 'px로 안전 저장했습니다', 'warn');
      }
      toast('공유 시트에서 ‘이미지 저장’을 고르면 사진 앨범에 들어갑니다');
      return { shared: true };
    }, function (err) {
      if (shareCancelled(err)) return { shared: false, cancelled: true };  // natural dismissal, stay quiet
      saveFile(p);
      toast('공유 시트를 열지 못해 파일로 저장했습니다', 'warn');
      return { shared: false, fallback: true };
    });
  }

  function downloadPlate() {
    return prepareExport().then(function (p) {
      if (!p) return null;
      saveFile(p);
      /* A file that had to step down says so: the visitor should know why the
         pixels are fewer than the photo they handed over. */
      if (p.reducedEdge) {
        toast('기기 메모리 제한으로 ' + p.reducedEdge + 'px로 안전 저장했습니다', 'warn');
      }
      if (state.inApp) {
        /* The WebView may swallow that tap without a word, so the card with the
           inline preview opens right behind it — long-press is the way out. */
        openExportCard(p);
      } else if (!p.reducedEdge) {
        toast(p.w + ' × ' + p.h + ' · ' + bytes(p.bytes) + ' 파일 저장');
      }
      return p;
    });
  }

  function exportPlate() {
    if (!state.photo) { toast('먼저 사진을 불러와 주세요', 'warn'); return Promise.resolve(null); }
    if (!canShareFiles()) return downloadPlate();
    var sig = exportSignature();
    if (prepared && prepared.signature === sig) return Promise.resolve(shareNow(prepared));
    return prepareExport().then(function (p) {
      if (p) openExportCard(p);
      return p;
    });
  }

  function sharePlate() {
    if (!state.photo) { toast('먼저 사진을 불러와 주세요', 'warn'); return Promise.resolve(null); }
    var sig = exportSignature();
    if (prepared && prepared.signature === sig && canShareThis(prepared)) {
      return Promise.resolve(shareNow(prepared));
    }
    return prepareExport().then(function (p) {
      if (p) openExportCard(p);
      return p;
    });
  }

  function openPreview() {
    return prepareExport().then(function (p) {
      if (!p) return null;
      openExportCard(p);
      return p;
    });
  }

  /* ── result card + full-screen preview ────────────────────────────────── */
  function openExportCard(p) {
    if (p) {
      el.exportImg.src = exportSrc(p);
      el.exportMeta.textContent = p.name + ' · ' + p.w + ' × ' + p.h + ' px · ' +
        bytes(p.bytes) + ' · ' + (p.format === 'png' ? 'PNG' : 'JPEG');
    }
    var shareable = canShareThis(p) && !state.inApp;
    el.exportShare.hidden = !shareable;
    if (state.inApp) {
      el.exportHintText.textContent = '파일이 저장되지 않으면 미리보기를 길게 눌러 ‘이미지 저장’을 고르세요.';
    } else {
      el.exportHintText.textContent = shareable
        ? '‘사진 앨범에 저장 / 공유’를 누르고 공유 시트에서 ‘이미지 저장’을 고르면 앨범에 들어갑니다. 미리보기를 길게 눌러 저장할 수도 있습니다.'
        : '이 브라우저는 공유 시트를 지원하지 않아 파일로 저장합니다. 미리보기를 길게 눌러 사진 앱에 저장할 수도 있습니다.';
    }
    el.exportModal.classList.add('is-open');
    el.exportModal.setAttribute('aria-hidden', 'false');
    el.exportClose.focus({ preventScroll: true });
  }

  function closeExportCard() {
    el.exportModal.classList.remove('is-open');
    el.exportModal.setAttribute('aria-hidden', 'true');
  }

  function openPreviewOverlay() {
    if (!prepared) return;
    el.previewImg.src = exportSrc(prepared);
    el.previewName.textContent = prepared.name + ' · ' + prepared.w + ' × ' + prepared.h;
    el.previewOverlay.classList.add('is-open');
    el.previewOverlay.setAttribute('aria-hidden', 'false');
    closeExportCard();
    el.previewClose.focus({ preventScroll: true });
  }

  function closePreviewOverlay() {
    el.previewOverlay.classList.remove('is-open');
    el.previewOverlay.setAttribute('aria-hidden', 'true');
  }

  /* ── UI sync ──────────────────────────────────────────────────────────── */
  function syncStyleUI() {
    $$('.frame-card', el.strip).forEach(function (c) {
      c.setAttribute('aria-checked', c.dataset.style === state.style ? 'true' : 'false');
    });
  }

  function syncGeoUI() {
    el.padRange.value = state.geo.padPct;
    el.extraRange.value = state.geo.extraPct;
    el.radiusRange.value = state.geo.radiusPct;
    el.padVal.textContent = state.geo.padPct + '%';
    el.extraVal.textContent = state.geo.extraPct + '%';
    el.radiusVal.textContent = state.geo.radiusPct + '%';
    el.ratioSelect.value = String(state.ratio);
  }

  function syncExportUI() {
    $$('button', el.formatSeg).forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.format === state.format ? 'true' : 'false');
    });
    if (el.formatSegDock) {
      $$('button', el.formatSegDock).forEach(function (b) {
        b.setAttribute('aria-pressed', b.dataset.format === state.format ? 'true' : 'false');
      });
    }
    el.qualityRow.hidden = state.format !== 'jpeg';
    if (el.qualityRowDock) el.qualityRowDock.hidden = state.format !== 'jpeg';
    el.qualityVal.textContent = state.quality;
    el.qualityRange.value = state.quality;
    if (el.qualityValDock) el.qualityValDock.textContent = state.quality;
    if (el.qualityRangeDock) el.qualityRangeDock.value = state.quality;
    if (el.shareBtn) el.shareBtn.hidden = !canShareFiles();
    if (el.dockSaveBtn) el.dockSaveBtn.disabled = !state.photo;
  }

  function setStyle(style, resetGeo) {
    if (!PL.STYLES[style]) return;
    state.style = style;
    if (resetGeo !== false) {
      state.geo = PL.defaults(style);
      syncGeoUI();
    }
    syncStyleUI();
    renderAll();
  }

  /* ── sheet / inspector ────────────────────────────────────────────────── */
  /* One control panel, two geometries: on a phone it is the bottom sheet the
     toolbar raises; from 1024px the same panel is the fixed right inspector,
     always on screen, with its own tab row and the export dock at the foot. */
  function setPane(name) {
    if (!SHEETS[name]) return;
    state.pane = name;
    el.sheetTitle.textContent = SHEETS[name].title;
    el.sheetKicker.textContent = SHEETS[name].kicker;
    $$('.pane', el.sheet).forEach(function (p) {
      p.classList.toggle('is-active', p.dataset.pane === name);
    });
    el.sheet.setAttribute('data-active', name);
    if (el.insTabs) {
      $$('[data-tab]', el.insTabs).forEach(function (b) {
        var on = b.dataset.tab === name;
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      });
    }
    if (name === 'export' && state.photo && !isPC()) prepareExport();   // warm the share-tap cache
  }

  function openSheet(name) {
    if (!SHEETS[name]) return;
    setPane(name);
    if (isPC()) return;                      // the inspector is already on screen
    state.sheet = name;
    el.sheet.classList.add('is-open');
    el.sheetBackdrop.classList.add('is-open');
    el.sheet.setAttribute('aria-hidden', 'false');
    $$('[data-sheet]', el.toolbar).forEach(function (b) {
      b.setAttribute('aria-expanded', b.dataset.sheet === name ? 'true' : 'false');
    });
    if (name === 'export' && state.photo) prepareExport();   // warm the share-tap cache
    el.sheetClose.focus({ preventScroll: true });
  }

  function closeSheet(restoreFocus) {
    if (isPC()) return;
    if (!state.sheet) return;
    var last = state.sheet;
    state.sheet = null;
    el.sheet.classList.remove('is-open');
    el.sheetBackdrop.classList.remove('is-open');
    el.sheet.setAttribute('aria-hidden', 'true');
    $$('[data-sheet]', el.toolbar).forEach(function (b) {
      b.setAttribute('aria-expanded', 'false');
    });
    if (restoreFocus !== false) {
      var btn = $('[data-sheet="' + last + '"]', el.toolbar);
      if (btn) btn.focus({ preventScroll: true });
    }
  }

  function toggleSheet(name) {
    if (isPC()) { setPane(name); return; }
    if (state.sheet === name) closeSheet();
    else openSheet(name);
  }

  /* ── events ───────────────────────────────────────────────────────────── */
  var dragMoved = false;

  function bind() {
    // upload
    el.dropzone.addEventListener('click', function () { el.fileInput.click(); });
    el.dropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.fileInput.click(); }
    });
    el.fileInput.addEventListener('change', function () {
      if (el.fileInput.files && el.fileInput.files[0]) loadFile(el.fileInput.files[0]);
      el.fileInput.value = '';
    });

    ['dragenter', 'dragover'].forEach(function (t) {
      el.dropzone.addEventListener(t, function (e) { e.preventDefault(); el.dropzone.classList.add('is-over'); });
      el.stageCanvas.addEventListener(t, function (e) { e.preventDefault(); });
    });
    ['dragleave', 'drop'].forEach(function (t) {
      el.dropzone.addEventListener(t, function () { el.dropzone.classList.remove('is-over'); });
    });
    function dropHandler(e) {
      e.preventDefault();
      var list = e.dataTransfer && e.dataTransfer.files;
      if (!list || !list.length) return;
      if (list.length > 1) openFiles(list);
      else loadFile(list[0]);
    }
    el.dropzone.addEventListener('drop', function (e) { dropHandler(e); });
    el.stageCanvas.addEventListener('drop', dropHandler);
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) { e.preventDefault(); });

    $('#headerSampleBtn').addEventListener('click', loadSample);
    $('#emptySampleBtn').addEventListener('click', loadSample);
    $('#changeBtn').addEventListener('click', function () { el.fileInput.click(); });
    $('#clearBtn').addEventListener('click', clearPhoto);

    // fields
    Object.keys(FIELD_INPUTS).forEach(function (k) {
      FIELD_INPUTS[k].addEventListener('input', function () { readField(k); });
    });
    $('#resetMetaBtn').addEventListener('click', function () {
      if (state.photo && state.photo.file) loadFile(state.photo.file, 'EXIF 다시 읽기', { keepWorkspace: true });
    });

    // workspace: open several photos / a folder
    ['#openFilesBtn', '#emptyOpenFilesBtn', '#sessionOpenFilesBtn'].forEach(function (sel) {
      var b = $(sel);
      if (b) b.addEventListener('click', function () { if (el.wsFileInput) el.wsFileInput.click(); });
    });
    ['#openFolderBtn', '#emptyOpenFolderBtn', '#sessionOpenFolderBtn'].forEach(function (sel) {
      var b = $(sel);
      if (b) b.addEventListener('click', openFolder);
    });
    if (el.wsFileInput) {
      el.wsFileInput.addEventListener('change', function () {
        var files = el.wsFileInput.files;
        if (files && files.length) openFiles(files);
        el.wsFileInput.value = '';
      });
    }
    if (el.wsFolderInput) {
      el.wsFolderInput.addEventListener('change', function () {
        var files = el.wsFolderInput.files;
        if (files && files.length) {
          var recursive = !!(el.recursiveToggle && el.recursiveToggle.checked);
          var entries = entriesFromFiles(files, recursive);
          var folder = String((files[0].webkitRelativePath || '')).split('/')[0] || 'Workspace';
          if (!entries.length) toast('이 폴더에 불러올 사진이 없습니다', 'warn');
          else wsOpen(entries, folder, true);
        }
        el.wsFolderInput.value = '';
      });
    }
    if (el.wsSort) el.wsSort.addEventListener('change', function () { sortWs(el.wsSort.value); });
    if (el.wsToggle) {
      el.wsToggle.addEventListener('click', function () {
        state.ws.collapsed = !state.ws.collapsed;
        syncWsUI();
        setTimeout(function () { render(); scheduleStrip(); }, 180);
      });
    }
    if (el.bulkBtn) el.bulkBtn.addEventListener('click', bulkExport);

    // geometry
    el.padRange.addEventListener('input', function () {
      state.geo.padPct = parseFloat(el.padRange.value);
      el.padVal.textContent = state.geo.padPct + '%';
      renderAll();
    });
    el.extraRange.addEventListener('input', function () {
      state.geo.extraPct = parseFloat(el.extraRange.value);
      el.extraVal.textContent = state.geo.extraPct + '%';
      renderAll();
    });
    el.radiusRange.addEventListener('input', function () {
      state.geo.radiusPct = parseFloat(el.radiusRange.value);
      el.radiusVal.textContent = state.geo.radiusPct + '%';
      renderAll();
    });
    el.ratioSelect.addEventListener('change', function () {
      state.ratio = parseFloat(el.ratioSelect.value) || 0;
      renderAll();
    });
    el.stockSelect.addEventListener('change', function () {
      state.stock = el.stockSelect.value;
      renderAll();
    });
    el.fontSelect.addEventListener('change', function () {
      state.font = el.fontSelect.value;
      renderAll();
    });
    $('#resetGeoBtn').addEventListener('click', function () {
      state.geo = PL.defaults(state.style);
      state.ratio = 0;
      syncGeoUI();
      renderAll();
      toast('프레임 기본값으로 되돌렸습니다');
    });

    // emblem colour — makers' own colours, or one ink for the whole plate
    if (el.emblemMonoSeg) {
      $$('button', el.emblemMonoSeg).forEach(function (b) {
        b.addEventListener('click', function () {
          if (!!state.emblemMono === (b.dataset.emblemMono === 'mono')) return;
          setEmblemMono(b.dataset.emblemMono === 'mono');
        });
      });
    }

    // export
    $$('button', el.formatSeg).forEach(function (b) {
      b.addEventListener('click', function () {
        state.format = b.dataset.format;
        syncExportUI();
        render();
      });
    });
    if (el.formatSegDock) {
      $$('button', el.formatSegDock).forEach(function (b) {
        b.addEventListener('click', function () {
          state.format = b.dataset.format;
          syncExportUI();
          render();
        });
      });
    }
    el.qualityRange.addEventListener('input', function () {
      state.quality = parseInt(el.qualityRange.value, 10);
      el.qualityVal.textContent = state.quality;
      if (el.qualityValDock) el.qualityValDock.textContent = state.quality;
      if (el.qualityRangeDock) el.qualityRangeDock.value = state.quality;
    });
    if (el.qualityRangeDock) {
      el.qualityRangeDock.addEventListener('input', function () {
        state.quality = parseInt(el.qualityRangeDock.value, 10);
        el.qualityVal.textContent = state.quality;
        el.qualityValDock.textContent = state.quality;
        el.qualityRange.value = state.quality;
      });
    }
    if (el.dockSaveBtn) el.dockSaveBtn.addEventListener('click', downloadPlate);
    el.downloadBtn.addEventListener('click', downloadPlate);
    if (el.shareBtn) el.shareBtn.addEventListener('click', sharePlate);
    if (el.previewBtn) el.previewBtn.addEventListener('click', openPreview);
    el.headerDownloadBtn.addEventListener('click', exportPlate);

    // result card + preview overlay
    el.exportClose.addEventListener('click', closeExportCard);
    el.exportSave.addEventListener('click', function () {
      if (prepared) {
        saveFile(prepared);
        toast(prepared.w + ' × ' + prepared.h + ' · ' + bytes(prepared.bytes) + ' 파일 저장');
      } else {
        downloadPlate();
      }
    });
    el.exportShare.addEventListener('click', function () {
      if (prepared) shareNow(prepared);
    });
    el.exportShot.addEventListener('click', openPreviewOverlay);
    el.previewClose.addEventListener('click', function () {
      closePreviewOverlay();
      if (prepared) openExportCard(prepared);
    });
    el.exportModal.addEventListener('click', function (e) {
      if (e.target === el.exportModal) closeExportCard();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (el.previewOverlay.classList.contains('is-open')) {
        closePreviewOverlay();
        if (prepared) openExportCard(prepared);
      } else if (el.exportModal.classList.contains('is-open')) {
        closeExportCard();
      }
    });

    // toolbar ⇄ sheet
    $$('[data-sheet]', el.toolbar).forEach(function (b) {
      b.addEventListener('click', function () { toggleSheet(b.dataset.sheet); });
    });
    el.sheetClose.addEventListener('click', function () { closeSheet(); });
    el.sheetBackdrop.addEventListener('click', function () { closeSheet(); });

    // PC inspector tabs
    if (el.insTabs) {
      var tabButtons = $$('[data-tab]', el.insTabs);
      tabButtons.forEach(function (b, i) {
        b.addEventListener('click', function () { setPane(b.dataset.tab); });
        b.addEventListener('keydown', function (e) {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          var next = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabButtons.length) % tabButtons.length;
          setPane(tabButtons[next].dataset.tab);
          tabButtons[next].focus({ preventScroll: true });
        });
      });
    }

    /* Photograph by photograph with the arrow keys, the way a folder is meant
       to be looked at. Inputs and the other strips keep their own keys. */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (state.ws.entries.length < 2) return;
      var t = e.target;
      if (t && t.closest) {
        if (t.closest('input, select, textarea, [contenteditable]')) return;
        if (t.closest('#frameStrip') || t.closest('#insTabs')) return;
      }
      e.preventDefault();
      stepEntry(e.key === 'ArrowRight' ? 1 : -1);
    });

    // preview background
    $$('button', $('#bgSeg')).forEach(function (b) {
      b.addEventListener('click', function () {
        state.bg = b.dataset.bg;
        el.stage.dataset.bg = state.bg;
        $$('button', $('#bgSeg')).forEach(function (x) {
          x.setAttribute('aria-pressed', x.dataset.bg === state.bg ? 'true' : 'false');
        });
        render();
      });
    });

    // zoom
    $('#zoomInBtn').addEventListener('click', function () { zoomBy(1.3); });
    $('#zoomOutBtn').addEventListener('click', function () { zoomBy(1 / 1.3); });
    $('#zoomFitBtn').addEventListener('click', resetView);
    el.stageCanvas.addEventListener('wheel', function (e) {
      if (!state.photo) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });
    el.stageCanvas.addEventListener('dblclick', function () {
      if (state.zoom > 1) resetView(); else zoomBy(2);
    });

    // pan + pinch
    var drag = null;
    var pointers = new Map();
    var pinch = null;

    function pinchDist() {
      var pts = Array.from(pointers.values());
      if (pts.length < 2) return 0;
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }

    el.stageCanvas.addEventListener('pointerdown', function (e) {
      if (!state.photo) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        pinch = { dist: pinchDist(), zoom: state.zoom };
        drag = null;
      } else if (pointers.size === 1) {
        drag = { x: e.clientX, y: e.clientY, px: state.panX, py: state.panY };
        el.stageCanvas.classList.add('is-panning');
      }
      try { el.stageCanvas.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    });

    el.stageCanvas.addEventListener('pointermove', function (e) {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size === 2) {
        var d = pinchDist();
        if (pinch.dist > 8) {
          state.zoom = Math.max(1, Math.min(8, pinch.zoom * (d / pinch.dist)));
          if (state.zoom === 1) { state.panX = 0; state.panY = 0; }
          render();
        }
        return;
      }
      if (!drag) return;
      state.panX = drag.px + (e.clientX - drag.x);
      state.panY = drag.py + (e.clientY - drag.y);
      render();
    });

    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) {
      el.stageCanvas.addEventListener(t, function (e) {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinch = null;
        if (pointers.size === 0) {
          drag = null;
          el.stageCanvas.classList.remove('is-panning');
        }
      });
    });

    // frame strip: wheel, drag-scroll, keyboard
    el.strip.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.strip.scrollLeft += e.deltaY;
    }, { passive: false });

    var scrollDrag = null;
    el.strip.addEventListener('pointerdown', function (e) {
      /* touch swipes are handled natively (overflow-x + momentum); the manual
         drag exists for mice, where there is no native pan. */
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      scrollDrag = { x: e.clientX, left: el.strip.scrollLeft, moved: 0 };
      dragMoved = false;
    });
    el.strip.addEventListener('pointermove', function (e) {
      if (!scrollDrag) return;
      var dx = e.clientX - scrollDrag.x;
      scrollDrag.moved = Math.max(scrollDrag.moved, Math.abs(dx));
      if (scrollDrag.moved > 6) {
        dragMoved = true;
        el.strip.scrollLeft = scrollDrag.left - dx;
      }
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) {
      el.strip.addEventListener(t, function () { scrollDrag = null; });
    });
    $$('.frame-card', el.strip).forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (dragMoved) { e.preventDefault(); dragMoved = false; return; }
        setStyle(card.dataset.style);
      });
    });

    el.strip.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      var i = PL.ORDER.indexOf(state.style);
      var next = Math.max(0, Math.min(PL.ORDER.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
      setStyle(PL.ORDER[next]);
      var card = $('.frame-card[data-style="' + PL.ORDER[next] + '"]', el.strip);
      if (card && card.scrollIntoView) card.scrollIntoView({ block: 'nearest', inline: 'center' });
      if (card) card.focus({ preventScroll: true });
    });

    // portal menu
    el.portalMenuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = el.portalMenuDropdown.hidden;
      el.portalMenuDropdown.hidden = !open;
      el.portalMenuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (!el.portalMenu.contains(e.target)) {
        el.portalMenuDropdown.hidden = true;
        el.portalMenuBtn.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (state.sheet) { closeSheet(); return; }
      if (!el.portalMenuDropdown.hidden) {
        el.portalMenuDropdown.hidden = true;
        el.portalMenuBtn.setAttribute('aria-expanded', 'false');
        el.portalMenuBtn.focus({ preventScroll: true });
      }
    });

    // resize
    var redraw = function () { render(); scheduleStrip(); };
    if (window.ResizeObserver) {
      new ResizeObserver(render).observe(el.stageCanvas);
    }
    window.addEventListener('resize', redraw);
    window.addEventListener('orientationchange', function () { setTimeout(redraw, 240); });

    /* Crossing 1024px swaps the same panel between "bottom sheet" and "fixed
       inspector": the open pane follows, and the sheet is retired on the way up. */
    if (typeof window.matchMedia === 'function') {
      var mq = window.matchMedia('(min-width: 1024px)');
      var onWide = function () {
        if (mq.matches) {
          state.sheet = null;
          el.sheet.classList.remove('is-open');
          el.sheetBackdrop.classList.remove('is-open');
          el.sheet.setAttribute('aria-hidden', 'false');
          el.sheet.setAttribute('aria-modal', 'false');
          setPane(state.pane || 'exif');
        } else {
          el.sheet.setAttribute('aria-hidden', 'true');
          el.sheet.setAttribute('aria-modal', 'true');
        }
        render();
        scheduleStrip();
      };
      if (mq.addEventListener) mq.addEventListener('change', onWide);
      else if (mq.addListener) mq.addListener(onWide);
    }
  }

  function zoomBy(factor) {
    if (!state.photo) return;
    var next = Math.max(1, Math.min(8, state.zoom * factor));
    if (next === 1) { state.panX = 0; state.panY = 0; }
    state.zoom = next;
    render();
  }

  function resetView() {
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    render();
  }

  /* ── boot ─────────────────────────────────────────────────────────────── */
  function boot() {
    state.inApp = inAppName();
    paintInAppNotice();
    el.stage.dataset.bg = state.bg;
    buildEmblems();
    buildStrip();
    setPane('exif');
    /* On a wide screen the panel is not a modal dialog — it is simply there. */
    if (isPC()) {
      el.sheet.setAttribute('aria-hidden', 'false');
      el.sheet.setAttribute('aria-modal', 'false');
    }
    paintFields();
    syncStyleUI();
    syncGeoUI();
    syncExportUI();
    syncPhotoUI(0);
    syncWsUI();
    bind();
    render();
    paintStrip();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { render(); paintStrip(); });
    }
  }

  window.SPApp = {
    state: state,
    loadFile: loadFile,
    loadSample: loadSample,
    setStyle: setStyle,
    setEmblemMono: setEmblemMono,
    openFiles: openFiles,
    openFolder: openFolder,
    scanAndOpen: scanAndOpen,
    selectEntry: selectEntry,
    stepEntry: stepEntry,
    sortWs: sortWs,
    bulkExport: bulkExport,
    workspace: function () { return state.ws; },
    entriesFromFiles: entriesFromFiles,
    setPane: setPane,
    isPC: isPC,
    wsVisible: wsVisible,
    setField: function (key, value) {
      if (FIELD_INPUTS[key]) { FIELD_INPUTS[key].value = value; readField(key); }
    },
    setRatio: function (ratio) {
      state.ratio = Number(ratio) || 0;
      el.ratioSelect.value = String(state.ratio);
      renderAll();
    },
    openSheet: openSheet,
    closeSheet: closeSheet,
    render: render,
    paintStrip: paintStrip,
    exportPlate: exportPlate,
    prepareExport: prepareExport,
    downloadPlate: downloadPlate,
    sharePlate: sharePlate,
    shareNow: shareNow,
    openPreview: openPreview,
    canShareFiles: canShareFiles,
    canShareThis: canShareThis,
    isInAppBrowser: isInAppBrowser,
    inAppName: inAppName,
    saveFile: saveFile,
    copyUrl: copyUrl,
    exportSrc: exportSrc,
    shareCancelled: shareCancelled,
    prepared: function () { return prepared; },
    openExportCard: function (p) { openExportCard(p || prepared); },
    layoutFor: layoutFor,
    currentLayout: currentLayout,
    isReady: true
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
