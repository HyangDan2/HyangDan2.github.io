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
   * Draw one line of text; shrinks (then ellipsises) to respect opt.maxW.
   * Returns the advance width actually painted.
   */
  function text(ctx, str, x, y, opt) {
    var s = opt.upper ? String(str).toUpperCase() : String(str);
    if (!s) return 0;
    var size = opt.size, ls = opt.ls || 0;
    ctx.font = fontOf(opt, size);
    var w = trackedWidth(ctx, s, ls);
    if (opt.maxW && w > opt.maxW) {
      var k = opt.maxW / w;
      size = Math.max(size * 0.62, size * k);
      ls = ls * k;
      ctx.font = fontOf(opt, size);
      w = trackedWidth(ctx, s, ls);
      while (w > opt.maxW && s.length > 2) {
        s = s.slice(0, -2) + '…';
        w = trackedWidth(ctx, s, ls);
        if (s.endsWith('……')) break;
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
    if (maxW && total > maxW) k = maxW / total;
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
  function emblemAt(ctx, L, id, x, y, h, align) {
    if (!id) return 0;
    var w = E.widthFor(id, h);
    E.draw(ctx, id, x, y, w, h, L.colors, align || 'left');
    return w;
  }

  function sprockets(ctx, x0, x1, cy, h, fill) {
    var holeW = h * 1.42, pitch = holeW * 1.9, r = h * 0.2;
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
      emblemAt(ctx, L, L.emblem, cx - E.widthFor(L.emblem, emH) / 2, top + band * 0.1, emH);
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
    var divX = Math.max(L.W * 0.5, L.W - inset - widest - u * 34);

    // left column — exposure, then the signature / date
    text(ctx, join(specParts(f), '   ·   '), inset, row1, {
      size: primary, family: L.opts.font, weight: 600, color: c.ink, ls: u * 0.8,
      maxW: divX - inset - u * 40
    });
    text(ctx, f.caption ? 'SHOT BY © ' + f.caption : dateOf(f).full, inset, row2, {
      size: secondary, family: 'mono', color: c.muted, ls: u * 1.4, upper: true,
      maxW: divX - inset - u * 40
    });

    // right column — body and lens
    text(ctx, rightTop, L.W - inset, row1, {
      size: primary, family: L.opts.font, weight: 600, color: c.ink, ls: u * 0.5,
      align: 'right', maxW: widest
    });
    text(ctx, rightBot, L.W - inset, row2, {
      size: secondary, family: 'mono', color: c.muted, ls: u * 0.9,
      align: 'right', maxW: widest
    });

    // divider rule
    hairline(ctx, divX, top + band * 0.2, divX, top + band * 0.78, c.line, Math.max(1, u * 1.4));

    // maker emblem tucked against the divider
    if (L.emblem) {
      var emH = Math.min(u * 30, band * 0.22);
      emblemAt(ctx, L, L.emblem, divX - u * 26 - E.widthFor(L.emblem, emH), top + band * 0.5 - emH / 2, emH);
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
  function drawFilmBase(ctx, L) {
    var u = L.u, pad = L.padX;
    var hole = 'rgba(238,229,210,0.74)';

    sprockets(ctx, pad * 0.32, L.W - pad * 0.32, L.padTop * 0.26, L.padTop * 0.19, hole);
    sprockets(ctx, pad * 0.32, L.W - pad * 0.32, L.H - L.padBottom * 0.085, L.padBottom * 0.075, hole);

    hairline(ctx, 0, L.padTop * 0.60, L.W, L.padTop * 0.60, L.colors.line, Math.max(1, u * 1.1));
  }

  function drawFilm(ctx, L) {
    var f = L.fields, c = L.colors, u = L.u, band = L.band, pad = L.inset, W = L.W;
    var top = L.photoBox.y + L.PH;

    // frame line around the photo
    ctx.save();
    ctx.strokeStyle = 'rgba(240,233,217,0.3)';
    ctx.lineWidth = Math.max(1, u * 1.4);
    ctx.strokeRect(L.photoBox.x, L.photoBox.y, L.photoBox.w, L.photoBox.h);
    ctx.restore();

    // stock badge + frame number ride in the top margin
    var badgeY = L.padTop * 0.86;
    text(ctx, (L.opts.stock || 'KODAK PORTRA 400'), pad, badgeY, {
      size: Math.min(u * 12.5, L.padTop * 0.3), family: 'mono', color: c.ink,
      ls: u * 1.8, maxW: W * 0.6
    });
    text(ctx, (L.opts.frameNo || '#03') + '   ·   35MM', W - pad, badgeY, {
      size: Math.min(u * 12.5, L.padTop * 0.3), family: 'mono', color: c.accent,
      ls: u * 1.8, align: 'right', maxW: W * 0.3
    });

    if (L.emblem) {
      var emH = Math.min(u * 26, band * 0.16);
      emblemAt(ctx, L, L.emblem, pad, top + band * 0.14, emH);
    }

    text(ctx, f.caption || camera(f), pad, top + band * 0.41, {
      size: Math.min(u * 22, band * 0.1), family: 'serif', italic: true,
      color: c.ink, ls: u * 0.3, maxW: W * 0.58
    });

    text(ctx, join([camera(f), f.focal], '   ·   '), pad, top + band * 0.6, {
      size: Math.min(u * 13.5, band * 0.062), family: 'mono', color: c.muted,
      ls: u * 1.1, maxW: W * 0.58
    });
    text(ctx, optics(f), pad, top + band * 0.72, {
      size: Math.min(u * 12, band * 0.055), family: 'mono', color: c.muted,
      ls: u * 0.9, maxW: W * 0.58
    });
    text(ctx, dateOf(f).full, pad, L.H - band * 0.09, {
      size: Math.min(u * 12, band * 0.055), family: 'mono', color: c.muted,
      ls: u * 1.1, maxW: W * 0.6
    });

    // right stack — ISO / SEC / F, the way the negative edge prints it
    var pairs = [
      { k: 'ISO', v: specKey(f, 'iso') },
      { k: 'SEC', v: specKey(f, 'shutter') },
      { k: 'F', v: specKey(f, 'aperture') }
    ].filter(function (p) { return p.v; });

    var rx = W - pad, ry = top + band * 0.24;
    var valSize = Math.min(u * 30, band * 0.13);
    var keySize = Math.min(u * 13, band * 0.058);
    pairs.forEach(function (p) {
      var vw = text(ctx, p.v, rx, ry, {
        size: valSize, family: 'mono', weight: 500, color: c.ink, align: 'right'
      });
      text(ctx, p.k, rx - vw - u * 10, ry - u * 2, {
        size: keySize, family: 'mono', color: c.accent, align: 'right', ls: u * 1
      });
      ry += band * 0.18;
    });
  }

  /* ── 06 Studio Dark ────────────────────────────────────────────────────── */
  function drawStudio(ctx, L) {
    var f = L.fields, c = L.colors, u = L.u, band = L.band;
    var top = L.photoBox.y + L.PH, pad = L.inset, W = L.W;

    // accent rail
    var railY = top + band * 0.1;
    hairline(ctx, pad, railY, W - pad, railY, c.line, Math.max(1, u * 1.2));
    ctx.save();
    ctx.fillStyle = c.accent;
    ctx.fillRect(pad, railY - u * 1.4, u * 96, u * 2.8);
    ctx.restore();

    // emblem + camera block
    var emH = Math.min(u * 32, band * 0.26);
    var emW = emblemAt(ctx, L, L.emblem, pad, top + band * 0.34, emH);
    var tx = pad + (L.emblem ? emW + u * 30 : 0);

    text(ctx, L.emblem ? (f.model || f.make || '') : camera(f), tx, top + band * 0.47, {
      size: Math.min(u * 22, band * 0.09), family: L.opts.font, weight: 600,
      color: c.ink, ls: u * 0.4, maxW: W * 0.52
    });
    text(ctx, optics(f), tx, top + band * 0.62, {
      size: Math.min(u * 13, band * 0.055), family: 'mono', color: c.muted,
      ls: u * 0.9, maxW: W * 0.52
    });

    text(ctx, join(specParts(f), '   ·   '), W - pad, top + band * 0.47, {
      size: Math.min(u * 15, band * 0.062), family: 'mono', color: c.ink,
      ls: u * 0.6, align: 'right', maxW: W * 0.44
    });
    text(ctx, dateOf(f).full, W - pad, top + band * 0.61, {
      size: Math.min(u * 12, band * 0.048), family: 'mono', color: c.muted,
      ls: u * 0.6, align: 'right', maxW: W * 0.44
    });

    var footY = L.H - band * 0.15;
    if (f.caption) {
      text(ctx, f.caption, pad, footY, {
        size: Math.min(u * 11.5, band * 0.045), family: 'mono', color: c.muted,
        upper: true, ls: u * 1.4, maxW: W * 0.6
      });
    }
    text(ctx, 'SHUTTERPLATE · 03', W - pad, footY, {
      size: Math.min(u * 11.5, band * 0.045), family: 'mono', color: c.muted,
      ls: u * 1.4, align: 'right', maxW: W * 0.4
    });

    // signature corner brackets
    var inset = u * 16, len = u * 26, lw = Math.max(1.2, u * 2);
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
    var dateW = dateStr ? measure(ctx, dateStr, { size: Math.min(u * 11, band * 0.16), family: 'mono', ls: u * 1.2 }) : 0;
    text(ctx, join([camera(f)].concat(specParts(f)), '  ·  '), lineX, rowY, {
      size: Math.min(u * 14, band * 0.2), family: 'mono', weight: 500, color: c.ink,
      ls: u * 1.4, maxW: L.W - lineX - inset - dateW - u * 30
    });
    if (dateStr) {
      text(ctx, dateStr, L.W - inset, rowY, {
        size: Math.min(u * 11, band * 0.16), family: 'mono', color: c.muted,
        ls: u * 1.2, align: 'right', maxW: L.W * 0.4
      });
    }
  }

  /* ── 08 Pro Studio ─────────────────────────────────────────────────────── */
  function drawPro(ctx, L) {
    var f = L.fields, c = L.colors, u = L.u, band = L.band;
    var top = L.photoBox.y + L.PH, pad = L.inset, W = L.W;
    var inner = W - pad * 2;

    var emH = Math.min(u * 28, band * 0.14);
    var emW = emblemAt(ctx, L, L.emblem, pad, top + band * 0.12, emH);
    var tx = pad + (L.emblem ? emW + u * 24 : 0);

    text(ctx, L.emblem ? (f.model || f.make || '') : camera(f), tx, top + band * 0.21, {
      size: Math.min(u * 22, band * 0.085), family: L.opts.font, weight: 600,
      color: c.ink, ls: u * 0.3, maxW: inner * 0.6
    });
    text(ctx, dateOf(f).full, W - pad, top + band * 0.21, {
      size: Math.min(u * 12, band * 0.045), family: 'mono', color: c.muted,
      ls: u * 1.1, align: 'right', maxW: inner * 0.35
    });
    text(ctx, optics(f), tx, top + band * 0.30, {
      size: Math.min(u * 12.5, band * 0.048), family: 'mono', color: c.muted,
      ls: u * 0.8, maxW: inner * 0.65
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
      dateOf: dateOf, join: join
    }
  };
})(window);
