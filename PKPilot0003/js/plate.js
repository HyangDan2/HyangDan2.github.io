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
      accent: '#e0703c', geo: { pad: 6, extra: 12.5, radius: 0.3 }
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
      accent: '#ff824f', geo: { pad: 4.5, extra: 14.5, radius: 0 }
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
      text(ctx, f.caption, cx, top + band * 0.685, {
        size: Math.min(u * 27, band * 0.13), family: 'serif', italic: true, weight: 400,
        color: c.ink, align: 'center', ls: u * 0.2, maxW: L.W - L.inset * 3
      });
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
      text(ctx, f.caption, cx, top + band * 0.86, {
        size: Math.min(u * 11, band * 0.09), family: 'serif', italic: true,
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
    var u = L.u, pad = L.padX;
    var hole = 'rgba(238,229,210,0.74)';
    var perf = filmPerf(L);

    /* the same hole height, the same distance from its own edge: the two rows
       are mirror images, so the stock reads the same way up or down */
    sprockets(ctx, pad * 0.32, L.W - pad * 0.32, perf.topCy, perf.holeH, hole);
    sprockets(ctx, pad * 0.32, L.W - pad * 0.32, perf.botCy, perf.holeH, hole);

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

    /* foot — the mark sits at the left edge and its meta block runs beside it,
       while ISO / SEC / F now print as one horizontal row at the right instead
       of a three-row stack that claimed the whole height of the foot. The row
       is measured first (and shrunk toward its share of the width if three
       pairs would run too wide); whatever is left of the inner width belongs
       to the left block, so the two can never meet — not on a portrait plate,
       not on a narrow one. */
    var pairs = [
      { k: 'ISO', v: specKey(f, 'iso') },
      { k: 'SEC', v: specKey(f, 'shutter') },
      { k: 'F', v: specKey(f, 'aperture') }
    ].filter(function (p) { return p.v; });

    var valSize = Math.min(u * 30, L.band * 0.13) * g;
    var keySize = Math.min(u * 13, L.band * 0.058) * g;
    var keyGap = u * 10, pairGap = u * 30;
    var rowAt = function (k) {
      return { val: valSize * k, key: keySize * k, keyGap: keyGap * k, pairGap: pairGap * k, ls: u * k };
    };
    var rowWidth = function (k) {
      var s = rowAt(k), sum = 0;
      pairs.forEach(function (p, i) {
        if (i) sum += s.pairGap;
        sum += measure(ctx, p.k, { size: s.key, family: 'mono', ls: s.ls }) + s.keyGap +
               measure(ctx, p.v, { size: s.val, family: 'mono', weight: 500 });
      });
      return sum;
    };
    var rowRoom = inner * 0.6, rk = 1;
    if (pairs.length && rowWidth(1) > rowRoom) {
      var rlo = 0.4, rhi = 1;
      for (var rn = 0; rn < 12; rn++) {
        var rmid = (rlo + rhi) / 2;
        if (rowWidth(rmid) <= rowRoom) rlo = rmid; else rhi = rmid;
      }
      rk = rlo;
    }
    var row = rowAt(rk);
    var stackW = pairs.length ? rowWidth(rk) : 0;

    var emH = Math.min(u * 36, L.band * 0.24) * g;
    var emW = L.emblem
      ? emblemAt(ctx, L, L.emblem, pad, top + flow * 0.49 - emH / 2, emH, 'left', inner * 0.26)
      : 0;
    var tx = pad + (L.emblem ? emW + u * 22 : 0);
    var textW = Math.max(u * 100, W - pad - stackW - u * 26 - tx);

    text(ctx, f.caption || camera(f), tx, top + flow * 0.235, {
      size: Math.min(u * 22, L.band * 0.1) * g, family: 'serif', italic: true,
      color: c.ink, ls: u * 0.3, maxW: textW
    });

    text(ctx, join([camera(f), f.focal], '   ·   '), tx, top + flow * 0.45, {
      size: Math.min(u * 13.5, L.band * 0.062) * g, family: 'mono', color: c.muted,
      ls: u * 1.1, maxW: textW
    });
    text(ctx, optics(f), tx, top + flow * 0.605, {
      size: Math.min(u * 12, L.band * 0.055) * g, family: 'mono', color: c.muted,
      ls: u * 0.9, maxW: textW
    });
    /* the date line ends the block, a clear step above the perforation row */
    text(ctx, dateOf(f).full, tx, top + flow * 0.76, {
      size: Math.min(u * 12, L.band * 0.055) * g, family: 'mono', color: c.muted,
      ls: u * 1.1, maxW: textW
    });

    /* the far corner: one right-aligned row of label + value pairs */
    var rx = W - pad - stackW, ry = top + flow * 0.86;
    pairs.forEach(function (p, i) {
      var kw = measure(ctx, p.k, { size: row.key, family: 'mono', ls: row.ls });
      var vw = measure(ctx, p.v, { size: row.val, family: 'mono', weight: 500 });
      text(ctx, p.k, rx, ry, {
        size: row.key, family: 'mono', color: c.accent, ls: row.ls
      });
      text(ctx, p.v, rx + kw + row.keyGap, ry, {
        size: row.val, family: 'mono', weight: 500, color: c.ink
      });
      rx += kw + row.keyGap + vw + (i < pairs.length - 1 ? row.pairGap : 0);
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
    var emW = emblemAt(ctx, L, L.emblem, pad, rowY - emH / 2, emH, 'left', Math.max(u * 90, emMaxW));
    var tx = pad + (L.emblem ? emW + u * 30 : 0);
    var leftMaxW = Math.max(u * 120, inner - (tx - pad) - gutter - rightW);

    text(ctx, L.emblem ? (f.model || f.make || '') : camera(f), tx, rowY, {
      size: Math.min(u * 22, band * 0.105), family: L.opts.font, weight: 600,
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
      text(ctx, f.caption, footX, footY, {
        size: Math.min(u * 11.5, band * 0.058), family: 'mono', color: c.muted,
        upper: true, ls: u * 1.4, maxW: W * 0.6
      });
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
  /* A 14.5% band instead of 25%: the header (mark · model/date · lens) and its
     rule are pulled up to the slim band, and the full specification now prints
     as one four-column bar (colW = inner / 4) with the footer rule and its
     caption settling under it. Each cell is clipped to its own column, so no
     two columns and no column and the plate edge can meet. */
  function drawPro(ctx, L) {
    var f = L.fields, c = L.colors, u = L.u, band = L.band;
    var top = L.photoBox.y + L.PH, pad = L.inset, W = L.W;
    var inner = W - pad * 2;

    var emH = Math.min(u * 28, band * 0.16);
    var emW = emblemAt(ctx, L, L.emblem, pad, top + band * 0.09, emH, 'left', inner * 0.4);
    var tx = pad + (L.emblem ? emW + u * 24 : 0);
    /* the date owns its own column on the headline row; the model and lens are
       measured against what is left after the emblem */
    var dateStr = dateOf(f).full;
    var dateSize = Math.min(u * 12, band * 0.05);
    var dateW = Math.min(
      measure(ctx, dateStr, { size: dateSize, family: 'mono', ls: u * 1.1 }), inner * 0.32);
    var usedX = tx - pad;
    var headMaxW = Math.max(u * 120, inner - usedX - dateW - u * 24);

    text(ctx, L.emblem ? (f.model || f.make || '') : camera(f), tx, top + band * 0.19, {
      size: Math.min(u * 22, band * 0.1), family: L.opts.font, weight: 600,
      color: c.ink, ls: u * 0.3, maxW: headMaxW
    });
    text(ctx, dateStr, W - pad, top + band * 0.19, {
      size: dateSize, family: 'mono', color: c.muted,
      ls: u * 1.1, align: 'right', maxW: dateW
    });
    text(ctx, optics(f), tx, top + band * 0.3, {
      size: Math.min(u * 12.5, band * 0.055), family: 'mono', color: c.muted,
      ls: u * 0.8, maxW: Math.max(u * 120, inner - usedX)
    });

    hairline(ctx, pad, top + band * 0.375, W - pad, top + band * 0.375, c.line, Math.max(1, u * 1.2));

    // full specification bar — four columns on one row
    var cells = [
      { label: 'ISO', value: f.iso },
      { label: 'SHUTTER', value: f.shutter },
      { label: 'APERTURE', value: f.aperture },
      { label: 'FOCAL', value: f.focal }
    ];
    var colW = inner / 4;
    var labelY = top + band * 0.475, valueY = top + band * 0.625;
    var colMaxW = Math.max(u * 40, colW - u * 14);
    cells.forEach(function (cell, i) {
      var cx0 = pad + i * colW;
      text(ctx, cell.label, cx0, labelY, {
        size: Math.min(u * 9.5, band * 0.048), family: 'mono', color: c.accent,
        ls: u * 2, maxW: colMaxW
      });
      text(ctx, cell.value || '—', cx0, valueY, {
        size: Math.min(u * 19, band * 0.09), family: L.opts.font, weight: 500,
        color: c.ink, ls: u * 0.4, maxW: colMaxW
      });
    });

    hairline(ctx, pad, L.H - band * 0.2, W - pad, L.H - band * 0.2, c.line, Math.max(1, u));
    if (f.caption) {
      text(ctx, f.caption, pad, L.H - band * 0.075, {
        size: Math.min(u * 11, band * 0.045), family: 'mono', color: c.muted,
        upper: true, ls: u * 1.6, maxW: inner * 0.6
      });
    }
    text(ctx, 'HD2LAB · PRO STUDIO 08', W - pad, L.H - band * 0.075, {
      size: Math.min(u * 10, band * 0.04), family: 'mono', color: c.muted,
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
      dateOf: dateOf, join: join, filmPerf: filmPerf, strapBand: strapBand
    }
  };
})(window);
