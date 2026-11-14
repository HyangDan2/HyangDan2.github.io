/* ============================================================================
 * HD2Lab · Shutterplate (PKPilot0003)
 * Plate engine — geometry + canvas painting for the eight signature frames.
 *
 * The eight frames are HD2Lab originals that carry the full layout language of
 * the upstream EXIF-frame themes (simple / one line / two line / strap / film /
 * lightroom / custom one line / custom two line) under our own naming:
 *
 *   01 Clean Horizon   ← SIMPLE            05 Film Sprocket  ← FILM
 *   02 Classic Gallery ← ONE_LINE          06 Studio Dark    ← LIGHTROOM
 *   03 Dual Deck       ← TWO_LINE          07 Minimal Edge   ← CUSTOM_ONE_LINE
 *   04 Strap Bar       ← STRAP             08 Pro Studio     ← CUSTOM_TWO_LINE
 *
 * Everything is drawn in "plate space" (plate pixels) so the live preview, the
 * frame-strip thumbnails and the 1:1 export share one paint routine.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var E = global.SPEmblems;

  var FONTS = {
    sans: '"Helvetica Neue", Helvetica, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", Arial, sans-serif',
    mono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", "Nanum Myeongjo", "Noto Serif KR", serif'
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
      accent: '#ff824f', geo: { pad: 7, extra: 17, radius: 0.6 }
    },
    dual: {
      label: 'Dual Deck', tag: '2-LINE', light: true,
      base: '#ffffff', ink: '#101110', muted: '#7a7a75', line: 'rgba(16,17,16,0.15)',
      accent: '#ff824f', geo: { pad: 5.5, extra: 21, radius: 0.25 }
    },
    strap: {
      label: 'Strap Bar', tag: 'WIDE', light: true,
      base: '#ffffff', band: '#f3f1ea', ink: '#111111', muted: '#5f5f5a',
      line: 'rgba(17,17,17,0.16)', accent: '#ff824f',
      geo: { pad: 0, extra: 19, radius: 0 }
    },
    film: {
      label: 'Film Sprocket', tag: '35MM', light: false,
      base: '#16150f', ink: '#f0e9d9', muted: '#a89c86', line: 'rgba(240,233,217,0.22)',
      accent: '#e0703c', geo: { pad: 6, extra: 16, radius: 0.3 }
    },
    studio: {
      label: 'Studio Dark', tag: 'DARK', light: false,
      base: '#101110', ink: '#f4f2ed', muted: '#8d8b85', line: 'rgba(244,242,237,0.16)',
      accent: '#ff824f', geo: { pad: 5.5, extra: 15.5, radius: 1.2 }
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
    }
  };

  var ORDER = ['horizon', 'gallery', 'dual', 'strap', 'film', 'studio', 'edge', 'pro'];
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

  function emblemAt(ctx, L, id, x, y, h, align, maxW) {
    if (!id) return 0;
    var f = emFit(id, h, maxW);
    E.draw(ctx, id, x, y, f.w, f.h, emblemColors(L), align || 'left');
    return f.w;
  }

  function sprockets(ctx, x0, x1, cy, h, fill) {
    /* the hole geometry collapses to zero on a plate with no padding — a zero
       pitch would make the loop below run forever, so refuse it up front */
    if (!(h > 0.5) || !(x1 > x0)) return;
    var holeW = h * 1.42, pitch = holeW * 1.9, r = h * 0.2;
    if (!(holeW > 0.5) || !(pitch > 0.5)) return;
    ctx.save();
    ctx.fillStyle = fill;
    for (var x = x0; x + holeW <= x1; x += pitch) {
      roundRect(ctx, x, cy - h / 2, holeW, h, r);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ── 01 Clean Horizon ──────────────────────────────────────────────────── */
  function drawHorizon(ctx, L) {
    var f = L.fields, c = L.colors, u = L.u, band = L.band, top = L.photoBox.y + L.PH;
    var cx = L.W / 2, maxW = L.W - L.inset * 2;
    var camSize = Math.min(u * 30, band * 0.26);

    compound(ctx, [
      { s: String(f.make || '').trim(), size: camSize, weight: 700, family: L.opts.font, color: c.ink, ls: u * 0.6 },
      { s: String(f.model || '').trim() ? '  ' + String(f.model).trim() : '', size: camSize, weight: 300, family: L.opts.font, color: c.ink, ls: u * 0.6 }
    ], cx, top + band * 0.36, 'center', maxW);

    text(ctx, join(specParts(f), '  ·  '), cx, top + band * 0.58, {
      size: Math.min(u * 15, band * 0.13), family: 'mono', color: c.muted,
      ls: u * 1.4, align: 'center', maxW: maxW
    });

    var foot = join([dateOf(f).full, f.caption], '   ·   ');
    if (foot) {
      hairline(ctx, cx - u * 38, top + band * 0.68, cx + u * 38, top + band * 0.68, c.line, Math.max(1, u));
      text(ctx, foot, cx, top + band * 0.84, {
        size: Math.min(u * 11, band * 0.095), family: 'mono', color: c.muted,
        ls: u * 1.2, align: 'center', maxW: maxW
      });
    }
  }

  /* ── 02 Classic Gallery ────────────────────────────────────────────────── */
  function drawGallery(ctx, L) {
    var f = L.fields, c = L.colors, u = L.u, band = L.band;
    var top = L.photoBox.y + L.PH, cx = L.W / 2, maxW = L.W - L.inset * 2;
    var emH = Math.min(u * 30, band * 0.19);

    if (L.emblem) {
      var ef = emFit(L.emblem, emH, L.W * 0.46);
      emblemAt(ctx, L, L.emblem, cx - ef.w / 2, top + band * 0.1, emH, 'left', L.W * 0.46);
    }

    text(ctx, join([camera(f)].concat(specParts(f)), '   ·   '), cx, top + band * 0.42, {
      size: Math.min(u * 15, band * 0.085), family: L.opts.font, weight: 500,
      color: c.muted, ls: u * 1.5, align: 'center', maxW: maxW
    });

    if (f.caption) {
      var ruleY = top + band * 0.55;
      hairline(ctx, cx - u * 34, ruleY, cx + u * 34, ruleY, c.line, Math.max(1, u * 1.1));
      text(ctx, f.caption, cx, top + band * 0.71, {
        size: Math.min(u * 27, band * 0.105), family: 'serif', italic: true, weight: 400,
        color: c.ink, align: 'center', ls: u * 0.2, maxW: L.W - L.inset * 3
      });
    }

    text(ctx, dateOf(f).full, cx, top + band * 0.87, {
      size: Math.min(u * 11, band * 0.062), family: 'mono', color: c.muted,
      ls: u * 1.6, align: 'center', maxW: maxW
    });
  }

  /* ── 03 Dual Deck ──────────────────────────────────────────────────────── */
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

    hairline(ctx, L.inset, top + band * 0.14, L.W - L.inset, top + band * 0.14, c.line, Math.max(1, u * 1.1));

    // lower deck — exposure block, two centred rows
    var exposure = join([f.aperture, f.shutter, f.iso], '   ·   ');
    var second = join([f.focal, dateOf(f).full], '   ·   ');

    text(ctx, exposure, cx, top + band * 0.44, {
      size: Math.min(u * 24, band * 0.15), family: L.opts.font, weight: 600,
      color: c.ink, ls: u * 2, align: 'center', maxW: maxW
    });
    text(ctx, second, cx, top + band * 0.66, {
      size: Math.min(u * 13, band * 0.085), family: 'mono', color: c.muted,
      ls: u * 1.5, align: 'center', maxW: maxW
    });

    if (f.caption) {
      text(ctx, f.caption, cx, top + band * 0.86, {
        size: Math.min(u * 11, band * 0.07), family: 'serif', italic: true,
        color: c.muted, ls: u * 0.4, align: 'center', maxW: maxW
      });
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

  function drawStrap(ctx, L) {
    var f = L.fields, c = L.colors, u = L.u, band = L.band;
    var top = L.photoBox.y + L.PH, inset = L.inset;

    // top edge of the strap
    hairline(ctx, 0, top, L.W, top, c.line, Math.max(1, u * 1.4));

    var row1 = top + band * 0.38;
    var row2 = top + band * 0.62;
    var primary = Math.min(u * 20, band * 0.13);
    var secondary = Math.min(u * 13, band * 0.08);

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
    text(ctx, f.caption ? 'SHOT BY © ' + f.caption : dateOf(f).full, inset, row2, {
      size: secondary, family: 'mono', color: c.muted, ls: u * 1.4, upper: true,
      maxW: leftMaxW
    });

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
    hairline(ctx, divX, top + band * 0.2, divX, top + band * 0.78, c.line, Math.max(1, u * 1.4));

    // maker emblem tucked against the divider
    if (L.emblem) {
      emblemAt(ctx, L, L.emblem, divX - u * 26 - emW, top + band * 0.5 - emH / 2, emH);
    }

    // strap stitching along the bottom edge
    var stitchY = L.H - u * 22;
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

    if (band > u * 190) {
      text(ctx, 'HD2LAB  ·  STRAP 04', L.W - inset, L.H - band * 0.06, {
        size: u * 8.5, family: 'mono', color: c.muted, ls: u * 2.2, align: 'right'
      });
    }
  }

  /* ── 05 Film Sprocket ──────────────────────────────────────────────────── */
  /* One row of perforations at each margin, and both read from the same two
     numbers: the hole height and the hole centre's distance from the edge.
     35mm stock prints its top and bottom rows identically, and a frame that
     draws a tall row at the top and a squat sliver at the foot stops looking
     like film. `flow` is what is left of the caption band once the bottom row
     has claimed its strip — the print block every line below must live in. */
  function filmPerf(L) {
    var band = L.padBottom;
    var holeH = Math.max(L.u * 6, Math.min(L.padTop * 0.19, band * 0.12));
    var edgeCy = Math.max(holeH * 0.85, Math.min(L.padTop * 0.26, band * 0.14));
    var top = L.photoBox.y + L.PH;
    return {
      holeH: holeH,
      edgeCy: edgeCy,
      topCy: edgeCy,
      botCy: L.H - edgeCy,
      flow: Math.max(L.u * 4, (L.H - edgeCy - holeH / 2) - top)
    };
  }

  function drawFilmBase(ctx, L) {
    var u = L.u, pad = L.padX;
    var hole = 'rgba(238,229,210,0.74)';
    var perf = filmPerf(L);

    /* the same hole height, the same distance from its own edge: the two rows
       are mirror images, so the stock reads the same way up or down */
    sprockets(ctx, pad * 0.32, L.W - pad * 0.32, perf.topCy, perf.holeH, hole);
    sprockets(ctx, pad * 0.32, L.W - pad * 0.32, perf.botCy, perf.holeH, hole);

    hairline(ctx, 0, L.padTop * 0.60, L.W, L.padTop * 0.60, L.colors.line, Math.max(1, u * 1.1));
    /* the foot gets the same rule: just inside the bottom perforation row, at
       the mirror of the gap the top rule keeps above the photo */
    hairline(ctx, 0, perf.botCy - perf.holeH / 2 - perf.flow * 0.085, L.W,
      perf.botCy - perf.holeH / 2 - perf.flow * 0.085, L.colors.line, Math.max(1, u * 1.1));
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
    var badgeY = L.padTop * 0.86;
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

    if (L.emblem) {
      var emH = Math.min(u * 26, L.band * 0.16) * g;
      emblemAt(ctx, L, L.emblem, pad, top + flow * 0.14, emH, 'left', inner * 0.42);
    }

    text(ctx, f.caption || camera(f), pad, top + flow * 0.41, {
      size: Math.min(u * 22, L.band * 0.1) * g, family: 'serif', italic: true,
      color: c.ink, ls: u * 0.3, maxW: leftMaxW
    });

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
    var railY = top + band * 0.1;
    hairline(ctx, pad, railY, W - pad, railY, c.line, Math.max(1, u * 1.2));
    ctx.save();
    ctx.fillStyle = c.accent;
    ctx.fillRect(pad, railY - u * 1.4, u * 96, u * 2.8);
    ctx.restore();

    /* the right column is measured first; the left column then claims what is
       left of the inner width, so a long exposure line never pushes into it */
    var specStr = join(specParts(f), '   ·   ');
    var specSize = Math.min(u * 15, band * 0.062);
    var dateStr = dateOf(f).full;
    var dateSize = Math.min(u * 12, band * 0.048);
    var rightW = Math.min(inner * 0.62, Math.max(
      measure(ctx, specStr, { size: specSize, family: 'mono', ls: u * 0.6 }),
      measure(ctx, dateStr, { size: dateSize, family: 'mono', ls: u * 0.6 })
    ));

    // emblem + camera block
    var emH = Math.min(u * 32, band * 0.26);
    var emMaxW = 0;
    if (L.emblem) {
      emMaxW = inner - gutter - rightW - u * 30 - u * 240;
      emH = Math.max(u * 14, Math.min(emH, emMaxW / (E.widthFor(L.emblem, 1) || 1)));
    }
    var emW = emblemAt(ctx, L, L.emblem, pad, top + band * 0.34, emH, 'left', Math.max(u * 90, emMaxW));
    var tx = pad + (L.emblem ? emW + u * 30 : 0);
    var leftMaxW = Math.max(u * 120, inner - (tx - pad) - gutter - rightW);

    text(ctx, L.emblem ? (f.model || f.make || '') : camera(f), tx, top + band * 0.47, {
      size: Math.min(u * 22, band * 0.09), family: L.opts.font, weight: 600,
      color: c.ink, ls: u * 0.4, maxW: leftMaxW
    });
    text(ctx, optics(f), tx, top + band * 0.62, {
      size: Math.min(u * 13, band * 0.055), family: 'mono', color: c.muted,
      ls: u * 0.9, maxW: leftMaxW
    });

    text(ctx, specStr, W - pad, top + band * 0.47, {
      size: specSize, family: 'mono', color: c.ink,
      ls: u * 0.6, align: 'right', maxW: rightW
    });
    text(ctx, dateStr, W - pad, top + band * 0.61, {
      size: dateSize, family: 'mono', color: c.muted,
      ls: u * 0.6, align: 'right', maxW: rightW
    });

    /* the footer keeps the band's own rhythm and moves clear of the lower
       corner brackets horizontally, so the two can never sit on each other */
    var bInset = u * 16, bLen = u * 26;
    var footX = Math.max(pad, bInset + bLen + u * 8);
    var footY = L.H - band * 0.15;
    if (f.caption) {
      text(ctx, f.caption, footX, footY, {
        size: Math.min(u * 11.5, band * 0.045), family: 'mono', color: c.muted,
        upper: true, ls: u * 1.4, maxW: W * 0.6
      });
    }
    text(ctx, 'SHUTTERPLATE · 03', W - footX, footY, {
      size: Math.min(u * 11.5, band * 0.045), family: 'mono', color: c.muted,
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

    var emH = Math.min(u * 28, band * 0.14);
    var emW = emblemAt(ctx, L, L.emblem, pad, top + band * 0.12, emH, 'left', inner * 0.4);
    var tx = pad + (L.emblem ? emW + u * 24 : 0);
    /* the date owns its own column on the headline row; the model and lens are
       measured against what is left after the emblem */
    var dateStr = dateOf(f).full;
    var dateSize = Math.min(u * 12, band * 0.045);
    var dateW = Math.min(
      measure(ctx, dateStr, { size: dateSize, family: 'mono', ls: u * 1.1 }), inner * 0.32);
    var usedX = tx - pad;
    var headMaxW = Math.max(u * 120, inner - usedX - dateW - u * 24);

    text(ctx, L.emblem ? (f.model || f.make || '') : camera(f), tx, top + band * 0.21, {
      size: Math.min(u * 22, band * 0.085), family: L.opts.font, weight: 600,
      color: c.ink, ls: u * 0.3, maxW: headMaxW
    });
    text(ctx, dateStr, W - pad, top + band * 0.21, {
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
      text(ctx, f.caption, pad, L.H - band * 0.075, {
        size: Math.min(u * 11, band * 0.04), family: 'mono', color: c.muted,
        upper: true, ls: u * 1.6, maxW: inner * 0.6
      });
    }
    text(ctx, 'HD2LAB · PRO STUDIO 08', W - pad, L.H - band * 0.075, {
      size: Math.min(u * 10, band * 0.036), family: 'mono', color: c.muted,
      ls: u * 1.6, align: 'right', maxW: inner * 0.4
    });
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
    pro: drawPro
  };

  function paint(ctx, L) {
    var W = L.W, H = L.H;

    ctx.save();
    roundRect(ctx, 0, 0, W, H, L.radius);
    ctx.fillStyle = L.colors.base;
    ctx.fill();
    ctx.save();
    ctx.clip();

    if (L.style === 'film') drawFilmBase(ctx, L);
    if (L.style === 'strap') drawStrapBase(ctx, L);

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
    helpers: {
      text: text, compound: compound, measure: measure, roundRect: roundRect,
      hairline: hairline, camera: camera, optics: optics, specParts: specParts,
      dateOf: dateOf, join: join, filmPerf: filmPerf
    }
  };
})(window);
