/* ============================================================================
 * HD2Lab · Shutterplate (PKPilot0003)
 * Maker emblems — 10 hand-built vector specs, rendered two ways from one source
 *   1) SVG string  → the picker tiles in the DOM
 *   2) Canvas ops  → the exported plate bitmap
 * Every glyph below is drawn by this project (wordmarks set in system faces,
 * symbols built from primitives); no third-party logo files are bundled.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var SANS = 'Helvetica Neue, Helvetica, Arial, sans-serif';
  var MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  var SERIF = 'Iowan Old Style, Palatino Linotype, Palatino, Georgia, serif';

  /* Official HD2Lab dual-skew mark — the identical geometry is used by the
     site header, the favicon set and the plate emblems. */
  var MARK_PATH = 'M15 20L35 10V43L15 53ZM29 24L49 14V47L29 57Z';

  function t(s, x, y, size, family, weight, ls, align) {
    return { t: 't', s: s, x: x, y: y, size: size, family: family || SANS,
             weight: weight || 400, ls: ls || 0, align: align || 'left' };
  }
  function p(d, fill, stroke, sw) {
    return { t: 'p', d: d, fill: fill || null, stroke: stroke || null, sw: sw || 0 };
  }
  function c(cx, cy, r, fill, stroke, sw) {
    return { t: 'c', cx: cx, cy: cy, r: r, fill: fill || null, stroke: stroke || null, sw: sw || 0 };
  }
  function r(x, y, w, h, rx, fill, stroke, sw) {
    return { t: 'r', x: x, y: y, w: w, h: h, rx: rx || 0, fill: fill || null, stroke: stroke || null, sw: sw || 0 };
  }

  /* Each spec: vb = [width, height] in abstract units; ops are drawn inside it. */
  var LIST = [
    {
      id: 'sony', name: 'Sony', vb: [96, 40],
      ops: [t('SONY', 48, 30, 26, SANS, 700, 2.6, 'center')]
    },
    {
      id: 'canon', name: 'Canon', vb: [104, 40],
      ops: [t('Canon', 52, 30, 27, SANS, 600, 0.6, 'center')]
    },
    {
      id: 'nikon', name: 'Nikon', vb: [104, 40],
      ops: [t('Nikon', 52, 30, 27, SANS, 700, 0.2, 'center')]
    },
    {
      id: 'fujifilm', name: 'Fujifilm', vb: [118, 40],
      ops: [
        r(3, 9, 112, 23, 1, null, 'ink', 2.2),
        t('FUJIFILM', 59, 26, 16, SANS, 700, 2.0, 'center')
      ]
    },
    {
      id: 'leica', name: 'Leica', vb: [112, 40],
      ops: [
        c(13, 20, 10.5, 'brand', null, 0),
        { t: 't', s: 'L', x: 13, y: 25.5, size: 12, family: SERIF, weight: 700, ls: 0, align: 'center', fill: '#ffffff' },
        t('LEICA', 31, 28, 21, SANS, 500, 3.2, 'left')
      ]
    },
    {
      id: 'hasselblad', name: 'Hasselblad', vb: [160, 44],
      ops: [
        c(21, 22, 17.5, null, 'ink', 2.4),
        p('M14 12.5V31.5', null, 'ink', 4.4),
        p('M28 12.5V31.5', null, 'ink', 4.4),
        p('M12.6 29.4L29.4 14.6', null, 'ink', 4.4),
        t('HASSELBLAD', 48, 27.5, 12.5, SANS, 600, 2.6, 'left')
      ]
    },
    {
      id: 'apple', name: 'Apple', vb: [34, 44],
      ops: [
        // leaf
        p('M20.6 10.2C21.4 6.4 24 3.4 27.2 2.2C27.6 6 25.2 9.4 21.4 10.6Z', 'ink'),
        // body, bite cut on the right by the 'base' disc below
        p('M17 13.4C13.6 13.4 10.4 15.3 8.6 18.3C6 22.7 6.6 30.4 10.2 35.6C12.4 38.8 15 40.8 17.2 40.2C18.2 39.9 19.1 39.6 20 39.6C20.9 39.6 21.8 39.9 22.8 40.2C25 40.8 27.6 38.8 29.8 35.6C32.2 32.1 33.2 27.4 32.6 23.4C32.3 21.6 31.6 20 30.5 18.3C28.5 15.3 25.2 13.4 21.8 13.4Z', 'ink'),
        c(32.6, 21.4, 6.2, 'base')
      ]
    },
    {
      id: 'lumix', name: 'Lumix', vb: [110, 40],
      ops: [t('LUMIX', 55, 30, 26, SANS, 800, 1.6, 'center')]
    },
    {
      id: 'omsystem', name: 'OM System', vb: [150, 40],
      ops: [t('OM SYSTEM', 75, 28, 16.5, SANS, 600, 4.6, 'center')]
    },
    {
      /* The official HD2Lab dual-skew mark, verbatim from the brand sheet
         (viewBox 0 0 64 64, two stroked parallelograms) followed by the
         wordmark, so the plate carries the same logo as the site header. */
      id: 'hd2lab', name: 'HD2Lab', vb: [172, 64],
      ops: [
        p('M15 20L35 10V43L15 53Z', null, 'accent', 4.4),
        p('M29 24L49 14V47L29 57Z', null, 'accent', 4.4),
        t('HD2LAB', 62, 42, 22, SANS, 700, 2.2, 'left')
      ]
    }
  ];

  var BY_ID = {};
  LIST.forEach(function (e) { BY_ID[e.id] = e; });

  var MAKE_MAP = [
    [/sony/i, 'sony'],
    [/canon/i, 'canon'],
    [/nikon/i, 'nikon'],
    [/fuji/i, 'fujifilm'],
    [/leica/i, 'leica'],
    [/hasselblad/i, 'hasselblad'],
    [/apple/i, 'apple'],
    [/panasonic|lumix/i, 'lumix'],
    [/om digital|olympus|om system/i, 'omsystem'],
    [/hd2lab/i, 'hd2lab']
  ];

  function fromMake(make, model) {
    var s = String(make || '') + ' ' + String(model || '');
    for (var i = 0; i < MAKE_MAP.length; i++) {
      if (MAKE_MAP[i][0].test(s)) return MAKE_MAP[i][1];
    }
    return 'hd2lab';
  }

  function color(v, colors) {
    if (!v) return 'none';
    if (v === 'ink') return colors.ink;
    if (v === 'accent') return colors.accent;
    if (v === 'brand') return '#d81f26';
    if (v === 'base') return colors.base;
    return v;
  }

  /* ---- SVG ---------------------------------------------------------------- */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function svg(id, colors, extraAttrs) {
    var e = BY_ID[id] || BY_ID.hd2lab;
    var vb = e.vb;
    var out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + vb[0] + ' ' + vb[1] +
      '" role="img" aria-label="' + esc(e.name) + ' emblem" ' + (extraAttrs || '') + '>'];
    e.ops.forEach(function (op) {
      if (op.t === 'p') {
        out.push('<path d="' + op.d + '" fill="' + color(op.fill, colors) + '"' +
          (op.stroke ? ' stroke="' + color(op.stroke, colors) + '" stroke-width="' + op.sw + '" stroke-linecap="round"' : '') + '/>');
      } else if (op.t === 'c') {
        out.push('<circle cx="' + op.cx + '" cy="' + op.cy + '" r="' + op.r + '" fill="' + color(op.fill, colors) + '"' +
          (op.stroke ? ' stroke="' + color(op.stroke, colors) + '" stroke-width="' + op.sw + '"' : '') + '/>');
      } else if (op.t === 'r') {
        out.push('<rect x="' + op.x + '" y="' + op.y + '" width="' + op.w + '" height="' + op.h + '" rx="' + op.rx + '" fill="' + color(op.fill, colors) + '"' +
          (op.stroke ? ' stroke="' + color(op.stroke, colors) + '" stroke-width="' + op.sw + '"' : '') + '/>');
      } else if (op.t === 't') {
        var fam = op.family === 'mono' ? MONO : op.family === 'serif' ? SERIF : SANS;
        out.push('<text x="' + op.x + '" y="' + op.y + '" font-family="' + esc(fam) + '" font-size="' + op.size +
          '" font-weight="' + op.weight + '" letter-spacing="' + op.ls + '" fill="' + color(op.fill || 'ink', colors) +
          '" text-anchor="' + (op.align === 'center' ? 'middle' : op.align === 'right' ? 'end' : 'start') + '">' + esc(op.s) + '</text>');
      }
    });
    out.push('</svg>');
    return out.join('');
  }

  /* ---- Canvas ------------------------------------------------------------- */
  function setFont(ctx, op, scale) {
    var fam = op.family === 'mono' ? MONO : op.family === 'serif' ? SERIF : SANS;
    ctx.font = (op.weight || 400) + ' ' + (op.size * scale) + 'px ' + fam;
  }

  function trackedWidth(ctx, text, ls) {
    if (!ls) return ctx.measureText(text).width;
    var w = 0, chars = Array.from(text);
    chars.forEach(function (ch) { w += ctx.measureText(ch).width + ls; });
    return w - ls;
  }

  function drawTracked(ctx, text, x, y, ls, align) {
    var chars = Array.from(text);
    if (!ls) {
      ctx.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
      ctx.fillText(text, x, y);
      return;
    }
    var total = trackedWidth(ctx, text, ls);
    var cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    ctx.textAlign = 'left';
    chars.forEach(function (ch) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + ls;
    });
  }

  /**
   * Draw an emblem inside the box (x, y, w, h) with its aspect ratio preserved.
   * align: 'left' | 'center' | 'right' horizontally inside the box.
   */
  function draw(ctx, id, x, y, w, h, colors, align) {
    var e = BY_ID[id] || BY_ID.hd2lab;
    var s = Math.min(w / e.vb[0], h / e.vb[1]);
    var dw = e.vb[0] * s, dh = e.vb[1] * s;
    var ox = x + (align === 'center' ? (w - dw) / 2 : align === 'right' ? w - dw : 0);
    var oy = y + (h - dh) / 2;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    e.ops.forEach(function (op) {
      if (op.t === 'p') {
        var path = new Path2D(op.d);
        if (op.fill) { ctx.fillStyle = color(op.fill, colors); ctx.fill(path); }
        if (op.stroke) {
          ctx.strokeStyle = color(op.stroke, colors); ctx.lineWidth = op.sw; ctx.stroke(path);
        }
      } else if (op.t === 'c') {
        ctx.beginPath(); ctx.arc(op.cx, op.cy, op.r, 0, Math.PI * 2);
        if (op.fill) { ctx.fillStyle = color(op.fill, colors); ctx.fill(); }
        if (op.stroke) { ctx.strokeStyle = color(op.stroke, colors); ctx.lineWidth = op.sw; ctx.stroke(); }
      } else if (op.t === 'r') {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(op.x, op.y, op.w, op.h, op.rx);
        else ctx.rect(op.x, op.y, op.w, op.h);
        if (op.fill) { ctx.fillStyle = color(op.fill, colors); ctx.fill(); }
        if (op.stroke) { ctx.strokeStyle = color(op.stroke, colors); ctx.lineWidth = op.sw; ctx.stroke(); }
      } else if (op.t === 't') {
        setFont(ctx, op, 1);
        ctx.fillStyle = color(op.fill || 'ink', colors);
        ctx.textBaseline = 'alphabetic';
        drawTracked(ctx, op.s, op.x, op.y, op.ls, op.align);
      }
    });
    ctx.restore();
    return dw;
  }

  function widthFor(id, h) {
    var e = BY_ID[id] || BY_ID.hd2lab;
    return (e.vb[0] / e.vb[1]) * h;
  }

  global.SPEmblems = {
    MARK_PATH: MARK_PATH,
    list: LIST,
    get: function (id) { return BY_ID[id] || BY_ID.hd2lab; },
    has: function (id) { return !!BY_ID[id]; },
    fromMake: fromMake,
    svg: svg,
    draw: draw,
    widthFor: widthFor
  };
})(window);
