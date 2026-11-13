/* ============================================================================
 * HD2Lab · Shutterplate (PKPilot0003)
 * Plate engine — geometry + canvas painting for the four signature plates.
 * Everything is drawn in "plate space" (plate pixels), so the live preview and
 * the 1:1 export share one paint routine and never drift apart.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var E = global.SPEmblems;

  var FONTS = {
    sans: '"Helvetica Neue", Helvetica, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", Arial, sans-serif',
    mono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", "Nanum Myeongjo", "Noto Serif KR", serif'
  };

  var STYLES = {
    classic: {
      label: 'Classic Gallery', index: '01', light: true,
      base: '#f8f6f2', ink: '#1c1a17', muted: '#78726b',
      line: 'rgba(28,26,23,0.16)', accent: '#ff824f',
      geo: { padPct: 7, extraPct: 17, radiusPct: 0.6 }
    },
    studio: {
      label: 'Studio Dark', index: '02', light: false,
      base: '#101110', ink: '#f4f2ed', muted: '#8d8b85',
      line: 'rgba(244,242,237,0.14)', accent: '#ff824f',
      geo: { padPct: 5.5, extraPct: 15.5, radiusPct: 1.4 }
    },
    clean: {
      label: 'Clean Horizon', index: '03', light: true,
      base: '#faf9f6', ink: '#17181b', muted: '#7b756c',
      line: 'rgba(23,24,27,0.14)', accent: '#ff824f',
      geo: { padPct: 3, extraPct: 9, radiusPct: 0.4 }
    },
    film: {
      label: 'Film Plate', index: '04', light: false,
      base: '#16150f', ink: '#f0e9d9', muted: '#a89c86',
      line: 'rgba(240,233,217,0.2)', accent: '#e0703c',
      geo: { padPct: 6.5, extraPct: 16, radiusPct: 0.3 }
    }
  };

  /* ---- text utilities ----------------------------------------------------- */
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

  /* ---- metadata helpers --------------------------------------------------- */
  function camera(f) {
    return [f.make, f.model].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }
  function optics(f) {
    return [f.lens].filter(Boolean).join(' ');
  }
  function specParts(f) {
    return [f.focal, f.aperture, f.shutter, f.iso].filter(Boolean);
  }
  function dateOf(f) {
    var d = String(f.datetime || '').trim();
    if (!d) return { date: '', time: '' };
    var bits = d.split(/[\sT]+/);
    return { date: bits[0] || '', time: bits[1] || '' };
  }

  /* ---- layout ------------------------------------------------------------- */
  function layout(photo, opts) {
    var style = STYLES[opts.style] ? opts.style : 'classic';
    var S = STYLES[style];
    var PW = Math.max(1, Math.round(photo.w));
    var PH = Math.max(1, Math.round(photo.h));
    var padPct = opts.padPct != null ? opts.padPct : S.geo.padPct;
    var extraPct = opts.extraPct != null ? opts.extraPct : S.geo.extraPct;
    var radiusPct = opts.radiusPct != null ? opts.radiusPct : S.geo.radiusPct;

    var padX = Math.round(PW * padPct / 100);
    var padTop = Math.round(padX * (style === 'film' ? 1.62 : 1));
    var padBottom = Math.round(padX + PH * extraPct / 100);
    var W = PW + padX * 2;
    var H = PH + padTop + padBottom;

    return {
      style: style,
      colors: S,
      opts: opts,
      fields: opts.fields || {},
      W: W, H: H, PW: PW, PH: PH,
      padX: padX, padTop: padTop, padBottom: padBottom,
      radius: W * radiusPct / 100,
      u: W / 1000,
      photoBox: { x: padX, y: padTop, w: PW, h: PH },
      emblem: opts.emblem === 'none' ? null : (opts.emblem || 'hd2lab'),
      img: photo.img
    };
  }

  /* ---- plate art ---------------------------------------------------------- */
  function emblemAt(ctx, L, id, x, y, h, align) {
    if (!id) return 0;
    var w = E.widthFor(id, h);
    E.draw(ctx, id, x, y, w, h, L.colors, align || 'left');
    return w;
  }

  function drawClassic(ctx, L) {
    var f = L.fields, c = L.colors, u = L.u, band = L.padBottom;
    var top = L.photoBox.y + L.PH, cx = L.W / 2, pad = L.padX;
    var emH = Math.min(u * 30, band * 0.24);

    if (L.emblem) emblemAt(ctx, L, L.emblem, cx - E.widthFor(L.emblem, emH) / 2, top + band * 0.13, emH);

    var line = [camera(f)].concat(specParts(f)).filter(Boolean).join('   ·   ');
    text(ctx, line, cx, top + band * 0.52, {
      size: Math.min(u * 16, band * 0.095), family: L.opts.font, weight: 500,
      color: c.muted, ls: u * 1.5, align: 'center', maxW: L.W - pad * 2
    });

    var ruleY = top + band * 0.63;
    if (f.caption) {
      hairline(ctx, cx - u * 34, ruleY, cx + u * 34, ruleY, c.line, Math.max(1, u * 1.1));
      text(ctx, f.caption, cx, top + band * 0.79, {
        size: Math.min(u * 27, band * 0.1), family: 'serif', italic: true, weight: 400,
        color: c.ink, align: 'center', ls: u * 0.2, maxW: L.W - pad * 3
      });
    }
    if (band > u * 120) {
      text(ctx, 'HD2LAB  ·  SHUTTERPLATE 03', cx, L.H - band * 0.055, {
        size: u * 9.5, family: 'mono', color: c.muted, ls: u * 2.2, align: 'center', maxW: L.W - pad * 2
      });
    }
  }

  function drawStudio(ctx, L) {
    var f = L.fields, c = L.colors, u = L.u, band = L.padBottom;
    var top = L.photoBox.y + L.PH, pad = L.padX, W = L.W;

    // accent rail
    var railY = top + band * 0.1;
    hairline(ctx, pad, railY, W - pad, railY, c.line, Math.max(1, u * 1.2));
    ctx.save();
    ctx.fillStyle = c.accent;
    ctx.fillRect(pad, railY - u * 1.4, u * 96, u * 2.8);
    ctx.restore();

    // emblem + camera block
    var emH = Math.min(u * 34, band * 0.3);
    var emW = emblemAt(ctx, L, L.emblem, pad, top + band * 0.33, emH);
    var tx = pad + (L.emblem ? emW + u * 34 : 0);

    text(ctx, camera(f), tx, top + band * 0.46, {
      size: Math.min(u * 22, band * 0.095), family: L.opts.font, weight: 600,
      color: c.ink, ls: u * 0.4, maxW: W * 0.52
    });
    text(ctx, optics(f), tx, top + band * 0.61, {
      size: Math.min(u * 14, band * 0.062), family: 'mono', color: c.muted,
      ls: u * 0.9, maxW: W * 0.52
    });

    text(ctx, specParts(f).join('   ·   '), W - pad, top + band * 0.46, {
      size: Math.min(u * 15.5, band * 0.07), family: 'mono', color: c.ink,
      ls: u * 0.6, align: 'right', maxW: W * 0.44
    });
    var d = dateOf(f);
    text(ctx, [d.date, d.time].filter(Boolean).join('  ·  '), W - pad, top + band * 0.6, {
      size: Math.min(u * 12.5, band * 0.052), family: 'mono', color: c.muted,
      ls: u * 0.6, align: 'right', maxW: W * 0.44
    });

    // footer line
    var footY = L.H - u * 30;
    if (f.caption) {
      text(ctx, f.caption, pad, footY, {
        size: Math.min(u * 11.5, band * 0.05), family: 'mono', color: c.muted,
        upper: true, ls: u * 1.4, maxW: W * 0.6
      });
    }
    text(ctx, 'SHUTTERPLATE · 03', W - pad, footY, {
      size: Math.min(u * 11.5, band * 0.05), family: 'mono', color: c.muted,
      ls: u * 1.4, align: 'right', maxW: W * 0.4
    });

    // signature corner brackets
    var inset = u * 20, len = u * 34, lw = Math.max(1.2, u * 2.2);
    ctx.save();
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(inset, inset + len); ctx.lineTo(inset, inset); ctx.lineTo(inset + len, inset);
    ctx.moveTo(L.W - inset - len, inset); ctx.lineTo(L.W - inset, inset); ctx.lineTo(L.W - inset, inset + len);
    ctx.moveTo(inset, L.H - inset - len); ctx.lineTo(inset, L.H - inset); ctx.lineTo(inset + len, L.H - inset);
    ctx.moveTo(L.W - inset - len, L.H - inset); ctx.lineTo(L.W - inset, L.H - inset); ctx.lineTo(L.W - inset, L.H - inset - len);
    ctx.stroke();
    ctx.restore();
  }

  function drawClean(ctx, L) {
    var f = L.fields, c = L.colors, u = L.u, band = L.padBottom;
    var top = L.photoBox.y + L.PH, pad = L.padX, W = L.W;

    var ruleY = top + band * 0.26;
    hairline(ctx, pad, ruleY, W - pad, ruleY, c.line, Math.max(1, u));

    var rowY = top + band * 0.56;
    var emH = Math.min(u * 20, band * 0.26);
    var emW = emblemAt(ctx, L, L.emblem, pad, rowY - emH * 0.86, emH);
    var tx = pad + (L.emblem ? emW + u * 24 : 0);

    text(ctx, [camera(f)].concat(specParts(f)).filter(Boolean).join('  ·  '), tx, rowY, {
      size: Math.min(u * 14, band * 0.115), family: L.opts.font, weight: 500, color: c.ink,
      ls: u * 1.5, maxW: W - tx - pad - u * 190
    });
    text(ctx, dateOf(f).date, W - pad, rowY, {
      size: Math.min(u * 13, band * 0.105), family: 'mono', color: c.muted,
      ls: u * 1.2, align: 'right', maxW: u * 180
    });

    if (f.caption) {
      text(ctx, 'PHOTOGRAPHED BY ' + f.caption, pad, top + band * 0.84, {
        size: Math.min(u * 11, band * 0.085), family: 'mono', color: c.muted,
        upper: true, ls: u * 1.6, maxW: W - pad * 2
      });
    }
  }

  function sprockets(ctx, x0, x1, cy, h, fill) {
    var holeW = h*1.42, pitch = holeW * 1.9, r = h * 0.2;
    ctx.save();
    ctx.fillStyle = fill;
    for (var x = x0; x + holeW <= x1; x += pitch) {
      roundRect(ctx, x, cy - h / 2, holeW, h, r);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFilmBase(ctx, L) {
    var u = L.u, pad = L.padX;
    var hole = 'rgba(238,229,210,0.72)';

    // sprocket strips on the very top and bottom edges of the strip
    sprockets(ctx, pad * 0.35, L.W - pad * 0.35, L.padTop * 0.28, L.padTop * 0.2, hole);
    sprockets(ctx, pad * 0.35, L.W - pad * 0.35, L.H - L.padBottom * 0.09, L.padBottom * 0.085, hole);

    // film edge codes
    hairline(ctx, 0, L.padTop * 0.62, L.W, L.padTop * 0.62, L.colors.line, Math.max(1, u * 1.1));
  }

  function drawFilm(ctx, L) {
    var f = L.fields, c = L.colors, u = L.u, band = L.padBottom, pad = L.padX, W = L.W;
    var top = L.photoBox.y + L.PH;

    // frame line around the photo
    ctx.save();
    ctx.strokeStyle = 'rgba(240,233,217,0.28)';
    ctx.lineWidth = Math.max(1, u * 1.4);
    ctx.strokeRect(L.photoBox.x, L.photoBox.y, L.photoBox.w, L.photoBox.h);
    ctx.restore();

    // stock badge + frame number in the top margin
    var badgeY = L.padTop * 0.87;
    text(ctx, L.opts.stock || 'KODAK PORTRA 400', pad, badgeY, {
      size: Math.min(u * 12.5, L.padTop * 0.3), family: 'mono', color: c.ink,
      ls: u * 1.8, maxW: W * 0.6
    });
    text(ctx, (L.opts.frameNo || '03') + '   ·   35MM', W - pad, badgeY, {
      size: Math.min(u * 12.5, L.padTop * 0.3), family: 'mono', color: c.accent,
      ls: u * 1.8, align: 'right', maxW: W * 0.3
    });

    // emblem + caption
    var emH = Math.min(u * 26, band * 0.17);
    var emW = emblemAt(ctx, L, L.emblem, pad, L.H - band * 0.57, emH);
    var tx = pad + (L.emblem ? emW + u * 22 : 0);
    text(ctx, f.caption || camera(f), tx, L.H - band * 0.48, {
      size: Math.min(u * 19, band * 0.075), family: 'serif', italic: true,
      color: c.ink, ls: u * 0.3, maxW: W - tx - pad
    });

    // exposure line
    text(ctx, [camera(f)].concat(specParts(f)).filter(Boolean).join('   ·   '), pad, L.H - band * 0.31, {
      size: Math.min(u * 13.5, band * 0.075), family: 'mono', color: c.muted,
      ls: u * 1.1, maxW: W - pad * 2
    });
    text(ctx, dateOf(f).date.replace(/\./g, '.'), W - pad, L.H - band * 0.31, {
      size: Math.min(u * 13, band * 0.07), family: 'mono', color: c.muted,
      ls: u * 1.1, align: 'right', maxW: W * 0.3
    });
  }

  /* ---- paint -------------------------------------------------------------- */
  function paint(ctx, L) {
    var W = L.W, H = L.H;

    ctx.save();
    roundRect(ctx, 0, 0, W, H, L.radius);
    ctx.fillStyle = L.colors.base;
    ctx.fill();
    ctx.save();
    ctx.clip();

    if (L.style === 'film') drawFilmBase(ctx, L);

    if (L.img) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(L.img, L.photoBox.x, L.photoBox.y, L.photoBox.w, L.photoBox.h);
    }

    if (L.style === 'classic') drawClassic(ctx, L);
    else if (L.style === 'studio') drawStudio(ctx, L);
    else if (L.style === 'clean') drawClean(ctx, L);
    else drawFilm(ctx, L);

    ctx.restore();
    ctx.restore();
  }

  function defaults(style) {
    var S = STYLES[style] || STYLES.classic;
    return { padPct: S.geo.padPct, extraPct: S.geo.extraPct, radiusPct: S.geo.radiusPct };
  }

  global.SPPlate = {
    STYLES: STYLES,
    FONTS: FONTS,
    layout: layout,
    paint: paint,
    defaults: defaults,
    helpers: { text: text, roundRect: roundRect, hairline: hairline, camera: camera, specParts: specParts, dateOf: dateOf }
  };
})(window);
