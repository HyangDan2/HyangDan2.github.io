/* ============================================================================
 * HD2Lab · Shutterplate (PKPilot0003)
 * Studio wiring: upload → EXIF → live canvas → 1:1 export.
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

  var state = {
    photo: null,
    exifTags: null,
    fields: EX.templateFor(new Date()),
    style: 'classic',
    emblemChoice: 'auto',
    autoEmblem: 'hd2lab',
    geo: PL.defaults('classic'),
    font: 'sans',
    stock: 'KODAK PORTRA 400',
    frameNo: '03',
    format: 'jpeg',
    quality: 95,
    bg: 'dark',
    zoom: 1,
    panX: 0, panY: 0,
    sampleIdx: 0,
    fitScale: 1
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
    fileMeta: $('#fileMeta'),
    metaName: $('#metaName'),
    metaSize: $('#metaSize'),
    metaBytes: $('#metaBytes'),
    metaExif: $('#metaExif'),
    styleGrid: $('#styleGrid'),
    filmStockRow: $('#filmStockRow'),
    stockSelect: $('#stockSelect'),
    emblemGrid: $('#emblemGrid'),
    emblemHint: $('#emblemHint'),
    padRange: $('#padRange'), extraRange: $('#extraRange'), radiusRange: $('#radiusRange'),
    padVal: $('#padVal'), extraVal: $('#extraVal'), radiusVal: $('#radiusVal'),
    fontSelect: $('#fontSelect'),
    formatSeg: $('#formatSeg'),
    qualityRow: $('#qualityRow'),
    qualityRange: $('#qualityRange'),
    qualityVal: $('#qualityVal'),
    exportSize: $('#exportSize'),
    exportName: $('#exportName'),
    downloadBtn: $('#downloadBtn'),
    headerDownloadBtn: $('#headerDownloadBtn'),
    toasts: $('#toasts'),
    portalMenu: $('#portalMenu'),
    portalMenuBtn: $('#portalMenuBtn'),
    portalMenuDropdown: $('#portalMenuDropdown')
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
    var icon = kind === 'error' ? 'i-info' : kind === 'warn' ? 'i-info' : 'i-check';
    d.innerHTML = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#' + icon + '"/></svg><span></span>';
    d.lastChild.textContent = message;
    el.toasts.appendChild(d);
    while (el.toasts.children.length > 2) el.toasts.firstElementChild.remove();
    setTimeout(function () {
      d.classList.add('is-out');
      setTimeout(function () { d.remove(); }, 240);
    }, 3400);
  }

  /* ── emblem picker ────────────────────────────────────────────────────── */
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
        scheduleRender();
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
    scheduleRender();
  }

  /* ── photo loading ────────────────────────────────────────────────────── */
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

    paintFields();
    syncEmblems();
    syncPhotoUI(count);
    scheduleRender();

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
      el.fileMeta.hidden = true;
      el.photoChip.lastElementChild.textContent = '사진 없음';
      el.downloadBtn.disabled = true;
      el.headerDownloadBtn.disabled = true;
      $('#resetMetaBtn').disabled = true;
      return;
    }
    el.empty.hidden = true;
    el.fileMeta.hidden = false;
    el.metaName.textContent = p.name;
    el.metaSize.textContent = p.w + ' × ' + p.h;
    el.metaBytes.textContent = bytes(p.bytes);
    el.metaExif.textContent = (tagCount || 0) + ' tags';
    el.photoChip.lastElementChild.textContent = p.w + ' × ' + p.h;
    el.downloadBtn.disabled = false;
    el.headerDownloadBtn.disabled = false;
    $('#resetMetaBtn').disabled = false;
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
    paintFields();
    syncPhotoUI(0);
    scheduleRender();
    toast('캔버스를 비웠습니다');
  }

  /* ── layout / render ──────────────────────────────────────────────────── */
  function layoutFor(img, w, h) {
    return PL.layout({ w: w, h: h, img: img }, {
      style: state.style,
      fields: state.fields,
      emblem: resolveEmblem(),
      padPct: state.geo.padPct,
      extraPct: state.geo.extraPct,
      radiusPct: state.geo.radiusPct,
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
      var fit = Math.min((cw - 56) / L.W, (ch - 56) / L.H);
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
      ctx.shadowColor = state.bg === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(30,36,28,0.22)';
      ctx.shadowBlur = L.W * 0.018;
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

      el.zoomLabel.textContent = state.zoom === 1 ? '맞춤' : '×' + (state.zoom).toFixed(1);
    }
    updateReadout(L);
  }

  var raf = 0;
  function scheduleRender() {
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      render();
    });
  }

  function updateReadout(L) {
    el.styleChip.textContent = PL.STYLES[state.style].label.toUpperCase();
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
  async function exportPlate() {
    var p = state.photo;
    if (!p) { toast('먼저 사진을 불러와 주세요', 'warn'); return; }

    var L = layoutFor(p.img, p.w, p.h);
    var k = Math.min(1, MAX_EDGE / Math.max(L.W, L.H));
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
    var name = EX.fileName(state.fields, format === 'png' ? 'png' : 'jpg');
    el.downloadBtn.disabled = true;

    var blob = await new Promise(function (resolve) {
      if (off.toBlob) off.toBlob(resolve, mime, state.quality / 100);
      else resolve(null);
    });
    el.downloadBtn.disabled = false;

    if (!blob) { toast('내보내기에 실패했습니다 — 사진 크기를 줄여 보세요', 'error'); return; }

    var a = document.createElement('a');
    var href = URL.createObjectURL(blob);
    a.href = href;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(href); }, 12000);

    toast(ow + ' × ' + oh + ' · ' + bytes(blob.size) + ' 저장');
    window.__lastExport = { name: name, bytes: blob.size, w: ow, h: oh, format: format };
  }

  /* ── UI sync ──────────────────────────────────────────────────────────── */
  function syncStyleUI() {
    $$('.style-card', el.styleGrid).forEach(function (c) {
      c.setAttribute('aria-checked', c.dataset.style === state.style ? 'true' : 'false');
    });
    el.filmStockRow.hidden = state.style !== 'film';
  }

  function syncGeoUI() {
    el.padRange.value = state.geo.padPct;
    el.extraRange.value = state.geo.extraPct;
    el.radiusRange.value = state.geo.radiusPct;
    el.padVal.textContent = state.geo.padPct + '%';
    el.extraVal.textContent = state.geo.extraPct + '%';
    el.radiusVal.textContent = state.geo.radiusPct + '%';
  }

  function syncExportUI() {
    $$('button', el.formatSeg).forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.format === state.format ? 'true' : 'false');
    });
    el.qualityRow.hidden = state.format !== 'jpeg';
    el.qualityVal.textContent = state.quality;
    el.qualityRange.value = state.quality;
  }

  function setStyle(style, resetGeo) {
    if (!PL.STYLES[style]) return;
    state.style = style;
    if (resetGeo !== false) {
      state.geo = PL.defaults(style);
      syncGeoUI();
    }
    syncStyleUI();
    scheduleRender();
  }

  /* ── events ───────────────────────────────────────────────────────────── */
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
    el.dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) loadFile(f);
    });
    el.stageCanvas.addEventListener('drop', function (e) {
      e.preventDefault();
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) loadFile(f);
    });

    $('#sampleBtn').addEventListener('click', loadSample);
    $('#emptySampleBtn').addEventListener('click', loadSample);
    $('#emptyPickBtn').addEventListener('click', function () { el.fileInput.click(); });
    $('#clearBtn').addEventListener('click', clearPhoto);

    // fields
    Object.keys(FIELD_INPUTS).forEach(function (k) {
      FIELD_INPUTS[k].addEventListener('input', function () { readField(k); });
    });
    $('#resetMetaBtn').addEventListener('click', function () {
      if (state.photo && state.photo.file) loadFile(state.photo.file, 'EXIF 다시 읽기');
    });

    // style
    $$('.style-card', el.styleGrid).forEach(function (card) {
      card.addEventListener('click', function () { setStyle(card.dataset.style); });
    });
    el.stockSelect.addEventListener('change', function () {
      state.stock = el.stockSelect.value;
      scheduleRender();
    });

    // geometry
    el.padRange.addEventListener('input', function () {
      state.geo.padPct = parseFloat(el.padRange.value);
      el.padVal.textContent = state.geo.padPct + '%';
      scheduleRender();
    });
    el.extraRange.addEventListener('input', function () {
      state.geo.extraPct = parseFloat(el.extraRange.value);
      el.extraVal.textContent = state.geo.extraPct + '%';
      scheduleRender();
    });
    el.radiusRange.addEventListener('input', function () {
      state.geo.radiusPct = parseFloat(el.radiusRange.value);
      el.radiusVal.textContent = state.geo.radiusPct + '%';
      scheduleRender();
    });
    el.fontSelect.addEventListener('change', function () {
      state.font = el.fontSelect.value;
      scheduleRender();
    });
    $('#resetGeoBtn').addEventListener('click', function () {
      state.geo = PL.defaults(state.style);
      syncGeoUI();
      scheduleRender();
      toast('스타일 기본 여백으로 되돌렸습니다');
    });

    // export
    $$('button', el.formatSeg).forEach(function (b) {
      b.addEventListener('click', function () {
        state.format = b.dataset.format;
        syncExportUI();
        scheduleRender();
      });
    });
    el.qualityRange.addEventListener('input', function () {
      state.quality = parseInt(el.qualityRange.value, 10);
      el.qualityVal.textContent = state.quality;
    });
    el.downloadBtn.addEventListener('click', exportPlate);
    el.headerDownloadBtn.addEventListener('click', exportPlate);

    // accordion
    $$('.acc-head').forEach(function (head) {
      head.addEventListener('click', function () {
        var acc = head.parentElement;
        var open = acc.getAttribute('aria-open') !== 'false';
        acc.setAttribute('aria-open', open ? 'false' : 'true');
        head.setAttribute('aria-expanded', open ? 'false' : 'true');
      });
    });

    // preview background
    $$('button', $('#bgSeg')).forEach(function (b) {
      b.addEventListener('click', function () {
        state.bg = b.dataset.bg;
        el.stage.dataset.bg = state.bg;
        $$('button', $('#bgSeg')).forEach(function (x) {
          x.setAttribute('aria-pressed', x.dataset.bg === state.bg ? 'true' : 'false');
        });
        scheduleRender();
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
          scheduleRender();
        }
        return;
      }
      if (!drag) return;
      state.panX = drag.px + (e.clientX - drag.x);
      state.panY = drag.py + (e.clientY - drag.y);
      scheduleRender();
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
      if (e.key === 'Escape') {
        el.portalMenuDropdown.hidden = true;
        el.portalMenuBtn.setAttribute('aria-expanded', 'false');
      }
    });

    // resize
    if (window.ResizeObserver) {
      new ResizeObserver(function () { scheduleRender(); }).observe(el.stageCanvas);
    } else {
      window.addEventListener('resize', scheduleRender);
    }
    window.addEventListener('resize', scheduleRender);
    window.addEventListener('orientationchange', function () { setTimeout(scheduleRender, 240); });
  }

  function zoomBy(factor) {
    if (!state.photo) return;
    var next = Math.max(1, Math.min(8, state.zoom * factor));
    if (next === 1) { state.panX = 0; state.panY = 0; }
    state.zoom = next;
    scheduleRender();
  }

  function resetView() {
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    scheduleRender();
  }

  /* ── boot ─────────────────────────────────────────────────────────────── */
  function boot() {
    el.stage.dataset.bg = state.bg;
    $$('.acc').forEach(function (acc) {
      var head = $('.acc-head', acc);
      acc.setAttribute('aria-open', head.getAttribute('aria-expanded') === 'false' ? 'false' : 'true');
    });
    buildEmblems();
    paintFields();
    syncStyleUI();
    syncGeoUI();
    syncExportUI();
    syncPhotoUI(0);
    bind();
    render();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleRender);
  }

  window.SPApp = {
    state: state,
    loadFile: loadFile,
    loadSample: loadSample,
    setStyle: setStyle,
    setField: function (key, value) {
      if (FIELD_INPUTS[key]) { FIELD_INPUTS[key].value = value; readField(key); }
    },
    render: render,
    exportPlate: exportPlate,
    layoutFor: layoutFor,
    currentLayout: currentLayout,
    isReady: true
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
