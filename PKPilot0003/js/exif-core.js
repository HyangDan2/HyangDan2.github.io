/* ============================================================================
 * HD2Lab · Shutterplate (PKPilot0003)
 * EXIF → plate fields. Pure functions only, so tests can exercise them directly.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var EMPTY = {
    make: '', model: '', lens: '', focal: '', aperture: '', shutter: '', iso: '',
    datetime: '', caption: ''
  };

  /* Template used when a photo carries no EXIF (PNG, WebP, screenshots…). */
  var TEMPLATE = {
    make: 'HD2Lab', model: 'SP-03 Prototype', lens: 'HD2Lab Primar 50mm F2',
    focal: '50mm', aperture: 'ƒ/2', shutter: '1/125s', iso: 'ISO 200',
    datetime: '', caption: 'HD2Lab / Shutterplate'
  };

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /** exifr may hand back a number, a [numerator, denominator] pair, or "18/10". */
  function num(v) {
    if (v == null || v === '') return NaN;
    if (typeof v === 'object') {
      if (v.numerator != null && v.denominator != null) {
        return v.denominator ? Number(v.numerator) / Number(v.denominator) : Number(v.numerator);
      }
      // exifr hands rationals back as Uint16Array pairs like [18, 10]
      if (typeof v.length === 'number' && v.length >= 1) {
        var a = Number(v[0]), b = v.length > 1 ? Number(v[1]) : 1;
        return b ? a / b : a;
      }
    }
    if (typeof v === 'string' && v.indexOf('/') >= 0) {
      var p = v.split('/');
      var n0 = Number(p[0]), d0 = Number(p[1]);
      return d0 ? n0 / d0 : n0;
    }
    return Number(v);
  }

  function fmtDateTime(value) {
    var d = value instanceof Date ? value : null;
    if (!d && typeof value === 'string' && value.trim()) {
      var m = value.trim().match(/(\d{4})[.\-\/:](\d{1,2})[.\-\/:](\d{1,2})(?:[ T](\d{1,2})[.:](\d{1,2}))?/);
      if (m) {
        return m[1] + '.' + pad2(+m[2]) + '.' + pad2(+m[3]) +
          (m[4] != null ? ' ' + pad2(+m[4]) + ':' + pad2(+m[5]) : '');
      }
      return String(value).trim();
    }
    if (!d || isNaN(d.getTime())) return '';
    return d.getFullYear() + '.' + pad2(d.getMonth() + 1) + '.' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function trimNum(n, digits) {
    var s = Number(n).toFixed(digits == null ? 1 : digits);
    return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  }

  function fmtAperture(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'string' && !/^[\d./\s]+$/.test(v.trim())) return v.trim();
    var n = num(v);
    if (!isFinite(n) || n <= 0) return '';
    return 'ƒ/' + trimNum(n, 1);
  }

  function fmtShutter(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'string') {
      var s = v.trim();
      if (/^\d+\s*\/\s*\d+/.test(s)) return s.replace(/\s+/g, '') + (/(s|sec)$/i.test(s) ? '' : 's');
      if (/^\d+(\.\d+)?$/.test(s)) v = Number(s);
      else return s;
    }
    var n = num(v);
    if (!isFinite(n) || n <= 0) return '';
    if (n >= 1) return trimNum(n, 1) + 's';
    var denom = Math.round(1 / n);
    if (denom <= 1) return trimNum(n, 2) + 's';
    return '1/' + denom + 's';
  }

  function fmtFocal(v, equiv) {
    if (v == null || v === '') return '';
    var n = num(v);
    var main = isFinite(n) ? trimNum(n, 1) + 'mm' : String(v);
    var eq = num(equiv);
    if (isFinite(eq) && eq > 0 && Math.abs(eq - n) > 0.5) return main + ' (' + Math.round(eq) + 'mm)';
    return main;
  }

  function fmtISO(v) {
    if (v == null || v === '') return '';
    var arr = Array.isArray(v) ? v : [v];
    var n = num(arr[0]);
    return isFinite(n) && n > 0 ? 'ISO ' + Math.round(n) : String(v);
  }

  function clean(s) {
    return String(s == null ? '' : s).replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
  }

  /** Normalise an exifr tag object into the eight plate fields. */
  function fromTags(tags) {
    var t = tags || {};
    var make = clean(t.Make);
    var model = clean(t.Model);
    // Many bodies repeat the maker inside the model ("SONY ILCE-7M4" / "ILCE-7M4").
    if (make && model.toLowerCase().indexOf(make.split(' ')[0].toLowerCase()) === 0) {
      var head = make.split(' ')[0];
      model = clean(model.slice(head.length));
    }
    return {
      make: make,
      model: model,
      lens: clean(t.LensModel || t.Lens || t.LensInfo),
      focal: fmtFocal(t.FocalLength, t.FocalLengthIn35mmFormat || t.FocalLengthIn35mmFilm),
      aperture: fmtAperture(t.FNumber || t.ApertureValue),
      shutter: fmtShutter(t.ExposureTime || t.ShutterSpeedValue),
      iso: fmtISO(t.ISO || t.ISOSpeedRatings),
      datetime: fmtDateTime(t.DateTimeOriginal || t.CreateDate || t.ModifyDate),
      caption: clean(t.ImageDescription || t.XPTitle || t.Artist || t.Copyright)
    };
  }

  /** Merge parsed fields over a base (template), keeping useful values first. */
  function merge(parsed, base) {
    var out = {};
    Object.keys(EMPTY).forEach(function (k) {
      out[k] = clean((parsed && parsed[k]) || (base && base[k]) || '');
    });
    return out;
  }

  function templateFor(dateValue) {
    var base = Object.assign({}, TEMPLATE);
    base.datetime = fmtDateTime(dateValue || new Date());
    return base;
  }

  /** "Shutterplate_{Camera}_{DateTime}.jpg" */
  function fileName(fields, ext) {
    var cam = clean([fields.make, fields.model].filter(Boolean).join(' ')) || 'Camera';
    var d = String(fields.datetime || '').replace(/[^\d]/g, '').slice(0, 12) || 'Undated';
    var slug = cam.replace(/[^\w가-힣]+/g, '-').replace(/^-+|-+$/g, '');
    return 'Shutterplate_' + slug + '_' + d + '.' + (ext || 'jpg');
  }

  function tagCount(tags) {
    if (!tags) return 0;
    var n = 0;
    Object.keys(tags).forEach(function (k) {
      var v = tags[k];
      if (v === undefined || v === null || v === '') return;
      if (typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) {
        n += tagCount(v);
      } else n++;
    });
    return n;
  }

  global.SPExif = {
    EMPTY: EMPTY,
    TEMPLATE: TEMPLATE,
    fmtDateTime: fmtDateTime,
    fmtAperture: fmtAperture,
    fmtShutter: fmtShutter,
    fmtFocal: fmtFocal,
    fmtISO: fmtISO,
    fromTags: fromTags,
    merge: merge,
    templateFor: templateFor,
    fileName: fileName,
    tagCount: tagCount
  };
})(typeof window !== 'undefined' ? window : globalThis);
