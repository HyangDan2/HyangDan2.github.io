/* ============================================================================
 * HD2Lab · Shutterplate (PKPilot0003)
 * Plate engine — geometry + canvas painting for the thirteen frames: eleven
 * single-cut signatures and the two multi-cut plates.
 *
 * The first eight are HD2Lab originals that carry the full layout language of
 * the upstream EXIF-frame themes (simple / one line / two line / strap / film /
 * lightroom / custom one line / custom two line) under our own naming:
 *
 *   01 Clean Horizon   ← SIMPLE            05 Film Sprocket  ← FILM
 *   02 Classic Gallery ← ONE_LINE          06 Studio Dark    ← LIGHTROOM
 *   03 Dual Deck       ← TWO_LINE          07 Minimal Edge   ← CUSTOM_ONE_LINE
 *   04 Strap Bar       ← STRAP             08 Pro Studio     ← CUSTOM_TWO_LINE
 *
 * Promoted from /beta/ on 2026-11-15: three single-cut frames — 09 Instant
 * Polaroid, 10 Frosted Glass, 11 Editorial Cover — and, last in the library,
 * the two plates that hold four photographs: 12 Contact Sheet and
 * 13 FYRA 04 (six Nordic themes).
 *
 * Everything is drawn in "plate space" (plate pixels) so the live preview, the
 * frame-strip thumbnails and the 1:1 export share one paint routine.
 *
 * Two things belong to the visitor rather than to the frame: the perforation of
 * Film Sprocket is solved between the photograph's own left and right edges
 * (sprocketRow), and the caption line can be set in a face of their choosing
 * (captionOpt) while every other row keeps the frame's signature typography.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var E = global.SPEmblems;

  var FONTS = {
    sans: '"Helvetica Neue", Helvetica, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", Arial, sans-serif',
    mono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", "Nanum Myeongjo", "Noto Serif KR", serif',
    /* the signature face a visitor may set for their own caption line — Caveat
       is the webfont the page asks for, and a hand-written fallback keeps the
       plate printable when that request never lands */
    script: '"Caveat", "Brush Script MT", "Nanum Pen Script", cursive'
  };

  /* ── the eight signatures ──────────────────────────────────────────────── */
  var STYLES = {
    horizon: {
      label: 'Clean Horizon', tag: 'MINIMAL', light: true,
      base: '#faf9f6', ink: '#17181b', muted: '#7b756c', line: 'rgba(23,24,27,0.14)',
      accent: '#ff824f', geo: { pad: 3.4, extra: 12, radius: 0.25 }
    },
    gallery: {
      label: 'Classic Gallery', tag: 'MATTE', light: true,
      base: '#f8f6f2', ink: '#1c1a17', muted: '#78726b', line: 'rgba(28,26,23,0.18)',
      accent: '#ff824f', geo: { pad: 4.5, extra: 13, radius: 0.6 }
    },
    dual: {
      label: 'Dual Deck', tag: '2-LINE', light: true,
      base: '#ffffff', ink: '#101110', muted: '#7a7a75', line: 'rgba(16,17,16,0.15)',
      accent: '#ff824f', geo: { pad: 3.8, extra: 13.5, radius: 0.25 }
    },
    strap: {
      label: 'Strap Bar', tag: 'WIDE', light: true,
      base: '#ffffff', band: '#f3f1ea', ink: '#111111', muted: '#5f5f5a',
      line: 'rgba(17,17,17,0.16)', accent: '#ff824f',
      geo: { pad: 0, extra: 12, radius: 0 }
    },
    film: {
      label: 'Film Sprocket', tag: '35MM', light: false,
      base: '#16150f', ink: '#f0e9d9', muted: '#a89c86', line: 'rgba(240,233,217,0.22)',
      accent: '#e0703c', geo: { pad: 6, extra: 16, radius: 0.3 }
    },
    studio: {
      label: 'Studio Dark', tag: 'DARK', light: false,
      base: '#101110', ink: '#f4f2ed', muted: '#8d8b85', line: 'rgba(244,242,237,0.16)',
      accent: '#ff824f', geo: { pad: 3.8, extra: 11.5, radius: 1.2 }
    },
    edge: {
      label: 'Minimal Edge', tag: 'FLUSH', light: true,
      base: '#ffffff', ink: '#111111', muted: '#6b6f6a', line: 'rgba(17,17,17,0.13)',
      accent: '#ff824f', geo: { pad: 2.2, extra: 8.5, radius: 0 }
    },
    pro: {
      label: 'Pro Studio', tag: 'GRID', light: true,
      base: '#f6f5f1', ink: '#15171a', muted: '#6f736e', line: 'rgba(21,23,26,0.14)',
      accent: '#ff824f', geo: { pad: 8, extra: 25, radius: 0 }
    },

    /* ── the three frames the promotion added ─────────────────────────────
       Three more single-cut signatures, then the two multi-cut plates. The
       multi-cut entries carry `multi: true` and a cell count: the strip, the
       landing grid, the thumbnail painters and the export all key off it. */
    polaroid: {
      label: 'Instant Polaroid', tag: 'INSTANT', light: true,
      base: '#fbfaf6', ink: '#20211e', muted: '#837f75', line: 'rgba(32,33,30,0.13)',
      accent: '#c85a33', geo: { pad: 7.4, extra: 31, radius: 0.35 }
    },
    frosted: {
      label: 'Frosted Glass', tag: 'GLASS', light: false,
      base: '#101418', ink: '#f3f6f8', muted: '#9caab4', line: 'rgba(243,246,248,0.16)',
      accent: '#ff824f', geo: { pad: 6.4, extra: 18, radius: 1.8 }
    },
    editorial: {
      label: 'Editorial Cover', tag: 'EDITION', light: true,
      base: '#f7f4ec', ink: '#141310', muted: '#6e6a5f', line: 'rgba(20,19,16,0.16)',
      accent: '#b23b23', geo: { pad: 5.4, extra: 24, radius: 0 }
    },
    contact: {
      label: 'Contact Sheet', tag: '4-UP · MULTI', light: false, multi: true, cells: 4,
      base: '#141413', ink: '#ece8df', muted: '#8b877c', line: 'rgba(236,232,223,0.18)',
      accent: '#ff824f', geo: { pad: 4, extra: 8, radius: 0 }
    },
    fyra04: {
      label: 'FYRA 04', tag: 'NORDIC 4-CUT', light: true, multi: true, cells: 4,
      base: '#f4f1e8', ink: '#1e1d1a', muted: '#6f6a5f', line: 'rgba(30,29,26,0.16)',
      accent: '#b8452f', geo: { pad: 3, extra: 10, radius: 0.2 }
    }
  };

  /* Single-cut eleven first, the two multi-cut plates last — the order the
     library and every card row paint in. */
  var ORDER = ['horizon', 'gallery', 'dual', 'strap', 'film', 'studio', 'edge', 'pro',
               'polaroid', 'frosted', 'editorial', 'contact', 'fyra04'];

  function isMulti(id) { return !!(STYLES[id] && STYLES[id].multi); }
  function cellCount(id) { return STYLES[id] && STYLES[id].multi ? (STYLES[id].cells || 4) : 1; }
  ORDER.forEach(function (id, i) { STYLES[id].index = (i + 1 < 10 ? '0' : '') + (i + 1); });

  /* ── text utilities ────────────────────────────────────────────────────── */
  function trackedWidth(ctx, text, ls) {
    if (!ls) return ctx.measureText(text).width;
    var w = 0, chars = Array.from(text);
    for (var i = 0; i < chars.length; i++) w += ctx.measureText(chars[i]).width + ls;
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
    for (var i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], cx, y);
      cx += ctx.measureText(chars[i]).width + ls;
    }
  }

  function fontOf(opt, size) {
    var fam = FONTS[opt.family] || FONTS.sans;
    return (opt.italic ? 'italic ' : '') + (opt.weight || 400) + ' ' + size.toFixed(2) + 'px ' + fam;
  }

  /** Width of one line exactly as text() would paint it. */
  function measure(ctx, str, opt) {
    var s = opt.upper ? String(str).toUpperCase() : String(str);
    if (!s) return 0;
    ctx.font = fontOf(opt, opt.size);
    return trackedWidth(ctx, s, opt.ls || 0);
  }

  /**
   * How far one line may shrink, as a fraction of its nominal size, before the
   * ellipsis takes over. 0.45 keeps long EXIF and lens names whole on portrait
   * plates, where the caption band is narrower than the row of text.
   */
  var MIN_SHRINK = 0.45;

  /**
   * Largest size between the shrink floor and `ceiling` whose painted width
   * fits maxW, or -1 when even the floor is too wide. Font advances are not
   * linear in size — a monospace face snaps to whole-pixel advances, so an 8%
   * smaller line can measure the same width — hence a search, not a ratio.
   */
  function fitSize(ctx, s, opt, ls, maxW, ceiling) {
    var floor = opt.size * MIN_SHRINK;
    if (!(ceiling > floor)) ceiling = floor;
    ctx.font = fontOf(opt, ceiling);
    if (trackedWidth(ctx, s, ls) <= maxW) return ceiling;
    var lo = floor, hi = ceiling, best = -1;
    for (var i = 0; i < 10; i++) {
      var mid = (lo + hi) / 2;
      ctx.font = fontOf(opt, mid);
      if (trackedWidth(ctx, s, ls) <= maxW) { best = mid; lo = mid; } else { hi = mid; }
    }
    return best;
  }

  /**
   * Draw one line of text; shrinks (then ellipsises) to respect opt.maxW.
   * Returns the advance width actually painted.
   */
  function text(ctx, str, x, y, opt) {
    var raw = String(str);
    var s = opt.upper ? raw.toUpperCase() : raw;
    if (!s) return 0;
    var size = opt.size, ls = opt.ls || 0;
    ctx.font = fontOf(opt, size);
    var w = trackedWidth(ctx, s, ls);
    if (opt.maxW && w > opt.maxW) {
      var k = opt.maxW / w;
      ls = ls * k;
      var fitted = fitSize(ctx, s, opt, ls, opt.maxW, size * k);
      if (fitted < 0 && ls > 0) {
        /* still too wide at the floor — give up the tracking before cutting */
        ls = 0;
        fitted = fitSize(ctx, s, opt, ls, opt.maxW, size * k);
      }
      size = fitted > 0 ? fitted : size * MIN_SHRINK;
      ctx.font = fontOf(opt, size);
      w = trackedWidth(ctx, s, ls);
      while (w > opt.maxW && s.length > 2) {
        s = s.slice(0, -2) + '…';
        w = trackedWidth(ctx, s, ls);
        if (s.slice(-2) === '……') break;
      }
    }
    ctx.fillStyle = opt.color;
    ctx.textBaseline = 'alphabetic';
    drawTracked(ctx, s, x, y, ls, opt.align || 'left');
    return w;
  }

  /**
   * Paint several styled runs on one baseline as a single centred/aligned line.
   * parts: [{ s, size, weight, family, color, ls, italic }]
   */
  function compound(ctx, parts, x, y, align, maxW) {
    parts = parts.filter(function (p) { return p && p.s; });
    if (!parts.length) return 0;
    var widths = [], total = 0;
    parts.forEach(function (p) {
      ctx.font = fontOf(p, p.size);
      var w = trackedWidth(ctx, p.s, p.ls || 0);
      widths.push(w);
      total += w;
    });
    var k = 1;
    if (maxW && total > maxW) {
      var measureAt = function (kk) {
        var sum = 0;
        parts.forEach(function (p) {
          ctx.font = fontOf(p, p.size * kk);
          sum += trackedWidth(ctx, p.s, (p.ls || 0) * kk);
        });
        return sum;
      };
      var want = maxW / total;
      if (measureAt(want) <= maxW) k = want;
      else {
        var lo = MIN_SHRINK, hi = want, best = -1;
        for (var n = 0; n < 10; n++) {
          var mid = (lo + hi) / 2;
          if (measureAt(mid) <= maxW) { best = mid; lo = mid; } else { hi = mid; }
        }
        k = best > 0 ? best : MIN_SHRINK;
      }
    }
    var sx = align === 'center' ? x - total * k / 2 : align === 'right' ? x - total * k : x;
    ctx.textBaseline = 'alphabetic';
    parts.forEach(function (p, i) {
      ctx.font = fontOf(p, p.size * k);
      ctx.fillStyle = p.color;
      drawTracked(ctx, p.s, sx, y, (p.ls || 0) * k, 'left');
      sx += widths[i] * k;
    });
    return total * k;
  }

  /* ── caption typography ────────────────────────────────────────────────── */
  /* Every frame was drawn around one answer to "who took this": a serif
     signature on the matte stocks, a mono small-caps stamp on the studio
     plates. A visitor may replace that answer for the caption line alone — the
     maker, the exposure and the date keep the frame's own typography, because
     those are the frame's reporting, not the photographer's voice. */
  function isCustomCaption(L) {
    return !!(L.opts && L.opts.captionMode === 'custom');
  }

  function captionStyle(L, baseFont, baseWeight, baseStyle) {
    if (!isCustomCaption(L)) {
      return { family: baseFont || 'sans', weight: baseWeight || 400,
               italic: !!baseStyle, script: baseFont === 'script' };
    }
    var key = L.opts.captionFont;
    var fam = FONTS[key] ? key : 'sans';
    return {
      family: fam,
      weight: L.opts.captionBold ? 700 : 400,
      italic: !!L.opts.captionItalic,
      script: fam === 'script'
    };
  }

  /* The text options for one caption line: the frame's own defaults, then the
     visitor's face when the caption is in custom mode. A hand-written face is
     set the way a signature is set — no tracking, never in caps — while the
     book faces keep the frame's tracking so the line sits in its band.
     `keepFrame` is for the lines that only borrow the caption slot: with no
     caption written the frames print the camera or their own brand there, and
     that is still the frame's reporting, not the visitor's voice. */
  function captionOpt(L, base, keepFrame) {
    var custom = !keepFrame && isCustomCaption(L);
    var cs = custom
      ? captionStyle(L, base.family, base.weight, base.italic)
      : { family: base.family, weight: base.weight, italic: !!base.italic, script: false };
    var out = {};
    for (var k in base) { if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k]; }
    out.family = cs.family;
    out.weight = cs.weight;
    out.italic = cs.italic;
    /* a custom caption is the visitor's own line, so it is set as they typed
       it — the frame's small caps belong to its stamp, not to their words */
    if (custom) out.upper = false;
    /* a hand-written face is set without tracking, the way a signature is */
    if (custom && cs.script) out.ls = 0;
    return out;
  }

  function hairline(ctx, x1, y1, x2, y2, color, w) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  }

  /* Draw an image into a box the way a window shows a photograph: the whole
     box is covered and the surplus is cropped, never letterboxed — a multi-cut
     cell must read edge to edge whatever shape the visitor handed over. */
  function drawCover(ctx, img, x, y, w, h) {
    if (!img) return false;
    var iw = img.naturalWidth || img.width || 0;
    var ih = img.naturalHeight || img.height || 0;
    if (!(iw > 0) || !(ih > 0) || !(w > 0) || !(h > 0)) return false;
    var k = Math.max(w / iw, h / ih);
    var dw = iw * k, dh = ih * k;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.restore();
    return true;
  }

  /* ── metadata helpers ---------------------------------------------------- */
  function camera(f) {
    return [f.make, f.model].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }
  function optics(f) {
    return [f.lens].filter(Boolean).join(' ');
  }
  function specParts(f) {
    return [f.focal, f.aperture, f.shutter, f.iso].filter(Boolean);
  }
  function join(vals, sep) {
    return vals.filter(Boolean).join(sep);
  }
  function dateOf(f) {
    var d = String(f.datetime || '').trim();
    if (!d) return { date: '', time: '', full: '' };
    var bits = d.split(/[\sT]+/);
    return { date: bits[0] || '', time: bits[1] || '', full: bits.filter(Boolean).join(' ') };
  }
  function specKey(f, key) {
    var v = String(f[key] || '');
    if (!v) return '';
    if (key === 'iso') return v.replace(/^ISO\s*/i, '');
    if (key === 'shutter') return v.replace(/\s*s$/, '');
    if (key === 'aperture') return v.replace(/^[ƒf]\s*\/?\s*/i, '');
    if (key === 'focal') return v.replace(/\s*mm\s*$/i, '');
    return v;
  }

  /* ── layout -------------------------------------------------------------- */
  function layout(photo, opts) {
    opts = opts || {};
    if (isMulti(opts.style)) return multiLayout(opts);
    var style = STYLES[opts.style] ? opts.style : 'gallery';
    var S = STYLES[style];
    var PW = Math.max(1, Math.round(photo.w) || 1);
    var PH = Math.max(1, Math.round(photo.h) || 1);
    var padPct = opts.padPct != null ? opts.padPct : S.geo.pad;
    var extraPct = opts.extraPct != null ? opts.extraPct : S.geo.extra;
    var radiusPct = opts.radiusPct != null ? opts.radiusPct : S.geo.radius;

    var padX = Math.round(PW * padPct / 100);
    var padTop = Math.round(padX * (style === 'film' ? 1.95 : 1));
    /* a frame that prints in its padding needs a floor to print into:
       with padPct at 0 the sprocket row and the stock badge would collapse */
    if (style === 'film') padTop = Math.max(padTop, Math.round(PW * 0.05));
    if (style === 'dual') padTop = Math.max(padTop, Math.round(PW * 0.034));
    /* the instant print's paper and the cover's masthead both live in the top
       margin, so they get a floor to print into */
    if (style === 'polaroid') padTop = Math.max(padTop, Math.round(PW * 0.028));
    if (style === 'editorial') padTop = Math.max(padTop, Math.round(PW * 0.072));
    var band = Math.round(padX + PH * extraPct / 100);
    var cap = Math.round(PW * (style === 'strap' ? 0.66 : 0.58));
    if (band > cap) band = cap;
    if (band < Math.round(PW * 0.05)) band = Math.round(PW * 0.05);

    var W = PW + padX * 2;
    var H = padTop + PH + band;

    /* free aspect ratio (Pro Studio & the geometry sheet): the plate is
       widened to the requested ratio and the surplus lands in the band. */
    var ratio = opts.ratio && Number(opts.ratio) > 0 ? Number(opts.ratio) : 0;
    if (ratio) {
      var needW = Math.round(H * ratio);
      if (needW > W) W = needW;
      H = Math.round(W / ratio);
      band = Math.max(Math.round(PW * 0.05), H - padTop - PH);
      H = padTop + PH + band;
    }

    var pbx = Math.round((W - PW) / 2);
    return {
      style: style,
      colors: S,
      S: S,
      opts: opts,
      fields: opts.fields || {},
      W: W, H: H, PW: PW, PH: PH,
      padX: padX, padTop: padTop, band: band, padBottom: band,
      ratio: ratio,
      inset: Math.max(padX, Math.round(W * 0.038)),
      radius: W * radiusPct / 100,
      u: W / 1000,
      photoBox: { x: pbx, y: padTop, w: PW, h: PH },
      emblem: opts.emblem === 'none' ? null : (opts.emblem || 'hd2lab'),
      img: photo.img
    };
  }

  /* ── shared art ---------------------------------------------------------- */
  /* Brand marks now come from the makers' own artwork, so their widths vary
     enormously (Apple is near-square, the Hasselblad wordmark is 12.8x tall).
     emFit keeps the source aspect but lets a frame cap how wide a mark may
     run, shrinking its height instead of letting the wordmark eat the row. */
  function emFit(id, h, maxW) {
    var w = E.widthFor(id, h);
    if (maxW > 0 && w > maxW) {
      h = h * (maxW / w);
      w = maxW;
    }
    return { h: h, w: w };
  }

  /* All Black is the plate's own ink for the whole mark: the maker's colour
     and HD2Lab's orange accent alike. The ink is what was chosen to survive on
     that stock, so a light frame prints black and a dark frame cream. */
  function emblemColors(L) {
    var c = L.colors;
    if (!L.opts || !L.opts.emblemMono) return c;
    return { ink: c.ink, accent: c.ink, base: c.base, light: c.light, mono: true };
  }

  function emblemAt(ctx, L, id, x, y, h, align, maxW, colors) {
    if (!id) return 0;
    var f = emFit(id, h, maxW);
    E.draw(ctx, id, x, y, f.w, f.h, colors || emblemColors(L), align || 'left');
    return f.w;
  }

  /* The twelve holes of a 35mm row, laid between two anchors.

     A perforation row that steps on a fixed pitch leaves whatever does not
     divide evenly as a stray gap at the end — on the plate that read as a wide
     empty shoulder on the right of the photo. So the row is solved instead of
     stepped: the count comes from the target pitch (a gap of 0.9 holes), and
     the step is then stretched to swallow the remainder exactly, which puts
     the first hole's left edge on `x0` and the last hole's right edge on `x1`
     with no leftover margin at either end. */
  function sprocketRow(x0, x1, h) {
    var holeW = h * 1.42, pitch = holeW * 1.9;
    var span = x1 - x0;
    var out = { holeW: holeW, pitch: pitch, step: 0, holes: [] };
    if (!(holeW > 0.5) || !(span > 0)) return out;
    if (span < holeW) return out;                       // the stock is too narrow for one hole
    if (span <= holeW * 1.2) {                          // one hole, centred in the run
      out.holes.push(x0 + (span - holeW) / 2);
      out.step = 0;
      return out;
    }
    var count = Math.max(2, Math.round((span - holeW) / pitch) + 1);
    var step = (span - holeW) / (count - 1);
    for (var i = 0; i < count; i++) out.holes.push(x0 + i * step);
    out.step = step;
    return out;
  }

  function sprockets(ctx, x0, x1, cy, h, fill) {
    /* the hole geometry collapses to zero on a plate with no padding — a zero
       pitch would make the row unbounded, so refuse it up front */
    if (!(h > 0.5)) return;
    var row = sprocketRow(x0, x1, h);
    if (!row.holes.length) return;
    var r = h * 0.2;
    ctx.save();
    ctx.fillStyle = fill;
    row.holes.forEach(function (x) {
      roundRect(ctx, x, cy - h / 2, row.holeW, h, r);
      ctx.fill();
    });
    ctx.restore();
  }

  /* A vertical run of perforations, for a strip of four cells: the hole sits
     in the middle of its own margin, and the run is solved between its two
     anchors the way the horizontal row is — the count comes from the target
     pitch (1.9 holes end to end), the step then stretches to swallow the
     remainder exactly. The first hole's top edge lands on `y0` and the last
     hole's bottom edge on `y1`, so the perforation starts and ends with the
     photograph block instead of trailing off into a leftover gap. */
  function sprocketsCol(ctx, y0, y1, cx, w, h, fill) {
    if (!(w > 0.5) || !(h > 0.5) || !(y1 > y0)) return;
    var span = y1 - y0, pitch = h * 1.9, r = w * 0.2;
    if (span < h) return;                               // the strip is too short for one hole
    ctx.save();
    ctx.fillStyle = fill;
    if (span <= h * 1.2) {                              // one hole, centred in the run
      roundRect(ctx, cx - w / 2, y0 + (span - h) / 2, w, h, r);
      ctx.fill();
      ctx.restore();
      return;
    }
    var count = Math.max(2, Math.round((span - h) / pitch) + 1);
    var step = (span - h) / (count - 1);
    for (var i = 0; i < count; i++) {
      roundRect(ctx, cx - w / 2, y0 + i * step, w, h, r);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ── 01 Clean Horizon ──────────────────────────────────────────────────── */
  /* The maker row prints the maker's own emblem where the make name used to
     sit, with the model set beside it as one optically centred lockup:
     [SAMSUNG mark]  Galaxy S26 Ultra. The mark is sized under the type's cap
     height, the gap is one fixed optical beat, and the pair centres on the
     plate as a single group. 'None' (or a make no emblem matches) hands the
     row back to the plain make + model line. */
  function horizonLockup(ctx, L, id, label, size, rowY, cx, maxW) {
    var u = L.u, band = L.band, c = L.colors;
    var gap = u * 12;
    /* the emblem may take a third of the row at most: an ultra-wide wordmark
       shrinks instead of eating the model name */
    var emMaxW = Math.max(u * 56, maxW * 0.34);
    var emH = emFit(id, Math.min(u * 26, band * 0.22), emMaxW).h;
    var emW = emFit(id, emH, emMaxW).w;

    var opt = { size: size, weight: 300, family: L.opts.font, color: c.ink, ls: u * 0.6 };
    var labelW = measure(ctx, label, opt);
    var room = Math.max(0, maxW - emW - gap);
    if (labelW > room && labelW > 0) {
      /* shrink the type only as far as the floor allows; text() finishes the
         job (it ellipsises below the floor) so nothing leaves the plate */
      var k = Math.max(MIN_SHRINK, room / labelW);
      opt.size = size * k;
      opt.ls = u * 0.6 * k;
      labelW = measure(ctx, label, opt);
    }

    /* optical centring: the mark rides on the type's optical middle, a touch
       above the baseline, rather than on the baseline itself */
    var emTop = rowY - opt.size * 0.34 - emH / 2;
    var x0 = cx - (emW + gap + labelW) / 2;
    emblemAt(ctx, L, id, x0, emTop, emH, 'left', emMaxW, emblemColors(L));
    text(ctx, label, x0 + emW + gap, rowY, {
      size: opt.size, weight: opt.weight, family: opt.family, color: c.ink,
      ls: opt.ls, align: 'left', maxW: room
    });
  }

  function drawHorizon(ctx, L) {
    var f = L.fields, c = L.colors, u = L.u, band = L.band, top = L.photoBox.y + L.PH;
    var cx = L.W / 2, maxW = L.W - L.inset * 2;
    var camSize = Math.min(u * 30, band * 0.26);
    var make = String(f.make || '').trim();
    var model = String(f.model || '').trim();
    var emId = L.emblem && E && E.has(L.emblem) ? L.emblem : null;
    var rowY = top + band * 0.36;

    if (emId && (model || make)) {
      horizonLockup(ctx, L, emId, model || make, camSize, rowY, cx, maxW);
    } else {
      compound(ctx, [
        { s: make, size: camSize, weight: 700, family: L.opts.font, color: c.ink, ls: u * 0.6 },
        { s: model ? '  ' + model : '', size: camSize, weight: 300, family: L.opts.font, color: c.ink, ls: u * 0.6 }
      ], cx, rowY, 'center', maxW);
    }

    text(ctx, join(specParts(f), '  ·  '), cx, top + band * 0.58, {
      size: Math.min(u * 15, band * 0.13), family: 'mono', color: c.muted,
      ls: u * 1.4, align: 'center', maxW: maxW
    });

    var footDate = dateOf(f).full;
    if (footDate || f.caption) {
      hairline(ctx, cx - u * 38, top + band * 0.68, cx + u * 38, top + band * 0.68, c.line, Math.max(1, u));
      var footSize = Math.min(u * 11, band * 0.095);
      var footY = top + band * 0.84;
      if (f.caption && isCustomCaption(L)) {
        /* the date is the frame's record and keeps its mono; only the
           signature changes its voice, so the two are set as two runs */
        var fs = captionStyle(L, 'mono', 400, false);
        compound(ctx, [
          { s: footDate, size: footSize, family: 'mono', color: c.muted, ls: u * 1.2 },
          { s: footDate ? '   ·   ' : '', size: footSize, family: 'mono', color: c.muted, ls: u * 1.2 },
          { s: f.caption, size: footSize, family: fs.family, weight: fs.weight, italic: fs.italic,
            color: c.muted, ls: fs.script ? 0 : u * 1.2 }
        ], cx, footY, 'center', maxW);
      } else {
        text(ctx, join([footDate, f.caption], '   ·   '), cx, footY, {
          size: footSize, family: 'mono', color: c.muted,
          ls: u * 1.2, align: 'center', maxW: maxW
        });
      }
    }
  }

  /* ── 02 Classic Gallery ────────────────────────────────────────────────── */
  /* A 13% matte instead of 17%: the rows close up (mark 0.075, spec 0.40,
     rule 0.53, signature 0.685, date 0.855) and every size carries a band
     ceiling of its own, so on a thin plate the copy keeps the presence it had
     in the taller band instead of shrinking with the air around it. The mark
     is capped against the spec row it sits above, so even the 12.8:1 Hasselblad
     wordmark cannot reach it. */
  function drawGallery(ctx, L) {
    var f = L.fields, c = L.colors, u = L.u, band = L.band;
    var top = L.photoBox.y + L.PH, cx = L.W / 2, maxW = L.W - L.inset * 2;
    var specSize = Math.min(u * 15, band * 0.105);
    var specY = top + band * 0.4;
    var emTop = top + band * 0.075;
    var emH = Math.min(u * 30, band * 0.2,
      Math.max(u * 8, specY - specSize * 0.85 - emTop - band * 0.03));

    if (L.emblem) {
      var ef = emFit(L.emblem, emH, L.W * 0.46);
      emblemAt(ctx, L, L.emblem, cx - ef.w / 2, emTop, emH, 'left', L.W * 0.46);
    }

    text(ctx, join([camera(f)].concat(specParts(f)), '   ·   '), cx, specY, {
      size: specSize, family: L.opts.font, weight: 500,
      color: c.muted, ls: u * 1.5, align: 'center', maxW: maxW
    });

    if (f.caption) {
      var ruleY = top + band * 0.53;
      hairline(ctx, cx - u * 34, ruleY, cx + u * 34, ruleY, c.line, Math.max(1, u * 1.1));
      text(ctx, f.caption, cx, top + band * 0.685, captionOpt(L, {
        size: Math.min(u * 27, band * 0.13), family: 'serif', italic: true, weight: 400,
        color: c.ink, align: 'center', ls: u * 0.2, maxW: L.W - L.inset * 3
      }));
    }

    text(ctx, dateOf(f).full, cx, top + band * 0.855, {
      size: Math.min(u * 11, band * 0.078), family: 'mono', color: c.muted,
      ls: u * 1.6, align: 'center', maxW: maxW
    });
  }

  /* ── 03 Dual Deck ──────────────────────────────────────────────────────── */
  /* Also a 13.5% deck: the rule rides at 0.13, the exposure row at 0.42, the
     focal/date row at 0.66 and a caption at 0.86. Each size keeps a band
     ceiling generous enough to hold its weight on a shallow deck (the deck
     used to be 21%, so a ceiling of the same fraction would have shrunk the
     type by a third) while the u ceiling still governs on a wide plate. */
  function drawDual(ctx, L) {
    var f = L.fields, c = L.colors, u = L.u, band = L.band;
    var top = L.photoBox.y + L.PH, cx = L.W / 2, maxW = L.W - L.inset * 2;

    // upper deck — the camera & lens ride in the top margin
    if (L.padTop > u * 26) {
      text(ctx, join([camera(f), optics(f)], '   ·   '), cx, L.padTop * 0.62, {
        size: Math.min(u * 14, L.padTop * 0.4), family: 'mono', color: c.muted,
        ls: u * 1.3, align: 'center', maxW: maxW
      });
    }

    hairline(ctx, L.inset, top + band * 0.13, L.W - L.inset, top + band * 0.13, c.line, Math.max(1, u * 1.1));

    // lower deck — exposure block, two centred rows
    var exposure = join([f.aperture, f.shutter, f.iso], '   ·   ');
    var second = join([f.focal, dateOf(f).full], '   ·   ');

    text(ctx, exposure, cx, top + band * 0.42, {
      size: Math.min(u * 24, band * 0.2), family: L.opts.font, weight: 600,
      color: c.ink, ls: u * 2, align: 'center', maxW: maxW
    });
    text(ctx, second, cx, top + band * 0.66, {
      size: Math.min(u * 13, band * 0.11), family: 'mono', color: c.muted,
      ls: u * 1.5, align: 'center', maxW: maxW
    });

    if (f.caption) {
      text(ctx, f.caption, cx, top + band * 0.86, captionOpt(L, {
        size: Math.min(u * 11, band * 0.09), family: 'serif', italic: true,
        color: c.muted, ls: u * 0.4, align: 'center', maxW: maxW
      }));
    }
  }

  /* ── 04 Strap Bar ──────────────────────────────────────────────────────── */
  function drawStrapBase(ctx, L) {
    var top = L.photoBox.y + L.PH;
    ctx.save();
    ctx.fillStyle = L.colors.band || L.colors.base;
    ctx.fillRect(0, top, L.W, L.H - top);
    ctx.restore();
  }

  /* The bar's two working rows and the stitching that closes it. Kept in one
     place so the row layout and the tests read the same numbers. */
  function strapBand(L) {
    var top = L.photoBox.y + L.PH;
    return {
      top: top,
      band: L.band,
      row1: top + L.band * 0.33,
      row2: top + L.band * 0.63,
      stitchY: L.H - Math.max(L.u * 10, L.band * 0.08)
    };
  }

  function drawStrap(ctx, L) {
    var f = L.fields, c = L.colors, u = L.u, band = L.band;
    var top = L.photoBox.y + L.PH, inset = L.inset, sb = strapBand(L);

    // top edge of the strap
    hairline(ctx, 0, top, L.W, top, c.line, Math.max(1, u * 1.4));

    /* the bar is a strap, not a second page: the rows sit near the top and the
       stitching closes the bottom, so the air above the first row and below the
       last one are both small and equal-ish instead of swallowing the band */
    var row1 = sb.row1;
    var row2 = sb.row2;
    var primary = Math.min(u * 20, band * 0.19);
    var secondary = Math.min(u * 13, band * 0.12);

    var rightTop = join([camera(f)], '');
    var rightBot = optics(f);

    var topW = measure(ctx, rightTop, { size: primary, family: L.opts.font, weight: 600, ls: u * 0.5 });
    var botW = measure(ctx, rightBot, { size: secondary, family: 'mono', ls: u * 0.9 });
    var widest = Math.max(topW, botW);
    /* the right column never crosses the divider, and the left column is
       measured with the emblem already taken out of its run */
    var rightMaxW = Math.max(u * 90, Math.min(widest, L.W * 0.42 - inset));
    var divX = Math.max(L.W * 0.52, L.W - inset - rightMaxW - u * 34);
    var emH = L.emblem ? Math.min(u * 30, band * 0.22) : 0;
    var emFitS = L.emblem ? emFit(L.emblem, emH, Math.max(u * 90, Math.min(u * 280, (divX - inset) * 0.24))) : { h: 0, w: 0 };
    var emW = emFitS.w;
    emH = emFitS.h;
    var leftMaxW = Math.max(u * 120, divX - inset - (L.emblem ? emW + u * 44 : u * 26));

    // left column — exposure, then the signature / date
    text(ctx, join(specParts(f), '   ·   '), inset, row1, {
      size: primary, family: L.opts.font, weight: 600, color: c.ink, ls: u * 0.8,
      maxW: leftMaxW
    });
    if (f.caption && isCustomCaption(L)) {
      /* the stamp prefix is the bar's furniture; the name after it is the
         visitor's, so the two are set as two runs on the same baseline */
      var srow = captionStyle(L, 'mono', 400, false);
      compound(ctx, [
        { s: 'SHOT BY © ', size: secondary, family: 'mono', color: c.muted, ls: u * 1.4 },
        { s: f.caption, size: secondary, family: srow.family, weight: srow.weight,
          italic: srow.italic, color: c.muted, ls: srow.script ? 0 : u * 1.4 }
      ], inset, row2, 'left', leftMaxW);
    } else {
      text(ctx, f.caption ? 'SHOT BY © ' + f.caption : dateOf(f).full, inset, row2, {
        size: secondary, family: 'mono', color: c.muted, ls: u * 1.4, upper: true,
        maxW: leftMaxW
      });
    }
    // right column — body and lens
    text(ctx, rightTop, L.W - inset, row1, {
      size: primary, family: L.opts.font, weight: 600, color: c.ink, ls: u * 0.5,
      align: 'right', maxW: rightMaxW
    });
    text(ctx, rightBot, L.W - inset, row2, {
      size: secondary, family: 'mono', color: c.muted, ls: u * 0.9,
      align: 'right', maxW: rightMaxW
    });

    // divider rule
    hairline(ctx, divX, top + band * 0.16, divX, top + band * 0.76, c.line, Math.max(1, u * 1.4));

    // maker emblem tucked against the divider, centred on its own row band
    if (L.emblem) {
      emblemAt(ctx, L, L.emblem, divX - u * 26 - emW, top + band * 0.46 - emH / 2, emH);
    }

    // strap stitching along the bottom edge
    var stitchY = sb.stitchY;
    ctx.save();
    ctx.strokeStyle = 'rgba(17,17,17,0.22)';
    ctx.lineWidth = Math.max(1, u * 1.2);
    ctx.setLineDash([u * 7, u * 6]);
    ctx.beginPath();
    ctx.moveTo(inset, stitchY);
    ctx.lineTo(L.W - inset, stitchY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    /* the mark rides just above the stitching on the right — never on it, and
       only when the bar is tall enough to hold it without crowding row two */
    if (band > u * 150) {
      text(ctx, 'HD2LAB  ·  STRAP 04', L.W - inset, stitchY - u * 7, {
        size: u * 8.5, family: 'mono', color: c.muted, ls: u * 2.2, align: 'right'
      });
    }
  }

  /* ── 05 Film Sprocket ──────────────────────────────────────────────────── */
  /* One row of perforations at each margin. Each row owns a rail — the strip
     between its own edge and its own rule — and the hole sits in the middle of
     that rail, so the gap from the edge to the hole equals the gap from the
     hole to the rule. Both rails are cut to the same height, which makes the
     two margins exact mirror images: 35mm stock reads the same way up or down.
     The rail height is capped below the top margin so that a plate with little
     padding (padPct 0 keeps only the 5% floor) still has room for the stock
     badge between the rail and the photo. `flow` is what is left of the caption
     band once the bottom rail has claimed its strip — the print block every
     line below must live in. */
  function filmPerf(L) {
    var band = L.padBottom;
    var holeH = Math.max(L.u * 6, Math.min(L.padTop * 0.19, band * 0.12));
    var edgeCy = Math.max(holeH * 0.85, Math.min(L.padTop * 0.26, band * 0.14));
    var railH = Math.min(edgeCy * 2, L.padTop * 0.56);
    var top = L.photoBox.y + L.PH;
    return {
      holeH: holeH,
      edgeCy: edgeCy,
      railH: railH,
      topRuleY: railH,
      botRuleY: L.H - railH,
      topCy: railH / 2,
      botCy: L.H - railH / 2,
      flow: Math.max(L.u * 4, L.H - railH - top)
    };
  }

  function drawFilmBase(ctx, L) {
    var u = L.u;
    var hole = 'rgba(238,229,210,0.74)';
    var perf = filmPerf(L);

    /* the two rows are printed to the photograph's own width, not to the
       plate's: the first hole opens exactly on the photo's left edge and the
       last one closes exactly on its right edge, so the perforation is the
       stock the picture is mounted on instead of a strip that starts and ends
       somewhere in the margin */
    var x0 = L.photoBox.x, x1 = L.photoBox.x + L.PW;
    sprockets(ctx, x0, x1, perf.topCy, perf.holeH, hole);
    sprockets(ctx, x0, x1, perf.botCy, perf.holeH, hole);

    /* each rule closes its own rail, so the two margins are one measurement */
    hairline(ctx, 0, perf.topRuleY, L.W, perf.topRuleY, L.colors.line, Math.max(1, u * 1.1));
    hairline(ctx, 0, perf.botRuleY, L.W, perf.botRuleY, L.colors.line, Math.max(1, u * 1.1));
  }

  function drawFilm(ctx, L) {
    var f = L.fields, c = L.colors, u = L.u, pad = L.inset, W = L.W;
    var perf = filmPerf(L);
    /* every line of copy is a fraction of `flow`, not of the whole band, and
       every size carries the same factor — the block is the old one scaled to
       the room the symmetric foot row leaves, so nothing gains or loses grip */
    var flow = perf.flow;
    var g = L.band > 0 ? flow / L.band : 1;
    var top = L.photoBox.y + L.PH;
    var inner = W - pad * 2;

    // frame line around the photo
    ctx.save();
    ctx.strokeStyle = 'rgba(240,233,217,0.3)';
    ctx.lineWidth = Math.max(1, u * 1.4);
    ctx.strokeRect(L.photoBox.x, L.photoBox.y, L.photoBox.w, L.photoBox.h);
    ctx.restore();

    /* stock badge + frame number ride in the top margin, each owning its own
       share of the inner width so one never runs over the other */
    var badgeSize = Math.min(u * 12.5, L.padTop * 0.26);
    /* the badge owns the strip between the top rail and the photo and sits in
       the middle of it: a baseline on the exact midline would leave the caps
       riding high, so the baseline drops by half a cap height and the air above
       and below the letters is the same. It can never reach the rail or the
       photo's frame line. */
    var badgeY = (perf.topRuleY + L.photoBox.y) / 2 + badgeSize * 0.35;
    var frameStr = (L.opts.frameNo || '#03') + '   ·   35MM';
    var frameMaxW = Math.min(
      measure(ctx, frameStr, { size: badgeSize, family: 'mono', ls: u * 1.8 }), inner * 0.42);
    text(ctx, (L.opts.stock || 'KODAK PORTRA 400'), pad, badgeY, {
      size: badgeSize, family: 'mono', color: c.ink,
      ls: u * 1.8, maxW: Math.max(u * 120, inner - frameMaxW - u * 24)
    });
    text(ctx, frameStr, W - pad, badgeY, {
      size: badgeSize, family: 'mono', color: c.accent,
      ls: u * 1.8, align: 'right', maxW: frameMaxW
    });

    /* right stack — ISO / SEC / F, the way the negative edge prints it.
       Measured first so the left column gets exactly the room that is left. */
    var pairs = [
      { k: 'ISO', v: specKey(f, 'iso') },
      { k: 'SEC', v: specKey(f, 'shutter') },
      { k: 'F', v: specKey(f, 'aperture') }
    ].filter(function (p) { return p.v; });

    var valSize = Math.min(u * 30, L.band * 0.13) * g;
    var keySize = Math.min(u * 13, L.band * 0.058) * g;
    var stackW = 0;
    pairs.forEach(function (p) {
      var vw = measure(ctx, p.v, { size: valSize, family: 'mono', weight: 500 });
      var kw = measure(ctx, p.k, { size: keySize, family: 'mono', ls: u });
      stackW = Math.max(stackW, vw + u * 10 + kw);
    });
    var leftMaxW = Math.max(u * 140, inner - stackW - u * 24);

    /* The mark owns the pocket between the photo's frame line and the caption
       and is centred in it: sized against the flow (28u, never more than a
       fifth of it) it reads as the top of the print block instead of a stray
       17u glyph up in the corner, and it can no longer reach the caption on a
       slim band because the caption's own cap height is taken out first. */
    var capSize = Math.min(u * 22, L.band * 0.1) * g;
    var capY = top + flow * 0.41;
    var pocketTop = top + flow * 0.05;
    var pocket = Math.max(u * 8, capY - capSize * 0.9 - pocketTop);
    var emH = Math.min(Math.max(u * 20, Math.min(u * 28, flow * 0.17)), pocket);
    if (L.emblem) {
      emblemAt(ctx, L, L.emblem, pad, pocketTop + (pocket - emFit(L.emblem, emH, inner * 0.42).h) / 2,
               emH, 'left', inner * 0.42);
    }

    text(ctx, f.caption || camera(f), pad, capY, captionOpt(L, {
      size: capSize, family: 'serif', italic: true,
      color: c.ink, ls: u * 0.3, maxW: leftMaxW
    }, !f.caption));

    text(ctx, join([camera(f), f.focal], '   ·   '), pad, top + flow * 0.6, {
      size: Math.min(u * 13.5, L.band * 0.062) * g, family: 'mono', color: c.muted,
      ls: u * 1.1, maxW: leftMaxW
    });
    text(ctx, optics(f), pad, top + flow * 0.72, {
      size: Math.min(u * 12, L.band * 0.055) * g, family: 'mono', color: c.muted,
      ls: u * 0.9, maxW: leftMaxW
    });
    /* the date line ends the block, a clear step above the perforation row */
    text(ctx, dateOf(f).full, pad, top + flow * 0.85, {
      size: Math.min(u * 12, L.band * 0.055) * g, family: 'mono', color: c.muted,
      ls: u * 1.1, maxW: Math.min(leftMaxW, W * 0.6)
    });

    var rx = W - pad, ry = top + flow * 0.24;
    pairs.forEach(function (p) {
      var vw = text(ctx, p.v, rx, ry, {
        size: valSize, family: 'mono', weight: 500, color: c.ink, align: 'right'
      });
      text(ctx, p.k, rx - vw - u * 10, ry - u * 2, {
        size: keySize, family: 'mono', color: c.accent, align: 'right', ls: u * 1
      });
      ry += flow * 0.18;
    });
  }

  /* ── 06 Studio Dark ────────────────────────────────────────────────────── */
  function drawStudio(ctx, L) {
    var f = L.fields, c = L.colors, u = L.u, band = L.band;
    var top = L.photoBox.y + L.PH, pad = L.inset, W = L.W;
    var inner = W - pad * 2, gutter = u * 28;

    // accent rail
    var railY = top + band * 0.11;
    hairline(ctx, pad, railY, W - pad, railY, c.line, Math.max(1, u * 1.2));
    ctx.save();
    ctx.fillStyle = c.accent;
    ctx.fillRect(pad, railY - u * 1.4, u * 96, u * 2.8);
    ctx.restore();

    /* the right column is measured first; the left column then claims what is
       left of the inner width, so a long exposure line never pushes into it */
    var specStr = join(specParts(f), '   ·   ');
    var specSize = Math.min(u * 15, band * 0.078);
    var dateStr = dateOf(f).full;
    var dateSize = Math.min(u * 12, band * 0.06);
    var rightW = Math.min(inner * 0.62, Math.max(
      measure(ctx, specStr, { size: specSize, family: 'mono', ls: u * 0.6 }),
      measure(ctx, dateStr, { size: dateSize, family: 'mono', ls: u * 0.6 })
    ));

    // emblem + camera block, both riding the 0.44 line, the lens row at 0.63
    var emH = Math.min(u * 32, band * 0.26);
    var emMaxW = 0;
    if (L.emblem) {
      emMaxW = inner - gutter - rightW - u * 30 - u * 240;
      emH = Math.max(u * 14, Math.min(emH, emMaxW / (E.widthFor(L.emblem, 1) || 1)));
    }
    var rowY = top + band * 0.44;
    /* centred on the type's optical middle, not on its baseline: the mark and
       the model name are one lockup and the name's ink sits above rowY */
    var emFitS = L.emblem ? emFit(L.emblem, emH, Math.max(u * 90, emMaxW)).h : emH;
    var headSize = Math.min(u * 22, band * 0.105);
    var emW = emblemAt(ctx, L, L.emblem, pad, rowY - headSize * 0.36 - emFitS / 2, emH,
                       'left', Math.max(u * 90, emMaxW));
    var tx = pad + (L.emblem ? emW + u * 30 : 0);
    var leftMaxW = Math.max(u * 120, inner - (tx - pad) - gutter - rightW);

    text(ctx, L.emblem ? (f.model || f.make || '') : camera(f), tx, rowY, {
      size: headSize, family: L.opts.font, weight: 600,
      color: c.ink, ls: u * 0.4, maxW: leftMaxW
    });
    text(ctx, optics(f), tx, top + band * 0.63, {
      size: Math.min(u * 13, band * 0.07), family: 'mono', color: c.muted,
      ls: u * 0.9, maxW: leftMaxW
    });

    text(ctx, specStr, W - pad, rowY, {
      size: specSize, family: 'mono', color: c.ink,
      ls: u * 0.6, align: 'right', maxW: rightW
    });
    text(ctx, dateStr, W - pad, top + band * 0.63, {
      size: dateSize, family: 'mono', color: c.muted,
      ls: u * 0.6, align: 'right', maxW: rightW
    });

    /* the footer keeps the band's own rhythm and moves clear of the lower
       corner brackets: sideways past the bracket's arm, and high enough that
       its letters sit above that arm instead of hanging outside the corner
       mark. The bracket is cut from `u` but capped by the band, so on a slim
       band it shrinks with the mat and leaves the footer its room. */
    var bInset = Math.min(u * 16, band * 0.11), bLen = Math.min(u * 26, band * 0.17);
    var footX = Math.max(pad, bInset + bLen + u * 8);
    var footY = L.H - Math.max(band * 0.14, bInset + u * 9);
    if (f.caption) {
      text(ctx, f.caption, footX, footY, captionOpt(L, {
        size: Math.min(u * 11.5, band * 0.058), family: 'mono', color: c.muted,
        upper: true, ls: u * 1.4, maxW: W * 0.6
      }));
    }
    text(ctx, 'SHUTTERPLATE · 03', W - footX, footY, {
      size: Math.min(u * 11.5, band * 0.058), family: 'mono', color: c.muted,
      ls: u * 1.4, align: 'right', maxW: W * 0.4
    });

    // signature corner brackets
    var inset = bInset, len = bLen, lw = Math.max(1.2, u * 2);
    ctx.save();
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(inset, inset + len); ctx.lineTo(inset, inset); ctx.lineTo(inset + len, inset);
    ctx.moveTo(W - inset - len, inset); ctx.lineTo(W - inset, inset); ctx.lineTo(W - inset, inset + len);
    ctx.moveTo(inset, L.H - inset - len); ctx.lineTo(inset, L.H - inset); ctx.lineTo(inset + len, L.H - inset);
    ctx.moveTo(W - inset - len, L.H - inset); ctx.lineTo(W - inset, L.H - inset); ctx.lineTo(W - inset, L.H - inset - len);
    ctx.stroke();
    ctx.restore();
  }

  /* ── 07 Minimal Edge ───────────────────────────────────────────────────── */
  function drawEdgeFrame(ctx, L) {
    // a hairline just inside the outer edge — the "slim border" of a dry mount
    ctx.save();
    ctx.strokeStyle = 'rgba(17,17,17,0.16)';
    ctx.lineWidth = Math.max(1, L.u * 1.1);
    ctx.strokeRect(L.u * 7, L.u * 7, L.W - L.u * 14, L.H - L.u * 14);
    ctx.restore();
  }

  function drawEdge(ctx, L) {
    var f = L.fields, c = L.colors, u = L.u, band = L.band;
    var top = L.photoBox.y + L.PH, inset = L.inset;

    hairline(ctx, inset, top + band * 0.16, L.W - inset, top + band * 0.16, c.line, Math.max(1, u));

    // accent bullet + a single tracked row
    var rowY = top + band * 0.62;
    var bullet = Math.max(2, u * 6);
    ctx.save();
    ctx.fillStyle = c.accent;
    ctx.fillRect(inset, rowY - bullet, bullet, bullet);
    ctx.restore();

    var lineX = inset + bullet + u * 14;
    var dateStr = dateOf(f).full;
    var dateSize = Math.min(u * 11, band * 0.16);
    var dateMaxW = L.W * 0.34;
    var dateW = dateStr
      ? Math.min(measure(ctx, dateStr, { size: dateSize, family: 'mono', ls: u * 1.2 }), dateMaxW)
      : 0;
    text(ctx, join([camera(f)].concat(specParts(f)), '  ·  '), lineX, rowY, {
      size: Math.min(u * 14, band * 0.2), family: 'mono', weight: 500, color: c.ink,
      ls: u * 1.4,
      maxW: Math.max(u * 120, L.W - lineX - inset - (dateW ? dateW + u * 20 : 0))
    });
    if (dateStr) {
      text(ctx, dateStr, L.W - inset, rowY, {
        size: dateSize, family: 'mono', color: c.muted,
        ls: u * 1.2, align: 'right', maxW: dateMaxW
      });
    }
  }

  /* ── 08 Pro Studio ─────────────────────────────────────────────────────── */
  function drawPro(ctx, L) {
    var f = L.fields, c = L.colors, u = L.u, band = L.band;
    var top = L.photoBox.y + L.PH, pad = L.inset, W = L.W;
    var inner = W - pad * 2;

    /* the mark rides on the headline's optical middle rather than on a fixed
       height in the band: pinned to band*0.12 a 28u apple read a full 11u
       above the model name it belongs to. Same principle as horizonLockup. */
    var headSize = Math.min(u * 22, band * 0.085);
    var headY = top + band * 0.21;
    var emH = Math.min(u * 28, band * 0.14);
    var emMaxW = inner * 0.4;
    var emTop = headY - headSize * 0.36 - (L.emblem ? emFit(L.emblem, emH, emMaxW).h : emH) / 2;
    var emW = emblemAt(ctx, L, L.emblem, pad, emTop, emH, 'left', emMaxW);
    var tx = pad + (L.emblem ? emW + u * 24 : 0);
    /* the date owns its own column on the headline row; the model and lens are
       measured against what is left after the emblem */
    var dateStr = dateOf(f).full;
    var dateSize = Math.min(u * 12, band * 0.045);
    var dateW = Math.min(
      measure(ctx, dateStr, { size: dateSize, family: 'mono', ls: u * 1.1 }), inner * 0.32);
    var usedX = tx - pad;
    var headMaxW = Math.max(u * 120, inner - usedX - dateW - u * 24);

    text(ctx, L.emblem ? (f.model || f.make || '') : camera(f), tx, headY, {
      size: headSize, family: L.opts.font, weight: 600,
      color: c.ink, ls: u * 0.3, maxW: headMaxW
    });
    text(ctx, dateStr, W - pad, headY, {
      size: dateSize, family: 'mono', color: c.muted,
      ls: u * 1.1, align: 'right', maxW: dateW
    });
    text(ctx, optics(f), tx, top + band * 0.30, {
      size: Math.min(u * 12.5, band * 0.048), family: 'mono', color: c.muted,
      ls: u * 0.8, maxW: Math.max(u * 120, inner - usedX)
    });

    hairline(ctx, pad, top + band * 0.37, W - pad, top + band * 0.37, c.line, Math.max(1, u * 1.2));

    // full specification grid — two columns, two rows
    var cells = [
      { label: 'ISO', value: f.iso },
      { label: 'SHUTTER', value: f.shutter },
      { label: 'APERTURE', value: f.aperture },
      { label: 'FOCAL', value: f.focal }
    ];
    var colW = inner / 2;
    var rowY = [top + band * 0.46, top + band * 0.63];
    cells.forEach(function (cell, i) {
      var cx0 = pad + (i % 2) * colW;
      var y = rowY[Math.floor(i / 2)];
      text(ctx, cell.label, cx0, y, {
        size: Math.min(u * 9.5, band * 0.033), family: 'mono', color: c.accent,
        ls: u * 2, maxW: colW * 0.9
      });
      text(ctx, cell.value || '—', cx0, y + band * 0.095, {
        size: Math.min(u * 19, band * 0.072), family: L.opts.font, weight: 500,
        color: c.ink, ls: u * 0.4, maxW: colW * 0.9
      });
    });

    hairline(ctx, pad, L.H - band * 0.17, W - pad, L.H - band * 0.17, c.line, Math.max(1, u));
    if (f.caption) {
      text(ctx, f.caption, pad, L.H - band * 0.075, captionOpt(L, {
        size: Math.min(u * 11, band * 0.04), family: 'mono', color: c.muted,
        upper: true, ls: u * 1.6, maxW: inner * 0.6
      }));
    }
    text(ctx, 'HD2LAB · PRO STUDIO 08', W - pad, L.H - band * 0.075, {
      size: Math.min(u * 10, band * 0.036), family: 'mono', color: c.muted,
      ls: u * 1.6, align: 'right', maxW: inner * 0.4
    });
  }

  /* ── 09 Instant Polaroid ───────────────────────────────────────────────── */
  /* An instant print: one wide, quiet chin under the picture. The caption is
     the line the print exists for, the exposure sits under it in the small
     mono the lab stamped on the back, and the maker's mark closes the chin the
     way a wordmark is printed into the paper. */
  function drawPolaroid(ctx, L) {
    var f = L.fields, c = L.colors, u = L.u, band = L.band;
    var top = L.photoBox.y + L.PH, cx = L.W / 2;
    var maxW = L.W - L.inset * 2.2;

    /* the picture sits in the paper, never on it — a hairline seats it */
    ctx.save();
    ctx.strokeStyle = 'rgba(32,33,30,0.13)';
    ctx.lineWidth = Math.max(1, u * 1.2);
    ctx.strokeRect(L.photoBox.x + u, L.photoBox.y + u,
                   Math.max(1, L.photoBox.w - u * 2), Math.max(1, L.photoBox.h - u * 2));
    ctx.restore();

    var capSize = Math.max(u * 8, Math.min(u * 40, band * 0.22));
    text(ctx, f.caption || camera(f) || 'HD2Lab Shutterplate', cx, top + band * 0.28, captionOpt(L, {
      size: capSize, family: 'serif', italic: true, color: c.ink,
      ls: u * 0.4, align: 'center', maxW: maxW
    }, !f.caption));

    var spec = join([f.make, f.model, f.focal, f.aperture, f.shutter, f.iso], '  ·  ');
    text(ctx, spec, cx, top + band * 0.475, {
      size: Math.min(u * 12, band * 0.062), family: 'mono', color: c.muted,
      ls: u * 1.2, align: 'center', maxW: maxW
    });

    var date = dateOf(f).full;
    if (date) {
      text(ctx, date, cx, top + band * 0.60, {
        size: Math.min(u * 12, band * 0.062), family: 'mono', color: c.muted,
        ls: u * 1.6, align: 'center', maxW: maxW
      });
    }

    if (L.emblem) {
      var emH = Math.max(u * 8, Math.min(u * 18, band * 0.10));
      var ef = emFit(L.emblem, emH, L.W * 0.3);
      emblemAt(ctx, L, L.emblem, cx - ef.w / 2, top + band * 0.72, emH, 'left', L.W * 0.3);
    }
  }

  /* ── 10 Frosted Glass ──────────────────────────────────────────────────── */
  /* The photograph is its own light source: the same frame, blown up, blurred
     and dimmed behind glass, so the plate glows in the colours of the picture
     and the copy sits on a frosted panel instead of on a colour card. */
  function drawFrostedBase(ctx, L) {
    var W = L.W, H = L.H;
    ctx.save();
    if (L.img) {
      try { ctx.filter = 'blur(' + (W * 0.035).toFixed(1) + 'px) saturate(140%) brightness(1.05)'; } catch (e) { /* no filter */ }
      drawCover(ctx, L.img, 0, 0, W, H);
      ctx.filter = 'none';
    } else {
      ctx.fillStyle = '#0d1114';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();

    ctx.save();
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(9,13,17,0.30)');
    g.addColorStop(0.55, 'rgba(9,13,17,0.22)');
    g.addColorStop(1, 'rgba(9,13,17,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawFrosted(ctx, L) {
    var f = L.fields, c = L.colors, u = L.u, band = L.band;
    var top = L.photoBox.y + L.PH, pad = L.inset, W = L.W;
    var inner = Math.max(1, W - pad * 2);

    /* the frosted panel the caption band is read through */
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, top, W, L.H - top);
    ctx.strokeStyle = 'rgba(255,255,255,0.34)';
    ctx.lineWidth = Math.max(1, u * 1.2);
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(W, top);
    ctx.stroke();
    ctx.restore();

    /* a glass edge around the picture: one bright hairline */
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = Math.max(1, u * 1.1);
    ctx.strokeRect(L.photoBox.x, L.photoBox.y, Math.max(1, L.photoBox.w), Math.max(1, L.photoBox.h));
    ctx.restore();

    text(ctx, camera(f), pad, top + band * 0.30, {
      size: Math.min(u * 22, band * 0.17), family: L.opts.font, weight: 600,
      color: c.ink, ls: u * 0.4, maxW: inner * 0.6
    });
    text(ctx, dateOf(f).full, W - pad, top + band * 0.30, {
      size: Math.min(u * 12, band * 0.08), family: 'mono', color: c.muted,
      ls: u * 1.1, align: 'right', maxW: inner * 0.32
    });

    text(ctx, join(specParts(f), '   ·   '), pad, top + band * 0.55, {
      size: Math.min(u * 14, band * 0.095), family: 'mono', color: c.ink,
      ls: u * 1.2, maxW: inner * 0.64
    });
    if (L.emblem) {
      var emH = Math.min(u * 26, band * 0.2);
      var ef = emFit(L.emblem, emH, inner * 0.26);
      emblemAt(ctx, L, L.emblem, W - pad - ef.w, top + band * 0.55 - ef.h / 2,
               emH, 'left', inner * 0.26);
    }

    text(ctx, optics(f), pad, top + band * 0.73, {
      size: Math.min(u * 12, band * 0.07), family: 'mono', color: c.muted,
      ls: u * 1, maxW: inner * 0.72
    });

    if (f.caption) {
      text(ctx, f.caption, pad, top + band * 0.90, captionOpt(L, {
        size: Math.min(u * 15, band * 0.085), family: 'serif', italic: true,
        color: c.ink, ls: u * 0.4, maxW: inner
      }));
    }
  }

  /* ── 11 Editorial Cover ────────────────────────────────────────────────── */
  /* A magazine cover: the title is set in the top margin the way a masthead
     is, and the foot is a colophon — who, with what, when — under a rule. */
  function drawEditorial(ctx, L) {
    var f = L.fields, c = L.colors, u = L.u, band = L.band, W = L.W;
    var inset = L.inset, maxW = Math.max(1, W - inset * 2);
    var top = L.photoBox.y + L.PH;
    var kicker = Math.min(u * 10.5, Math.max(u * 5, L.padTop * 0.13));

    text(ctx, 'HD2LAB  ·  THE PLATE', inset, L.padTop * 0.26, {
      size: kicker, family: 'mono', color: c.accent, ls: u * 2.6, maxW: maxW * 0.62
    });
    text(ctx, 'VOL. 01  ·  ' + String(L.opts.frameNo || '#03'), W - inset, L.padTop * 0.26, {
      size: kicker, family: 'mono', color: c.muted, ls: u * 1.6,
      align: 'right', maxW: maxW * 0.34
    });

    var titleSize = Math.min(u * 56, L.padTop * 0.46);
    text(ctx, f.caption || camera(f) || 'SHUTTERPLATE', inset, L.padTop * 0.84, captionOpt(L, {
      size: titleSize, family: 'serif', weight: 600, color: c.ink,
      ls: u * 0.1, maxW: maxW
    }, !f.caption));

    hairline(ctx, inset, top + band * 0.05, W - inset, top + band * 0.05, c.line, Math.max(1, u * 1.2));

    var rowY = top + band * 0.30;
    text(ctx, join([f.make, f.model], ' '), inset, rowY, {
      size: Math.min(u * 19, band * 0.13), family: L.opts.font, weight: 600,
      color: c.ink, ls: u * 0.3, maxW: maxW * 0.6
    });
    text(ctx, dateOf(f).full, W - inset, rowY, {
      size: Math.min(u * 12, band * 0.08), family: 'mono', color: c.muted,
      ls: u * 1.2, align: 'right', maxW: maxW * 0.34
    });
    text(ctx, optics(f), inset, top + band * 0.46, {
      size: Math.min(u * 12.5, band * 0.075), family: 'mono', color: c.muted,
      ls: u * 0.9, maxW: maxW * 0.6
    });
    text(ctx, join(specParts(f), '   ·   '), W - inset, top + band * 0.46, {
      size: Math.min(u * 12.5, band * 0.075), family: 'mono', color: c.muted,
      ls: u * 1, align: 'right', maxW: maxW * 0.36
    });

    if (L.emblem) {
      var emH = Math.min(u * 20, band * 0.14);
      emblemAt(ctx, L, L.emblem, inset, top + band * 0.64, emH, 'left', maxW * 0.42);
    }
    text(ctx, 'PHOTOGRAPHED IN ' + (String(dateOf(f).date || '').slice(0, 4) || '2026'),
      W - inset, top + band * 0.76, {
        size: Math.max(u * 6, Math.min(u * 9.5, band * 0.05)), family: 'mono', color: c.muted,
        upper: true, ls: u * 1.6, align: 'right', maxW: maxW * 0.42
      });
  }

  /* ══ multi-cut engine ════════════════════════════════════════════════════
     Two plates hold more than one photograph. Both are drawn in design units
     where a cell's long side is 400, and scaled once at the end so every cell
     prints at the sharpest slot's own resolution — bounded, so a phone is
     never asked for a 20 000px canvas. One set of numbers therefore serves the
     strip thumbnail, the live preview and the 1:1 export alike. */

  var MULTI_MAX_EDGE = 7200;
  var FYRA_DEFAULT = 'classic';

  /* The six Nordic four-cut layouts, in the order the theme window lists them. */
  var FYRA_THEMES = [
    { id: 'classic', label: 'Classic Strip', layout: '1×4',
      note: '아이보리 스트립 · 하단 FYRA 04 / 날짜 / 엠블럼' },
    { id: 'nordic', label: 'Nordic Grid', layout: '2×2',
      note: '오프화이트 갤러리 그리드 · 넉넉한 편집 여백' },
    { id: 'dark', label: 'Dark Studio', layout: '1×4',
      note: '매트 다크 스트립 · 오렌지 액센트 / EXIF 요약' },
    { id: 'film', label: 'Film Strip', layout: '1×4',
      note: '퍼포레이션 · #01~#04 프레임 번호' },
    { id: 'editorial', label: 'Editorial Grid', layout: '2×2',
      note: '세리프 타이틀 · 매거진 그리드' },
    { id: 'minimal', label: 'Minimal Twin', layout: '2×2',
      note: '얇은 헤어라인 · 하단 엠블럼·날짜 한 줄' }
  ];

  var THEME_COLORS = {
    classic:   { base: '#f4f1e8', ink: '#1e1d1a', muted: '#6f6a5f', line: 'rgba(30,29,26,0.18)', accent: '#b8452f', light: true },
    nordic:    { base: '#f6f3ec', ink: '#232220', muted: '#78736a', line: 'rgba(35,34,32,0.14)', accent: '#8a6a4e', light: true },
    dark:      { base: '#141516', ink: '#f2f0ea', muted: '#8e8c85', line: 'rgba(242,240,234,0.16)', accent: '#ff824f', light: false },
    film:      { base: '#15140f', ink: '#efe8d8', muted: '#a89c86', line: 'rgba(239,232,216,0.22)', accent: '#e0703c', light: false },
    editorial: { base: '#f7f4ee', ink: '#161511', muted: '#6d675c', line: 'rgba(22,21,17,0.16)', accent: '#b23b23', light: true },
    minimal:   { base: '#fbfaf7', ink: '#1b1b19', muted: '#7b776e', line: 'rgba(27,27,25,0.14)', accent: '#b8452f', light: true }
  };

  function fyraTheme(id) {
    for (var i = 0; i < FYRA_THEMES.length; i++) {
      if (FYRA_THEMES[i].id === id) return FYRA_THEMES[i];
    }
    return FYRA_THEMES[0];
  }

  function themeColors(style, theme) {
    if (style === 'contact') return STYLES.contact;
    return THEME_COLORS[theme] || THEME_COLORS[FYRA_DEFAULT];
  }

  function cellsFor(cols, rows, cw, ch, x0, y0, gx, gy) {
    var out = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        out.push({ x: x0 + c * (cw + gx), y: y0 + r * (ch + gy), w: cw, h: ch });
      }
    }
    return out;
  }

  /* The nominal plate, in design units. `cells` runs left→right, top→bottom,
     which is also the slot order the studio fills them in. */
  function multiGeometry(style, theme) {
    var CW = 300, CH = 400;
    if (style === 'contact') {
      var cw = 400, ch = 400 / 1.5;                 // a 3:2 negative
      var pad = 34, gutter = 18, head = 56, labelH = 28, foot = 48;
      return {
        pad: pad, side: pad, top: head, head: head, foot: foot, labelH: labelH,
        gutter: gutter, band: 0,
        W: pad * 2 + cw * 2 + gutter,
        H: head + (ch + labelH) * 2 + gutter + foot,
        cells: cellsFor(2, 2, cw, ch, pad, head, gutter, gutter + labelH)
      };
    }
    var cols = fyraTheme(theme).layout === '2×2' ? 2 : 1;
    var rows = cols === 2 ? 2 : 4;
    var side, top, gutter, band;
    if (theme === 'nordic')         { side = 56; top = 56;  gutter = 14; band = 96; }
    else if (theme === 'dark')      { side = 24; top = 24;  gutter = 12; band = 132; }
    else if (theme === 'film')      { side = 46; top = 40;  gutter = 12; band = 152; }
    else if (theme === 'editorial') { side = 46; top = 118; gutter = 10; band = 130; }
    else if (theme === 'minimal')   { side = 40; top = 40;  gutter = 8;  band = 62; }
    else                            { side = 26; top = 26;  gutter = 10; band = 156; }  // classic
    return {
      pad: side, side: side, top: top, gutter: gutter, band: band,
      head: 0, foot: 0, labelH: 0,
      W: side * 2 + cols * CW + (cols - 1) * gutter,
      H: top + rows * CH + (rows - 1) * gutter + band,
      cells: cellsFor(cols, rows, CW, CH, side, top, gutter, gutter)
    };
  }

  /* One scale for the whole plate. A slot printed 1:1 needs `ref / 400` px per
     unit — the cell's long side — and the plate is never allowed past
     MULTI_MAX_EDGE, so a 6000px photograph becomes a sane strip instead of a
     100MP canvas the phone cannot allocate. */
  function multiScale(geo, slots) {
    var ref = 0;
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i];
      if (!s || !s.img) continue;
      var e = Math.max(s.w || s.img.naturalWidth || 0, s.h || s.img.naturalHeight || 0);
      if (e > ref) ref = e;
    }
    var k = ref > 0 ? ref / 400 : 1.6;
    k = Math.max(0.8, Math.min(4.5, k));
    var longEdge = Math.max(geo.W, geo.H) * k;
    if (longEdge > MULTI_MAX_EDGE) k = k * MULTI_MAX_EDGE / longEdge;
    return k;
  }

  function multiLayout(opts) {
    var style = opts.style;
    var S = STYLES[style] || STYLES.contact;
    var theme = style === 'fyra04' ? fyraTheme(opts.fyraTheme).id : '';
    var geo = multiGeometry(style, theme);
    var slots = [];
    for (var i = 0; i < 4; i++) {
      var s = opts.slots && opts.slots[i];
      slots.push(s && s.img ? s : null);
    }
    var k = multiScale(geo, slots);
    var px = function (v) { return Math.round((v || 0) * k); };
    var cells = geo.cells.map(function (c) {
      return { x: px(c.x), y: px(c.y), w: px(c.w), h: px(c.h) };
    });
    return {
      style: style, multi: true, theme: theme,
      themeLabel: theme ? fyraTheme(theme).label : S.label,
      cells: cells, images: slots,
      W: px(geo.W), H: px(geo.H),
      colors: themeColors(style, theme), S: S, opts: opts, fields: opts.fields || {},
      slotFields: opts.slotFields || [],
      side: px(geo.side), top: px(geo.top), pad: px(geo.pad),
      gutter: px(geo.gutter), band: px(geo.band),
      head: px(geo.head), foot: px(geo.foot), labelH: px(geo.labelH),
      radius: 0, ratio: 0, u: k, k: k,
      PW: cells[0] ? cells[0].w : 0, PH: cells[0] ? cells[0].h : 0,
      photoBox: cells[0] || { x: 0, y: 0, w: 1, h: 1 },
      emblem: opts.emblem === 'none' ? null : (opts.emblem || 'hd2lab'),
      img: slots[0] ? slots[0].img : null
    };
  }

  /* ── multi-cut art ─────────────────────────────────────────────────────── */
  function slotField(L, i) {
    var f = L.slotFields && L.slotFields[i];
    return f && (f.make || f.model || f.focal) ? f : L.fields;
  }

  function slotImage(ctx, L, cell, i, border) {
    var img = L.images[i] && L.images[i].img;
    if (!drawCover(ctx, img, cell.x, cell.y, cell.w, cell.h)) {
      /* an empty cell is a place to put a photograph, and says so */
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = Math.max(1, L.u * 1.2);
      ctx.strokeRect(cell.x + 0.5, cell.y + 0.5, Math.max(1, cell.w - 1), Math.max(1, cell.h - 1));
      ctx.fillStyle = 'rgba(255,255,255,0.44)';
      ctx.font = '600 ' + (L.u * 14).toFixed(1) + 'px ' + FONTS.mono;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SLOT ' + (i + 1), cell.x + cell.w / 2, cell.y + cell.h / 2);
      ctx.restore();
    }
    if (border) {
      ctx.save();
      ctx.strokeStyle = L.colors.line;
      ctx.lineWidth = Math.max(1, L.u * 1.1);
      ctx.strokeRect(cell.x, cell.y, cell.w, cell.h);
      ctx.restore();
    }
  }

  /* ── 12 Contact Sheet ──────────────────────────────────────────────────── */
  function drawContactSheet(ctx, L) {
    var c = L.colors, u = L.u, f = L.fields, W = L.W, H = L.H;
    var pad = L.pad, head = L.head, foot = L.foot, labelH = L.labelH;

    text(ctx, 'HD2LAB  ·  CONTACT SHEET', pad, head * 0.46, {
      size: u * 11, family: 'mono', color: c.ink, ls: u * 2.4, maxW: W * 0.58
    });
    text(ctx, 'SHEET 01  ·  4-UP', W - pad, head * 0.46, {
      size: u * 10, family: 'mono', color: c.muted, ls: u * 1.8,
      align: 'right', maxW: W * 0.3
    });
    text(ctx, join([camera(f), dateOf(f).full], '   ·   '), pad, head * 0.82, {
      size: u * 9.5, family: 'mono', color: c.muted, ls: u * 1.4, maxW: W * 0.72
    });
    hairline(ctx, pad, head * 0.94, W - pad, head * 0.94, c.line, Math.max(1, u * 1.2));

    L.cells.forEach(function (cell, i) {
      slotImage(ctx, L, cell, i, true);
      var sf = slotField(L, i);
      var rowY = cell.y + cell.h + labelH * 0.7;
      text(ctx, '#' + (i + 1 < 10 ? '0' : '') + (i + 1), cell.x, rowY, {
        size: u * 10, family: 'mono', color: c.accent, ls: u * 1.6, maxW: cell.w * 0.28
      });
      text(ctx, join([sf.make, sf.model], ' '), cell.x + u * 34, rowY, {
        size: u * 10, family: 'mono', color: c.ink, ls: u * 0.8, maxW: cell.w * 0.56
      });
      text(ctx, join([sf.aperture, sf.shutter, sf.iso], ' · '), cell.x + cell.w, rowY, {
        size: u * 9, family: 'mono', color: c.muted, ls: u * 0.6,
        align: 'right', maxW: cell.w * 0.44
      });
    });

    hairline(ctx, pad, H - foot * 0.8, W - pad, H - foot * 0.8, c.line, Math.max(1, u));
    var footY = H - foot * 0.4;
    text(ctx, f.caption || 'HD2Lab Shutterplate', pad, footY, captionOpt(L, {
      size: u * 10, family: L.opts.font, weight: 500, color: c.ink,
      ls: u * 1.2, maxW: W * 0.6
    }, !f.caption));
    var filled = 0;
    for (var i = 0; i < L.images.length; i++) { if (L.images[i]) filled++; }
    text(ctx, 'CONTACT 01  ·  ' + filled + ' / 4', W - pad, footY, {
      size: u * 9, family: 'mono', color: c.muted, ls: u * 1.4,
      align: 'right', maxW: W * 0.32
    });
  }

  /* ── 13 FYRA 04 (six Nordic four-cut themes) ───────────────────────────── */
  function drawFyra(ctx, L) {
    var th = L.theme || FYRA_DEFAULT;
    var c = L.colors, u = L.u, f = L.fields, W = L.W;
    var cells = L.cells;
    var last = cells[cells.length - 1];
    var footTop = last.y + last.h;
    var band = L.band;
    var date = dateOf(f).full;

    cells.forEach(function (cell, i) {
      slotImage(ctx, L, cell, i, th === 'classic' || th === 'film' || th === 'minimal');
      if (th === 'film') {
        var n = '#' + (i + 1 < 10 ? '0' : '') + (i + 1);
        var chipH = u * 17, chipW = u * 30;
        ctx.save();
        ctx.fillStyle = 'rgba(10,10,8,0.66)';
        roundRect(ctx, cell.x + u * 6, cell.y + cell.h - chipH - u * 6, chipW, chipH, u * 2);
        ctx.fill();
        ctx.restore();
        text(ctx, n, cell.x + u * 10, cell.y + cell.h - u * 11.5, {
          size: u * 10, family: 'mono', color: c.accent, ls: u * 1.2
        });
      }
    });

    if (th === 'classic') {
      hairline(ctx, L.side, footTop + u * 8, W - L.side, footTop + u * 8, c.line, Math.max(1, u * 1.2));
      text(ctx, 'FYRA 04', W / 2, footTop + band * 0.36, {
        size: u * 24, family: L.opts.font, weight: 700, color: c.ink,
        ls: u * 3.4, align: 'center', maxW: W - L.side * 2
      });
      text(ctx, date, W / 2, footTop + band * 0.58, {
        size: u * 11, family: 'mono', color: c.muted, ls: u * 1.6, align: 'center', maxW: W - L.side * 2
      });
      if (L.emblem) {
        var emH = Math.max(u * 8, Math.min(u * 16, band * 0.12));
        var ef = emFit(L.emblem, emH, W * 0.26);
        emblemAt(ctx, L, L.emblem, W / 2 - ef.w / 2, footTop + band * 0.70, emH, 'left', W * 0.26);
      }

    } else if (th === 'nordic') {
      text(ctx, 'FYRA 04', L.side, L.top * 0.62, {
        size: u * 16, family: L.opts.font, weight: 700, color: c.ink,
        ls: u * 2.6, maxW: W * 0.5
      });
      text(ctx, 'NORDIC 4-CUT', W - L.side, L.top * 0.62, {
        size: u * 9, family: 'mono', color: c.muted, ls: u * 1.8,
        align: 'right', maxW: W * 0.4
      });
      hairline(ctx, L.side, footTop + band * 0.16, W - L.side, footTop + band * 0.16, c.line, Math.max(1, u));
      if (f.caption) {
        text(ctx, f.caption, W / 2, footTop + band * 0.44, captionOpt(L, {
          size: Math.min(u * 18, band * 0.26), family: 'serif', italic: true,
          color: c.ink, ls: u * 0.4, align: 'center', maxW: W - L.side * 2
        }));
      }
      if (L.emblem) {
        var emH2 = Math.max(u * 7, Math.min(u * 13, band * 0.14));
        emblemAt(ctx, L, L.emblem, L.side, footTop + band * 0.78 - emH2 / 2, emH2, 'left', W * 0.3);
      }
      text(ctx, date, W - L.side, footTop + band * 0.80, {
        size: u * 10, family: 'mono', color: c.muted, ls: u * 1.4,
        align: 'right', maxW: W * 0.4
      });

    } else if (th === 'dark') {
      ctx.save();
      ctx.fillStyle = c.accent;
      ctx.fillRect(L.side, footTop + band * 0.11, u * 64, Math.max(2, u * 2.6));
      ctx.restore();
      /* the right column is measured first, so the exposure line owns exactly
         what is left of the row instead of running into the date */
      var camStr = camera(f);
      var specStr = join(specParts(f), '  ·  ');
      var specSize = u * 11, camSize = u * 10.5, dateSize = u * 10;
      var colW = Math.min(W * 0.42, Math.max(
        measure(ctx, camStr, { size: camSize, family: 'mono', ls: u * 0.8 }),
        measure(ctx, date, { size: dateSize, family: 'mono', ls: u })
      ));
      var leftW = Math.max(u * 70, W - L.side * 2 - colW - u * 26);
      text(ctx, 'FYRA 04', L.side, footTop + band * 0.42, {
        size: u * 20, family: L.opts.font, weight: 600, color: c.ink,
        ls: u * 2.8, maxW: leftW
      });
      text(ctx, specStr, L.side, footTop + band * 0.66, {
        size: specSize, family: 'mono', color: c.muted, ls: u * 1.2, maxW: leftW
      });
      text(ctx, camStr, W - L.side, footTop + band * 0.42, {
        size: camSize, family: 'mono', color: c.ink, ls: u * 0.8,
        align: 'right', maxW: colW
      });
      text(ctx, date, W - L.side, footTop + band * 0.66, {
        size: dateSize, family: 'mono', color: c.muted, ls: u * 1,
        align: 'right', maxW: colW
      });

    } else if (th === 'film') {
      var fill = 'rgba(238,229,210,0.72)';
      /* a 35mm hole runs across the travel: wider than it is tall */
      var holeW = u * 15, holeH = u * 10.5;
      /* the two runs are exactly as tall as the four cells: the first hole
         starts on the first photo's top edge, the last ends on the fourth's
         bottom edge, so the perforation never runs past the photographs */
      var sp0 = cells[0].y;
      var sp1 = cells[cells.length - 1].y + cells[cells.length - 1].h;
      sprocketsCol(ctx, sp0, sp1, L.side * 0.5, holeW, holeH, fill);
      sprocketsCol(ctx, sp0, sp1, W - L.side * 0.5, holeW, holeH, fill);
      var fCam = join([camera(f), date], '   ·   ');
      var fSpec = join(specParts(f), '  ·  ');
      var fColW = Math.min(W * 0.44, Math.max(
        measure(ctx, fCam, { size: u * 10, family: 'mono', ls: u * 1 }),
        measure(ctx, fSpec, { size: u * 10, family: 'mono', ls: u * 1 })
      ));
      var fLeftW = Math.max(u * 80, W - L.side * 2 - fColW - u * 24);
      text(ctx, '35MM  ·  FYRA 04', L.side, footTop + band * 0.30, {
        size: u * 11, family: 'mono', color: c.accent, ls: u * 2, maxW: fLeftW
      });
      if (f.caption) {
        text(ctx, f.caption, L.side, footTop + band * 0.56, captionOpt(L, {
          size: Math.min(u * 18, band * 0.15), family: 'serif', italic: true,
          color: c.ink, ls: u * 0.4, maxW: fLeftW
        }));
      }
      text(ctx, fCam, W - L.side, footTop + band * 0.56, {
        size: u * 10, family: 'mono', color: c.muted, ls: u * 1,
        align: 'right', maxW: fColW
      });
      text(ctx, fSpec, W - L.side, footTop + band * 0.30, {
        size: u * 10, family: 'mono', color: c.muted, ls: u * 1,
        align: 'right', maxW: fColW
      });

    } else if (th === 'editorial') {
      text(ctx, 'FYRA 04', L.side, L.top * 0.60, {
        size: u * 44, family: 'serif', weight: 700, color: c.ink,
        ls: u * 0.6, maxW: W * 0.6
      });
      text(ctx, 'VOL. 04  ·  HD2LAB', W - L.side, L.top * 0.34, {
        size: u * 10, family: 'mono', color: c.muted, ls: u * 1.6,
        align: 'right', maxW: W * 0.42
      });
      text(ctx, 'NORDIC FOUR-CUT', L.side, L.top * 0.90, {
        size: u * 9, family: 'mono', color: c.accent, ls: u * 2.4, maxW: W * 0.5
      });
      hairline(ctx, L.side, footTop + band * 0.12, W - L.side, footTop + band * 0.12, c.line, Math.max(1, u * 1.2));
      if (f.caption) {
        text(ctx, f.caption, L.side, footTop + band * 0.44, captionOpt(L, {
          size: Math.min(u * 19, band * 0.18), family: 'serif', italic: true,
          color: c.ink, ls: u * 0.3, maxW: W * 0.62
        }));
      }
      text(ctx, join([camera(f), optics(f)], '   ·   '), L.side, footTop + band * 0.68, {
        size: u * 10.5, family: 'mono', color: c.muted, ls: u * 1, maxW: W * 0.6
      });
      text(ctx, date, W - L.side, footTop + band * 0.44, {
        size: u * 10.5, family: 'mono', color: c.muted, ls: u * 1.2,
        align: 'right', maxW: W * 0.32
      });
      text(ctx, 'PLATE 04', W - L.side, footTop + band * 0.68, {
        size: u * 9.5, family: 'mono', color: c.accent, ls: u * 1.8,
        align: 'right', maxW: W * 0.32
      });

    } else {  /* minimal */
      hairline(ctx, L.side, footTop + band * 0.14, W - L.side, footTop + band * 0.14, c.line, Math.max(1, u));
      var rowY = footTop + band * 0.62;
      var emH3 = Math.max(u * 6, Math.min(u * 12, band * 0.22));
      var emW3 = L.emblem ? emblemAt(ctx, L, L.emblem, L.side, rowY - emH3 * 0.75, emH3, 'left', W * 0.3) : 0;
      text(ctx, 'FYRA 04', L.side + (L.emblem ? emW3 + u * 12 : 0), rowY, {
        size: u * 12, family: 'mono', color: c.ink, ls: u * 2, maxW: W * 0.4
      });
      text(ctx, date, W - L.side, rowY, {
        size: u * 10, family: 'mono', color: c.muted, ls: u * 1.4,
        align: 'right', maxW: W * 0.4
      });
    }
  }

  /* ── paint --------------------------------------------------------------- */
  var PAINTERS = {
    horizon: drawHorizon,
    gallery: drawGallery,
    dual: drawDual,
    strap: drawStrap,
    film: drawFilm,
    studio: drawStudio,
    edge: drawEdge,
    pro: drawPro,
    polaroid: drawPolaroid,
    frosted: drawFrosted,
    editorial: drawEditorial
  };

  function paint(ctx, L) {
    var W = L.W, H = L.H;

    /* the two multi-cut plates own their whole surface: cells, margins,
       rails and copy are all placed by their own geometry */
    if (L.multi) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      ctx.fillStyle = L.colors.base;
      ctx.fillRect(0, 0, W, H);
      if (L.style === 'contact') drawContactSheet(ctx, L);
      else drawFyra(ctx, L);
      ctx.restore();
      return;
    }

    ctx.save();
    roundRect(ctx, 0, 0, W, H, L.radius);
    ctx.fillStyle = L.colors.base;
    ctx.fill();
    ctx.save();
    ctx.clip();

    if (L.style === 'film') drawFilmBase(ctx, L);
    if (L.style === 'strap') drawStrapBase(ctx, L);
    if (L.style === 'frosted') drawFrostedBase(ctx, L);

    if (L.img) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(L.img, L.photoBox.x, L.photoBox.y, L.photoBox.w, L.photoBox.h);
    }

    if (L.style === 'edge') drawEdgeFrame(ctx, L);

    (PAINTERS[L.style] || drawGallery)(ctx, L);

    ctx.restore();
    ctx.restore();
  }

  function defaults(style) {
    var S = STYLES[style] || STYLES.gallery;
    return { padPct: S.geo.pad, extraPct: S.geo.extra, radiusPct: S.geo.radius };
  }

  global.SPPlate = {
    STYLES: STYLES,
    ORDER: ORDER,
    FONTS: FONTS,
    layout: layout,
    paint: paint,
    defaults: defaults,
    /* multi-cut: the two plates that hold four photographs */
    MULTI: ['contact', 'fyra04'],
    FYRA_THEMES: FYRA_THEMES,
    FYRA_DEFAULT: FYRA_DEFAULT,
    MULTI_MAX_EDGE: MULTI_MAX_EDGE,
    isMulti: isMulti,
    cellCount: cellCount,
    fyraTheme: fyraTheme,
    multiLayout: multiLayout,
    multiGeometry: multiGeometry,
    themeColors: themeColors,
    helpers: {
      text: text, compound: compound, measure: measure, roundRect: roundRect,
      hairline: hairline, camera: camera, optics: optics, specParts: specParts,
      dateOf: dateOf, join: join, filmPerf: filmPerf, strapBand: strapBand,
      drawCover: drawCover, sprockets: sprockets, sprocketsCol: sprocketsCol,
      sprocketRow: sprocketRow,
      captionStyle: captionStyle, captionOpt: captionOpt, isCustomCaption: isCustomCaption
    }
  };
})(window);
