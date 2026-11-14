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

  var MAX_EDGE = 4096;

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
    sheet: null
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
    toolbar: $('#toolbar')
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

  function buildEmblems() {
    var auto = emblemTile('auto', 'Auto', '');
    auto.querySelector('.emblem-mark').innerHTML = EM.svg(state.autoEmblem, { ink: INK, accent: ACCENT, base: BASE });
    el.emblemGrid.appendChild(auto);

    EM.list.forEach(function (e) {
      el.emblemGrid.appendChild(emblemTile(e.id, e.name, EM.svg(e.id, { ink: INK, accent: ACCENT, base: BASE })));
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
    $$('.emblem-tile', el.emblemGrid).forEach(function (t) {
      t.setAttribute('aria-checked', t.dataset.emblem === state.emblemChoice ? 'true' : 'false');
    });
    var autoTile = $('.emblem-tile[data-emblem="auto"] .emblem-mark', el.emblemGrid);
    if (autoTile) autoTile.innerHTML = EM.svg(state.autoEmblem, { ink: INK, accent: ACCENT, base: BASE });
    el.emblemHint.textContent = state.emblemChoice === 'auto'
      ? 'EXIF Make 기준 자동 선택 — 현재 ' + EM.get(state.autoEmblem).name
      : '수동 선택 — EXIF와 무관하게 고정됩니다.';
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

  async function loadFile(file, note) {
    var isImage = /^image\//.test(file.type || '') || /\.(jpe?g|png|webp|avif|heic|heif)$/i.test(file.name || '');
    if (!isImage) {
      toast('이미지 파일이 아닙니다 — JPEG · PNG · WebP', 'error');
      return false;
    }

    var url = URL.createObjectURL(file);
    var img;
    try {
      img = await decodeImage(url);
    } catch (e) {
      URL.revokeObjectURL(url);
      toast('이 브라우저에서 열 수 없는 형식입니다', 'error');
      return false;
    }

    var tags = null, count = 0;
    if (window.exifr) {
      try {
        tags = await exifr.parse(file, {
          tiff: true, ifd0: true, exif: true, gps: false, interop: false,
          translateValues: true, reviveValues: true
        });
        count = EX.tagCount(tags);
      } catch (e) {
        tags = null; count = 0;
      }
    }

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
      objectUrl: url
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

    toast((note ? note + ' · ' : '') + (hasCamera ? 'EXIF ' + count + '개 항목을 읽었습니다' : 'EXIF 없음 — 템플릿 값으로 시작합니다'));
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
    paintFields();
    syncPhotoUI(0);
    renderAll();
    toast('캔버스를 비웠습니다');
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
      return;
    }
    var k = Math.min(1, MAX_EDGE / Math.max(L.W, L.H));
    var ow = Math.round(L.W * k), oh = Math.round(L.H * k);
    el.renderChip.textContent = ow + ' × ' + oh;
    el.exportSize.textContent = ow + ' × ' + oh + ' px';
    el.exportName.textContent = EX.fileName(state.fields, state.format === 'png' ? 'png' : 'jpg');
  }

  /* ── export ───────────────────────────────────────────────────────────── */
  /* One render, three doors — the photo album, the file system, a full-screen
     look. iOS only lets a page open the share sheet from a live tap, so a
     prepared file is cached and handed over inside the click; when the cache
     is stale the result card opens and carries its own share button, which is
     a fresh tap again. */
  var MAX_EDGE_PX = MAX_EDGE;
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
      state.emblemChoice, resolveEmblem(), state.geo.padPct, state.geo.extraPct, state.geo.radiusPct,
      state.fields.make, state.fields.model, state.fields.lens, state.fields.focal,
      state.fields.aperture, state.fields.shutter, state.fields.iso,
      state.fields.datetime, state.fields.caption,
      state.photo ? state.photo.name : ''].join('|');
  }

  function renderExportJob() {
    var p = state.photo;
    var L = layoutFor(p.img, p.w, p.h);
    var k = Math.min(1, MAX_EDGE_PX / Math.max(L.W, L.H));
    var ow = Math.max(1, Math.round(L.W * k));
    var oh = Math.max(1, Math.round(L.H * k));

    var off = document.createElement('canvas');
    off.width = ow;
    off.height = oh;
    var ctx = off.getContext('2d');
    ctx.fillStyle = L.colors.base;
    ctx.fillRect(0, 0, ow, oh);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    PL.paint(ctx, L);

    var format = state.format === 'png' ? 'png' : 'jpeg';
    var mime = format === 'png' ? 'image/png' : 'image/jpeg';
    return {
      canvas: off, w: ow, h: oh, format: format, mime: mime,
      name: EX.fileName(state.fields, format === 'png' ? 'png' : 'jpg')
    };
  }

  function prepareExport() {
    if (!state.photo) return Promise.resolve(null);
    var sig = exportSignature();
    if (prepared && prepared.signature === sig) return Promise.resolve(prepared);

    var job = renderExportJob();
    el.downloadBtn.disabled = true;
    el.headerDownloadBtn.disabled = true;
    if (el.shareBtn) el.shareBtn.disabled = true;
    if (el.previewBtn) el.previewBtn.disabled = true;

    return new Promise(function (resolve) {
      var finish = function (blob) {
        el.downloadBtn.disabled = !state.photo;
        el.headerDownloadBtn.disabled = !state.photo;
        if (el.shareBtn) el.shareBtn.disabled = !state.photo;
        if (el.previewBtn) el.previewBtn.disabled = !state.photo;
        if (!blob) {
          toast('내보내기에 실패했습니다 — 사진 크기를 줄여 보세요', 'error');
          resolve(null);
          return;
        }
        var file = null;
        try {
          file = new File([blob], job.name, {
            type: blob.type || job.mime, lastModified: Date.now()
          });
        } catch (e) {
          file = blob;
        }
        if (prepared && prepared.url) URL.revokeObjectURL(prepared.url);
        prepared = {
          blob: blob, file: file, url: URL.createObjectURL(blob),
          name: job.name, bytes: blob.size, w: job.w, h: job.h,
          format: job.format, style: state.style, signature: sig
        };
        window.__lastExport = {
          name: job.name, bytes: blob.size, w: job.w, h: job.h,
          format: job.format, style: state.style
        };
        resolve(prepared);
      };
      if (job.canvas.toBlob) job.canvas.toBlob(finish, job.mime, state.quality / 100);
      else finish(null);
    });
  }

  function saveFile(p) {
    var a = document.createElement('a');
    var href = URL.createObjectURL(p.blob);
    a.href = href;
    a.download = p.name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(href); }, 12000);
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
      toast(p.w + ' × ' + p.h + ' · ' + bytes(p.bytes) + ' 파일 저장');
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
    el.exportImg.src = p.url;
    el.exportMeta.textContent = p.name + ' · ' + p.w + ' × ' + p.h + ' px · ' +
      bytes(p.bytes) + ' · ' + (p.format === 'png' ? 'PNG' : 'JPEG');
    var shareable = canShareThis(p);
    el.exportShare.hidden = !shareable;
    el.exportHintText.textContent = shareable
      ? '‘사진 앨범에 저장 / 공유’를 누르고 공유 시트에서 ‘이미지 저장’을 고르면 앨범에 들어갑니다. 미리보기를 길게 눌러 저장할 수도 있습니다.'
      : '이 브라우저는 공유 시트를 지원하지 않아 파일로 저장합니다. 미리보기를 길게 눌러 사진 앱에 저장할 수도 있습니다.';
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
    el.previewImg.src = prepared.url;
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
    el.qualityRow.hidden = state.format !== 'jpeg';
    el.qualityVal.textContent = state.quality;
    el.qualityRange.value = state.quality;
    if (el.shareBtn) el.shareBtn.hidden = !canShareFiles();
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

  /* ── sheet ────────────────────────────────────────────────────────────── */
  function openSheet(name) {
    if (!SHEETS[name]) return;
    state.sheet = name;
    el.sheetTitle.textContent = SHEETS[name].title;
    el.sheetKicker.textContent = SHEETS[name].kicker;
    $$('.pane', el.sheet).forEach(function (p) {
      p.classList.toggle('is-active', p.dataset.pane === name);
    });
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
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) loadFile(f);
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
      if (state.photo && state.photo.file) loadFile(state.photo.file, 'EXIF 다시 읽기');
    });

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

    // export
    $$('button', el.formatSeg).forEach(function (b) {
      b.addEventListener('click', function () {
        state.format = b.dataset.format;
        syncExportUI();
        render();
      });
    });
    el.qualityRange.addEventListener('input', function () {
      state.quality = parseInt(el.qualityRange.value, 10);
      el.qualityVal.textContent = state.quality;
    });
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
    el.stage.dataset.bg = state.bg;
    buildEmblems();
    buildStrip();
    paintFields();
    syncStyleUI();
    syncGeoUI();
    syncExportUI();
    syncPhotoUI(0);
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
