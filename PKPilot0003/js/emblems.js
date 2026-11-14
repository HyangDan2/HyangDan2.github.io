/* ============================================================================
 * HD2Lab · Shutterplate (PKPilot0003)
 * Maker emblems — official brand marks, drawn as vector paths.
 *
 * Every manufacturer glyph below is the maker's own published logo artwork,
 * not a font impression: the path data was lifted from the official logo file
 * named in EMBLEM-SOURCES.md, re-normalised to height 100 units with the
 * curves kept — and, with the emblem colour switch, painted in each maker's
 * own colour unless the visitor picks one ink for the whole plate.
 *
 * HD2Lab's own emblem is the official logo (assets/logo-mark.png, the round
 * emblem of the brand's LOGO.png), so it is drawn as an image rather than
 * redrawn as paths: the site header, the favicon and the plate then carry the
 * same artwork. Trademarks belong to their owners; they are used here to
 * credit the camera that shot the photo, the way a printed frame does.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var SANS = 'Helvetica Neue, Helvetica, Arial, sans-serif';
  var MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  var SERIF = 'Iowan Old Style, Palatino Linotype, Palatino, Georgia, serif';

  /* The official HD2Lab emblem — the round badge of assets/LOGO.png. */
  var LOGO_SRC = '../assets/logo-mark.png';

  function t(s, x, y, size, family, weight, ls, align) {
    return { t: 't', s: s, x: x, y: y, size: size, family: family || SANS,
             weight: weight || 400, ls: ls || 0, align: align || 'left' };
  }
  function p(d, fill, stroke, sw, rule) {
    return { t: 'p', d: d, fill: fill || null, stroke: stroke || null, sw: sw || 0, rule: rule || 'nonzero' };
  }
  function c(cx, cy, r, fill, stroke, sw) {
    return { t: 'c', cx: cx, cy: cy, r: r, fill: fill || null, stroke: stroke || null, sw: sw || 0 };
  }
  function r(x, y, w, h, rx, fill, stroke, sw) {
    return { t: 'r', x: x, y: y, w: w, h: h, rx: rx || 0, fill: fill || null, stroke: stroke || null, sw: sw || 0 };
  }
  function i(x, y, w, h) {
    return { t: 'i', x: x, y: y, w: w, h: h, src: LOGO_SRC };
  }

  /* Each spec: vb = [width, height] in abstract units (the mark is 100 units
     tall); ops are drawn inside it. Widths differ a lot — an Apple glyph is
     near-square, the Hasselblad wordmark is 12.8× its height — so the plate
     layout caps emblem width per frame instead of assuming one shape. */
  var LIST = [
    {
      /* Official Sony mark — vector path data taken unmodified from the
         published logo file (https://commons.wikimedia.org/wiki/File:Sony_logo.svg);
         colour normalised to the plate ink, geometry untouched. */
      id: 'sony', name: 'Sony', vb: [568.18, 100],
      ops: [
        p('M202.42 100C181.82 100 162.73 93.87 150 82.42C140.79 74.15 135.6 62.31 135.74 49.93C135.71 37.61 140.89 25.85 150 17.56C161.82 6.82 182.73 0 202.42 0C224.21 0 241.65 5.49 254.98 17.58C264.05 25.87 269.17 37.64 269.05 49.93C268.99 62.22 263.9 73.96 254.98 82.42C242.56 93.93 223.06 100 202.42 100L202.42 86.84C213.34 86.84 223.48 83.07 230.56 76.02C237.64 68.98 240.85 60.43 240.85 49.88C240.85 39.82 237.32 30.41 230.56 23.75C223.57 16.88 213.19 13 202.42 13C191.65 13 181.23 16.84 174.24 23.75C167.5 30.42 164.01 39.86 164.01 49.88C163.81 59.61 167.49 69.02 174.24 76.02C181.23 82.99 191.58 86.84 202.42 86.84ZM51.99 0C40.98 0 28.47 2.07 17.9 6.82C8.03 11.23 0 18.31 0 30.05C-0.01 36.19 2.32 42.11 6.53 46.59C9.39 49.23 13.99 53.71 26.01 56.34C31.39 57.48 42.88 59.31 54.32 60.51C65.76 61.71 76.85 62.78 81.4 64C85.01 64.92 91.09 66.17 91.09 72.99C91.09 79.81 84.69 81.85 83.58 82.3C82.47 82.74 74.78 86.26 60.99 86.26C51.85 86.01 42.79 84.45 34.09 81.64C28.94 79.79 23.54 77.37 18.51 71.23C16.48 68.33 15.35 64.9 15.27 61.36L2.77 61.36L2.77 96.36L16.66 96.36L16.66 91.62C16.65 90.91 17.04 90.25 17.66 89.89C18.28 89.54 19.05 89.55 19.66 89.92C26.2 92.77 33.01 94.97 39.98 96.49C47.27 98.01 51.99 99.11 61.06 99.11C70.63 99.29 80.16 97.95 89.31 95.13C95.38 93.46 101.08 90.65 106.09 86.84C111.81 82.45 115.14 75.63 115.08 68.42C115.13 61.67 112.52 55.16 107.82 50.31C105.2 47.77 102.18 45.7 98.86 44.18C95.3 42.57 91.61 41.28 87.82 40.33C80.62 38.57 64.43 36.36 56.69 35.59C48.58 34.75 34.5 33.58 28.88 31.84C27.17 31.31 23.69 29.66 23.69 25.63C23.69 22.75 25.28 20.32 28.42 18.35C33.41 15.23 43.48 13.29 53.98 13.29C64.14 13.16 74.22 15.13 83.59 19.07C86.11 20.17 88.48 21.58 90.64 23.27C94.16 26.28 96.6 30.36 97.58 34.89L108.79 34.89L108.79 4.42L96.29 4.42L96.29 7.95C96.29 9.09 95.16 10.59 92.88 9.35C87.25 6.42 71.41 0.08 51.99 0ZM326.41 5.59L387.5 60.72L386.87 23.6C386.81 18.73 385.92 16.69 380.65 16.69L369.17 16.69L369.17 5.59L421.44 5.59L421.44 16.69L410.23 16.69C404.87 16.69 404.55 18.42 404.46 23.6L405.4 94.52L387.5 94.52L317.13 31.73L317.13 76.28C317.18 81.13 317.41 83.42 322.4 83.42L334.9 83.42L334.9 94.52L283.66 94.52L283.66 83.42L295.66 83.42C300.14 83.42 299.96 79.15 299.96 76.03L299.96 24.02C299.96 20.61 299.48 16.7 292.45 16.7L282.73 16.7L282.73 5.59ZM481.08 83.4C482.11 83.4 483.15 83.33 484.17 83.2C485.25 82.88 486.13 82.1 486.58 81.07C486.74 80.28 486.82 79.47 486.82 78.67L486.82 61.12C486.82 60.52 486.82 60.51 486.07 59.58C485.32 58.65 454.07 23.22 452.65 21.63C450.87 19.69 447.76 16.7 443.02 16.7L432.17 16.7L432.17 5.59L493.42 5.59L493.42 16.68L486.04 16.68C484.33 16.68 483.19 18.31 484.65 20.09C484.65 20.09 505.26 44.75 505.46 45.01C505.65 45.27 505.82 45.33 506.08 45.09C506.34 44.85 527.21 20.32 527.36 20.09C527.87 19.43 527.94 18.54 527.55 17.8C527.16 17.07 526.38 16.63 525.55 16.68L517.96 16.68L517.96 5.59L568.18 5.59L568.18 16.7L556.96 16.7C552.9 16.7 551.28 17.45 548.18 20.91L514.37 59.48C514.04 59.96 513.9 60.54 513.96 61.12L513.96 78.66C513.97 79.47 514.05 80.27 514.22 81.05C514.66 82.09 515.54 82.87 516.61 83.19C517.63 83.33 518.66 83.39 519.68 83.39L531.15 83.39L531.15 94.5L470.21 94.5L470.21 83.39Z', 'ink')
      ]
    },
    {
      /* Official Canon mark — vector path data taken unmodified from the
         published logo file (https://commons.wikimedia.org/wiki/File:Canon_logo.svg);
         maker's red (#CC0000) restored, geometry untouched. */
      id: 'canon', name: 'Canon', vb: [481.37, 100],
      brand: { light: '#CC0000' },
      ops: [
        p('M78.58 90.25C56.22 90.25 38.04 72.24 38.04 50C38.04 27.76 56.22 9.75 78.58 9.75C86.49 9.75 93.86 12 100.08 15.85L78.58 50L119 26.82C114.62 19.86 108.31 13.88 100.7 9.34C91.03 3.56 77.52 0 62.61 0C41.36 0 22.69 7.66 12.29 19.16C4.59 27.64 0 38.37 0 50C0 61.63 4.59 72.36 12.29 80.84C22.73 92.38 41.07 100 62 100C82.92 100 101.31 92.38 111.75 80.84C112.33 80.22 112.86 79.57 113.39 78.91L111.83 73.05C104.5 83.46 92.34 90.25 78.58 90.25', 'brand'),
        p('M160.85 87.84C152.74 87.84 146.11 81.24 146.11 73.18C146.11 65.11 152.74 58.56 160.85 58.56C169 58.56 175.59 65.11 175.59 73.18C175.59 81.24 169 87.84 160.85 87.84L160.85 87.84ZM212.61 97.58L195.66 34.68C192.92 24.53 183.62 17.08 172.52 17.08C169.66 17.08 166.91 17.57 164.33 18.51L127.81 31.7L165.4 31.7L171.83 55.53C165.56 50.2 157.45 46.97 148.57 46.97C130.96 46.97 116.67 58.68 116.67 73.18C116.67 87.67 130.96 99.43 148.57 99.43C161.26 99.43 172.52 93.24 179.44 83.74L183.17 97.58L212.61 97.58L212.61 97.58Z', 'brand'),
        p('M281.82 17.08C279.61 17.08 277.48 17.57 275.59 18.43L252.13 29.32C250.98 22.36 244.92 17.08 237.63 17.08C235.38 17.08 233.29 17.57 231.37 18.43L202.74 31.7L222.89 31.7L222.89 97.58L252.33 97.58L252.33 39.03C252.33 34.97 255.65 31.7 259.71 31.7C263.8 31.7 267.08 34.97 267.08 39.03L267.08 97.58L296.56 97.58L296.56 31.7C296.56 23.63 289.97 17.08 281.82 17.08', 'brand'),
        p('M466.63 17.08C464.41 17.08 462.29 17.57 460.4 18.43L436.98 29.32C435.79 22.36 429.73 17.08 422.44 17.08C420.19 17.08 418.1 17.57 416.22 18.43L387.55 31.7L407.7 31.7L407.7 97.58L437.18 97.58L437.18 39.03C437.18 34.97 440.46 31.7 444.55 31.7C448.61 31.7 451.88 34.97 451.88 39.03L451.92 97.58L481.37 97.58L481.37 31.7C481.37 23.63 474.77 17.08 466.63 17.08', 'brand'),
        p('M352.33 29.65C351.02 24.77 345.99 21.87 341.07 23.18C336.16 24.49 333.21 29.52 334.56 34.4L348.85 87.43C350.16 92.3 355.2 95.21 360.11 93.9C365.03 92.59 367.98 87.55 366.63 82.68L352.33 29.65L352.33 29.65ZM392.34 58.56C392.34 81.45 373.67 100 350.57 100C327.52 100 308.85 81.45 308.85 58.56C308.85 35.63 327.52 17.08 350.57 17.08C373.67 17.08 392.34 35.63 392.34 58.56L392.34 58.56Z', 'brand')
      ]
    },
    {
      /* Official Nikon mark — vector path data taken unmodified from the
         published logo file (https://www.nikon.com/etc.clientlibs/nikoncore/clientlibs/clientlib-site/resources/img/logo.svg);
         colour normalised to the plate ink, geometry untouched. */
      id: 'nikon', name: 'Nikon', vb: [361.61, 100],
      ops: [
        p('M129.56 97.38L150.44 3.3L176.18 3.31L164.95 53.34L185.74 28.25L214.51 28.25L188.69 59.62L199.34 97.38L173.66 97.38L163.05 61.6L154.65 97.38L129.56 97.38ZM36.65 50.09L54.78 97.38L79.45 97.38L100.69 3.3L75.3 3.31L64.54 51.16L46.75 3.28L21 3.28L0 97.38L25.9 97.38C28.84 82.3 32.77 66.38 36.65 50.09ZM117.24 97.38L132.64 28.29L107.37 28.29L91.96 97.38L117.24 97.38ZM108.67 13.15C108.67 15.32 109.17 22.99 123.01 22.99C134.5 22.99 138.93 15.62 138.93 10.12C138.93 6.43 135.9 0 124.58 0C114.15 0.01 108.67 6.98 108.67 13.15ZM351.75 27.36C340.94 24.14 327.55 29.48 320.94 38.62C321.59 35.79 322.28 32.49 323.05 28.69L297.4 28.69L282.4 97.38L307.92 97.38L316.43 58.42C317.99 51.26 323.77 48.19 328.87 49.51C331.06 50.11 334.1 51.77 333.09 57.74L324.43 97.38L349.65 97.38L361.22 44.48C363.66 32.82 354.09 28.05 351.75 27.36ZM265.94 91.14C277.01 82.08 282.5 66.77 282.31 52.36C282.13 38.5 270.39 25.36 249.98 25.36C211.07 25.36 205.42 55.68 204.3 61.22C201.45 75.22 204.62 93.4 222.89 98.22C234.95 101.4 253.8 101.05 265.94 91.14ZM237.39 51.1C239.22 46.06 244.19 44.95 246.45 44.92C252.02 44.88 253.55 48.19 253.07 51.3C251.73 59.94 248.73 70.9 247.63 74.4C247.62 74.44 247.61 74.49 247.6 74.52C246.38 78.34 242.78 80.56 238.55 80.56C234.27 80.56 231.68 77.87 232.04 74.44C232.67 68.64 236.34 53.98 237.39 51.1Z', 'ink')
      ]
    },
    {
      /* Official Fujifilm mark — vector path data taken unmodified from the
         published logo file (https://commons.wikimedia.org/wiki/File:Fujifilm_logo.svg);
         ink body kept; the notch of the I carries FUJIFILM red (#ED1A3D), geometry untouched. */
      id: 'fujifilm', name: 'Fujifilm', vb: [600.91, 100],
      brand: { light: '#ED1A3D' },
      ops: [
        p('M457.74 0.01L457.74 78.28C457.74 83.37 460.25 85.98 465.36 86.24C465.43 86.25 491.15 86.25 491.15 86.25L491.15 95.02C491.15 96 490.63 96.69 489.54 96.69L447.78 96.69C434.89 96.69 432.98 89.59 432.98 83.14L432.98 5.33C432.98 1.66 434.38 -0.08 438.72 0.02L457.74 0.01', 'ink'),
        p('M409.62 0.01L409.62 91.6C409.62 95.67 407.9 96.69 404.43 96.69L384.84 96.69L384.84 5.07C384.84 2.05 385.99 0.02 390.39 0.02L409.62 0.01', 'ink'),
        p('M0 13.34C0 5.97 0.02 0 12.12 0L65.35 0L65.35 9.3C65.35 9.97 65.03 10.56 64.11 10.56L32.21 10.55C27.93 10.55 25.77 12.61 25.77 16.94L25.77 41.49L63.3 41.49L63.31 51.23C63.31 52.1 62.76 52.55 61.92 52.55L25.77 52.55L25.77 91.51C25.69 95.27 23.82 96.76 19.69 96.69L0 96.69L0 13.34', 'ink'),
        p('M103.79 0L103.79 73.7C103.79 80.03 104.68 84.46 109.13 87.02C115.08 90.47 125.15 90.52 131.22 87.12C135.37 84.8 136.96 81.08 136.96 73.72L136.96 4.92C136.96 1.82 138.13 0 142.46 0L161.72 0L161.73 71.52C161.73 88.13 151.27 94.95 142.02 97.48C129.72 100.83 111.03 100.88 99.42 97.39C85.55 93.22 79.06 85.01 79.05 71.52L79.03 4.97C79.03 1.76 80.19 0 83.89 0L103.79 0', 'ink'),
        p('M572.26 0.02C567.38 0.02 564.59 2.3 563.49 6.66L547.71 73.33L547.28 73.32L530.99 0.02L508.71 0.02C504.41 0.02 503.06 2.23 503.06 5.64L503.06 96.69L512.47 96.69C513.99 96.69 514.61 95.94 514.61 94.4L514.61 18.06L516.1 18.06L536.25 96.69L549.43 96.69C554.4 96.69 556.25 94.66 557.48 89.74L575.56 18.06L577.02 18.06L577.02 96.69L594.61 96.67C598.93 96.67 600.91 95.01 600.91 90.77L600.91 0.01L572.26 0.02', 'ink'),
        p('M279.43 52.55L254.66 52.55L254.66 96.69L274.25 96.69C277.7 96.69 279.43 95.68 279.43 91.6C279.43 91.6 279.43 72.71 279.43 52.55', 'ink'),
        p('M277.99 33.69C278.86 32.98 279.36 32.46 279.43 30.94L279.43 0.02L260.2 0.02C255.87 0.02 254.67 2.13 254.67 5.15L254.67 51.96L277.99 33.69', 'brand'),
        p('M193.08 89.05C203.84 87.52 207.41 81.14 207.41 71.72L207.41 5.26C207.41 1.29 209.56 0 212.34 0L232.18 0L232.18 62.83C232.18 78.29 228.92 86.09 219.77 92.68C215.01 96.1 206.68 99.99 188.63 99.99C178.3 99.99 173.7 99.42 173.08 99.27C172.21 99.07 171.86 98.53 171.86 97.77L171.86 89.66C176.1 89.79 185.82 90.08 193.08 89.05', 'ink'),
        p('M316.96 0C304.86 0 304.85 5.97 304.85 13.34L304.85 38.25C304.85 38.77 304.63 38.97 304.4 39.2L287.45 52.55L304.85 52.55L304.85 96.69L324.53 96.69C328.65 96.76 330.53 95.26 330.6 91.51L330.6 52.56L366.74 52.56C367.6 52.56 368.14 52.1 368.14 51.24L368.14 41.48L330.6 41.48L330.6 16.94C330.6 12.61 332.76 10.55 337.05 10.55L368.95 10.56C369.87 10.56 370.19 9.97 370.19 9.31L370.19 0L316.96 0', 'ink')
      ]
    },
    {
      /* Official Samsung mark — vector path data taken unmodified from the
         published logo file (https://commons.wikimedia.org/wiki/File:Samsung_wordmark.svg);
         Samsung Blue (#1428A0, lifted to #3B6BFF on dark frames) restored, geometry untouched. */
      id: 'samsung', name: 'Samsung', vb: [652.91, 100],
      brand: { light: '#1428A0', dark: '#3B6BFF' },
      ops: [
        p('M619.89 43.92L619.89 57.53L629.46 57.53L629.46 71.04C629.49 72.25 629.42 73.55 629.21 74.59C628.83 77.11 626.44 81.4 619.65 81.4C612.9 81.4 610.55 77.11 610.14 74.59C609.97 73.55 609.9 72.25 609.9 71.04L609.9 28.38C609.9 26.87 610 25.22 610.32 23.97C610.78 21.7 612.8 17.21 619.6 17.21C626.74 17.21 628.52 21.94 628.93 23.97C629.2 25.31 629.21 27.57 629.21 27.57L629.21 32.75L652.72 32.75L652.72 29.69C652.72 29.69 652.83 26.49 652.54 23.51C650.77 6 636.35 0.46 619.81 0.46C603.24 0.46 589.1 6.05 587.04 23.51C586.86 25.11 586.57 27.98 586.57 29.69L586.57 68.93C586.57 70.64 586.63 71.96 586.94 75.09C588.48 92.11 603.24 98.15 619.74 98.15C636.35 98.15 651 92.11 652.56 75.09C652.84 71.96 652.87 70.64 652.91 68.93L652.91 43.92ZM457.81 2.97L434.2 2.97L434.2 72.02C434.24 73.23 434.2 74.58 434 75.57C433.5 77.89 431.54 82.35 425.03 82.35C418.6 82.35 416.58 77.89 416.12 75.57C415.89 74.58 415.86 73.23 415.89 72.02L415.89 2.97L392.29 2.97L392.29 69.88C392.26 71.61 392.4 75.13 392.5 76.05C394.13 93.49 407.87 99.15 425.03 99.15C442.22 99.15 455.95 93.49 457.61 76.05C457.74 75.13 457.91 71.61 457.81 69.88ZM240.91 2.97L229.14 75.94L217.37 2.97L179.29 2.97L177.27 96.31L200.6 96.31L201.23 9.91L217.28 96.31L240.95 96.31L257.01 9.91L257.65 96.31L281.03 96.31L278.95 2.97ZM99.93 2.97L82.64 96.31L107.85 96.31L120.88 9.91L133.6 96.31L158.64 96.31L141.42 2.97ZM540.31 78.12L518.33 2.97L483.69 2.97L483.69 95.34L506.6 95.34L505.27 17.79L528.88 95.34L562.1 95.34L562.1 2.97L539.03 2.97ZM328.36 27.26C327.95 25.42 328.07 23.46 328.28 22.44C328.95 19.45 330.96 16.19 336.74 16.19C342.13 16.19 345.29 19.55 345.29 24.6L345.29 30.3L368.3 30.3L368.3 23.8C368.3 3.69 350.27 0.53 337.22 0.53C320.78 0.53 307.35 5.95 304.9 21.08C304.25 25.2 304.09 28.85 305.12 33.52C309.12 52.39 341.97 57.86 346.74 69.79C347.58 72.05 347.34 74.94 346.91 76.64C346.19 79.74 344.1 82.86 337.91 82.86C332.1 82.86 328.61 79.52 328.61 74.49L328.6 65.53L303.83 65.53L303.83 72.65C303.83 93.29 319.99 99.51 337.4 99.51C354.07 99.51 367.84 93.82 370.05 78.37C371.1 70.4 370.31 65.2 369.88 63.24C366.02 43.89 331.01 38.07 328.36 27.26M24.81 27.04C24.36 25.15 24.46 23.17 24.71 22.13C25.35 19.16 27.37 15.84 33.26 15.84C38.72 15.84 41.93 19.24 41.93 24.32L41.93 30.1L65.21 30.1L65.21 23.54C65.21 3.24 46.91 0 33.71 0C17.13 0 3.58 5.5 1.1 20.75C0.43 24.93 0.31 28.61 1.29 33.33C5.33 52.41 38.5 57.93 43.33 70C44.24 72.25 43.96 75.13 43.51 76.89C42.75 80.03 40.64 83.2 34.4 83.2C28.57 83.2 25.08 79.8 25.08 74.7L25.05 65.72L0 65.72L0 72.86C0 93.72 16.39 100 33.93 100C50.8 100 64.64 94.25 66.9 78.63C68.03 70.58 67.18 65.34 66.81 63.35C62.87 43.76 27.47 37.96 24.81 27.04', 'brand')
      ]
    },
    {
      /* Official Leica mark — vector path data taken unmodified from the
         published logo file (https://commons.wikimedia.org/wiki/File:Leica_Camera_logo.svg);
         Leica red roundel (#E20613) restored with the script cut out, geometry untouched. */
      id: 'leica', name: 'Leica', vb: [100.0, 100],
      brand: { light: '#E20613' },
      ops: [
        p('M49.98 100C77.6 100 100 77.6 100 50.02C100 22.4 77.6 0 49.98 0C22.36 0 0 22.4 0 50.02C0 77.6 22.36 100 49.98 100M33.83 27.65C24.41 27.3 21.87 40.71 21.27 43C21.23 43.14 21.16 43.21 21.16 43.21C18.27 42.82 16.65 42.22 16.65 42.22L15.98 44.09C17.95 45.01 20.85 45.29 20.85 45.29C20.28 48.92 17.43 55.66 17.43 55.66C17.43 55.66 14.89 54.89 11.68 54.89C7.51 54.89 6.07 56.86 5.96 58.1C5.68 61.31 9.74 62.82 12.56 62.82C18.06 62.82 20.95 59.86 20.95 59.86C20.95 59.86 36.33 65.68 52.49 65.68C73.58 65.68 91.39 60.07 91.39 60.07L90.83 58.1C90.83 58.1 77.92 62.57 53.23 62.29C36.23 62.08 23.14 57.11 23.14 57.11C23.14 57.11 23.63 56.23 23.92 55.66C25.61 52.17 27.65 45.19 27.65 45.19C27.65 45.19 39.37 41.9 39.37 32.63C39.37 29.7 36.54 27.8 33.83 27.65ZM34.29 30.3C36.08 30.3 36.75 31.75 36.61 33.09C35.7 40.85 28.01 42.65 28.01 42.65C28.01 42.65 29.88 30.3 34.29 30.3ZM53.02 36.72C51.04 36.72 49.7 37.5 49.7 39.37C49.7 41.2 51.29 41.66 53.02 41.66C54.78 41.66 56.44 40.92 56.44 39.01C56.44 37.11 54.43 36.72 53.02 36.72ZM79.15 43.42C73.51 43.42 70.48 48.29 70.34 51.15C70.3 51.78 70.23 51.82 70.23 51.82C70.09 51.96 68.15 54.25 65.68 54.25C63.74 54.25 63.39 52.63 63.39 51.57C63.39 50.44 64.34 45.96 67.02 45.96C68.47 45.96 69.35 47.2 69.35 47.2L70.12 44.66C70.12 44.66 68.89 43.67 66.35 43.67C60.92 43.63 57.25 47.69 57.11 51.36C57.07 51.92 56.97 52.1 57 52.13C56.83 52.35 55.52 53.9 53.79 53.9C52.59 53.9 52.59 52.98 52.59 52.59C52.59 52.03 54.89 43.99 54.89 43.99L48.71 44.09L46.63 51.92C46.63 51.92 43.17 54.32 38.48 54.67C36.05 54.85 35.17 53.33 35.17 52.49C35.17 52.1 35.17 52.13 35.17 52.13C35.17 52.13 36.19 52.24 36.93 52.24C37.5 52.24 44.76 51.68 44.76 47.3C44.76 44.76 42.19 43.88 39.01 43.88C33.16 43.88 28.99 47.48 28.99 51.82C28.99 55.77 32.35 57.43 36.72 57.43C41.62 57.43 46.53 54.46 46.53 54.46C46.53 54.46 46.81 57.43 50.72 57.43C54.71 57.43 57.88 54.46 57.88 54.46C57.88 54.46 59.61 57.32 63.6 57.32C67.69 57.32 70.76 54 70.76 54C70.76 54 71.92 57.11 75.94 57.11C79.12 57.11 80.81 55.1 80.81 55.1C80.81 55.1 81.69 57.11 84.44 57.11C87.8 57.11 90.26 54.78 90.26 54.78L89.74 52.8C89.74 52.8 88.43 53.79 87.51 53.79C86.81 53.79 86.42 53.23 86.42 52.59C86.42 51.15 88.75 43.99 88.75 43.99L83.1 44.09L82.89 44.97C82.89 44.97 82.05 43.42 79.15 43.42ZM39.22 45.64C40.07 45.68 40.71 46.24 40.67 46.84C40.53 50.76 35.7 50.16 35.7 50.16C35.7 50.16 36.44 45.47 39.22 45.64ZM80.25 45.75C81.41 45.75 82.01 46.67 82.01 47.41C82.01 47.55 81.34 54.25 78.02 54.25C76.54 54.25 76.51 52.52 76.51 52.03C76.51 50.76 77.5 45.75 80.25 45.75ZM10.58 57.32C10.86 57.28 11.11 57.32 11.36 57.32C13.76 57.46 15.87 58.31 15.87 58.31C15.87 58.31 13.4 60.25 11.36 60.28C9.81 60.35 8.82 59.33 8.82 58.77C8.82 57.78 9.74 57.39 10.58 57.32Z', 'brand', null, 0, 'evenodd')
      ]
    },
    {
      /* Official Hasselblad mark — vector path data taken unmodified from the
         published logo file (https://commons.wikimedia.org/wiki/File:Hasselblad_logo.svg);
         colour normalised to the plate ink, geometry untouched. */
      id: 'hasselblad', name: 'Hasselblad', vb: [1276.56, 100],
      ops: [
        p('M682.57 98.9L715.77 98.9L718.6 90.09L685.4 90.09', 'ink'),
        p('M942.82 98.9L976.02 98.9L978.85 90.09L945.65 90.09', 'ink'),
        p('M211.93 65.25L220.36 65.25L226.47 98.9L249.76 98.9L231.75 0.79L216.24 0.79L183.82 57.02L183.95 57.02L158.4 57.02L155.51 65.25L179.06 65.25L159.63 98.9L172.17 98.9L191.67 65.32L191.6 65.25L211.93 65.25L210.39 57.02L196.36 57.02L196.43 57.02L213.48 27.49L218.88 57.02L210.39 57.02L211.93 65.25Z', 'ink'),
        p('M569.4 54.64L558.27 89.77L597.97 89.77L595.2 98.9L530.86 98.9L544.89 54.64L544.82 54.64L530.41 54.64L533.18 46.4L547.52 46.4L547.46 46.4L561.87 0.79L626.21 0.79L623.7 9.47L583.81 9.47L572.04 46.4L597.97 46.4L595.2 54.64L569.4 54.64Z', 'ink'),
        p('M685.47 90.15L713.71 0.79L689.97 0.79L658.96 98.9L682.57 98.9', 'ink'),
        p('M945.72 90.15L973.96 0.79L950.22 0.79L919.21 98.9L942.82 98.9', 'ink'),
        p('M100.69 0.79L85.96 47.3L86.09 47.3L49.93 47.3L49.93 47.3L64.66 0.79L41.37 0.79L26.64 47.3L2.96 47.3L0.32 55.99L23.93 55.99L10.36 98.9L33.65 98.9L47.16 55.99L83.25 55.99L69.68 98.9L92.97 98.9L123.92 0.79L100.69 0.79Z', 'ink'),
        p('M1080.51 65.25L1091.13 65.25L1097.24 98.9L1120.53 98.9L1102.51 0.79L1086.94 0.79L1054.58 57.02L1054.71 57.02L1029.17 57.02L1026.27 65.25L1049.82 65.25L1030.39 98.9L1042.94 98.9L1062.37 65.32L1062.37 65.25L1080.51 65.25L1080.51 57.02L1067.13 57.02L1067.19 57.02L1084.24 27.49L1089.65 57.02L1089.58 57.02L1080.51 57.02L1080.51 65.25Z', 'ink'),
        p('M0 55.99L2.7 47.3', 'ink'),
        p('M323.5 52.39C290.94 30.83 324.14 -18.39 370.14 7.16L365.19 15.33C336.69 -3.59 313.4 23.05 336.94 33.47C343.83 37.01 349.04 38.68 357.79 44.99C366.6 51.29 369.56 60.04 367.12 70.72C359.98 101.67 321.31 108.88 298.02 88.54L304.32 80.37C335.01 106.11 364.09 77.35 344.66 64.48C336.69 59.14 329.03 56.25 323.5 52.39Z', 'ink'),
        p('M435.51 52.39C402.96 30.83 436.09 -18.39 482.16 7.16L477.2 15.33C448.7 -3.59 425.41 23.05 448.96 33.47C455.84 37.01 460.99 38.68 469.8 44.99C478.62 51.29 481.58 60.04 479.13 70.72C471.99 101.67 433.32 108.88 410.03 88.54L416.34 80.37C447.03 106.11 476.11 77.35 456.61 64.48C448.7 59.14 440.98 56.25 435.51 52.39Z', 'ink'),
        p('M813.76 45.89L818.01 45.89L815.37 54.83L810.99 54.83L810.48 54.83L798.9 90.22L774.51 89.9L786.29 54.9L785.77 54.9L771.04 54.9L774.06 45.95L779.85 45.95L789.25 46.02L804.37 0.79C804.37 0.79 807.58 0.85 836.34 0.79C875.72 0.79 880.87 37.46 841.75 49.43C875.72 57.28 860.21 98.07 815.3 98.9L771.49 98.9L774.51 89.9L807.26 90.22L815.56 90.22C833.32 89.9 851.78 55.15 824.38 54.83L815.37 54.83L818.01 45.89L825.73 45.89C850.43 45.37 855.84 8.89 830.81 9.47L825.34 9.47L813.76 45.89Z', 'ink'),
        p('M1210.02 98.9L1207.51 98.9L1207.51 89.77L1209.12 89.77C1252.49 89.77 1269.79 9.92 1233.31 9.92L1225.53 9.92L1198.19 89.77L1207.51 89.77L1207.51 98.9L1172.19 98.9L1204.1 0.79L1233.31 0.79C1300.93 -0.05 1286.52 96.2 1210.02 98.9Z', 'ink')
      ]
    },
    {
      /* Official Apple mark — vector path data taken unmodified from the
         published logo file (https://commons.wikimedia.org/wiki/File:Apple_logo_black.svg);
         colour normalised to the plate ink, geometry untouched. */
      id: 'apple', name: 'Apple', vb: [81.42, 100],
      ops: [
        p('M78.82 34.09C78.24 34.54 68 40.31 68 53.15C68 67.99 81.03 73.24 81.42 73.37C81.36 73.69 79.35 80.56 74.55 87.56C70.27 93.72 65.8 99.87 59 99.87C52.2 99.87 50.45 95.92 42.59 95.92C34.94 95.92 32.22 100 26 100C19.78 100 15.44 94.3 10.45 87.3C4.67 79.08 0 66.31 0 54.19C0 34.74 12.64 24.43 25.08 24.43C31.69 24.43 37.2 28.77 41.35 28.77C45.3 28.77 51.47 24.17 58.99 24.17C61.84 24.17 72.08 24.43 78.82 34.09ZM55.42 15.94C58.53 12.25 60.73 7.13 60.73 2.01C60.73 1.3 60.67 0.58 60.54 0C55.48 0.19 49.45 3.37 45.82 7.58C42.97 10.82 40.31 15.94 40.31 21.13C40.31 21.91 40.44 22.69 40.5 22.94C40.82 23 41.34 23.07 41.86 23.07C46.4 23.07 52.12 20.03 55.42 15.94Z', 'ink')
      ]
    },
    {
      /* Official Lumix mark — vector path data taken unmodified from the
         published logo file (https://commons.wikimedia.org/wiki/File:Lumix_logo.svg);
         Lumix red (#E60012) restored, geometry untouched. */
      id: 'lumix', name: 'Lumix', vb: [513.92, 100],
      brand: { light: '#E60012' },
      ops: [
        p('M294.86 99.79L325.7 53.1L325.59 62.31L325.59 99.68L344 99.68L344 24.09L325.7 24.09L285.22 84.9L245.61 24.09L227.3 24.09L227.3 99.68L245.72 99.68L245.72 62.31L245.61 53.1L276.45 99.79ZM0 0L0 94.97C0 98.29 2.25 99.89 5.14 99.89L91.76 99.89L91.76 86.51L23.98 86.51C22.16 86.51 21.41 85.33 21.41 83.08L21.41 0ZM192.08 99.89C197.11 99.89 198.39 97.97 200.96 94.75C203.53 91.54 207.28 82.66 207.28 72.48L207.28 24.3L188.87 24.3L188.87 69.16C188.87 75.37 188.87 81.58 186.51 83.94C184.15 86.3 180.73 86.83 175.05 86.83L136.94 86.83C131.16 86.83 127.84 86.4 125.48 83.94C123.13 81.58 123.13 75.37 123.13 69.16L123.13 24.3L104.71 24.3L104.71 72.48C104.71 82.66 108.57 91.54 111.03 94.75C113.6 97.97 114.78 99.89 119.91 99.89ZM387.26 99.89L368.84 99.89L368.84 24.3L387.26 24.3ZM513.92 99.68L468.63 60.6L510.81 24.3L487.47 24.3L456.85 50.54L426.45 24.2L403 24.2L445.4 60.71L400 100L423.34 100L457.07 70.77L490.69 99.89Z', 'brand')
      ]
    },
    {
      /* Official OM System mark — vector path data taken unmodified from the
         published logo file (https://nala.explore.omsystem.com/static/version1793784977/frontend/OMDigital/Hyva/en_US/images/logo.svg);
         OM System blue (#0033A0, lifted to #4B83FF on dark frames) restored, geometry untouched. */
      id: 'omsystem', name: 'OM System', vb: [868.83, 100],
      brand: { light: '#0033A0', dark: '#4B83FF' },
      ops: [
        p('M149.49 56.04L127.72 2.82L98.87 2.82L98.87 39.37C93.29 13.78 68.88 -3.22 42.91 0.51C16.94 4.24 -1.76 27.38 0.13 53.54C1.97 79.7 23.74 100 49.95 100C73.7 99.95 94.1 83.24 98.87 59.96L98.87 96.08L121.48 96.08L121.48 45.32L140.89 96.08L158.08 96.08L177.44 45.32L177.44 96.08L200.11 96.08L200.11 2.82L171.21 2.82ZM49.95 77.43C38.71 77.52 28.56 70.82 24.16 60.43C19.82 50.09 22.13 38.09 30.07 30.11C38 22.13 49.95 19.73 60.34 24.02C70.72 28.32 77.48 38.43 77.48 49.66C77.52 56.98 74.64 64.07 69.5 69.26C64.3 74.45 57.31 77.38 49.95 77.43Z', 'brand'),
        p('M306.59 41.21L330.43 41.21C330.43 38.09 330.2 34.93 329.77 31.86C329.25 27.71 327.17 23.98 323.92 21.38C319.01 18.64 313.58 16.94 307.96 16.33C299.55 15.57 291.15 15.24 282.69 15.38C274.38 15.33 266.07 15.9 257.81 17.13C252.24 18.17 247.18 21.14 243.55 25.53C240.76 29.93 239.25 35.03 239.11 40.22C238.83 45.51 239.72 50.75 241.71 55.66C243.08 58.4 245.25 60.62 247.89 62.13C252.71 64.07 257.86 64.96 263.05 64.87C269.9 65.2 277.97 65.34 284.44 65.53C291.05 65.72 299.83 66.1 303.38 66.38C304.84 66.29 306.26 66.8 307.3 67.8C308.38 68.79 308.99 70.16 308.99 71.62C309.14 74.03 307.63 76.2 305.31 76.86C298.94 77.71 292.52 78 286.09 77.81C280 77.85 273.86 77.62 267.82 77.05C264.56 76.48 262.2 73.7 262.25 70.44L238.64 70.39C238.64 73.89 238.92 77.38 239.39 80.78C240.05 84.09 241.56 87.11 243.83 89.56C245.77 91.74 248.32 93.29 251.15 94C261.87 95.61 272.68 96.32 283.5 96.13C293.46 96.32 303.38 96.03 313.29 95.23C317.49 94.66 321.56 93.15 325.1 90.89C328.07 88.48 330.39 85.36 331.9 81.87C333.17 78.14 333.74 74.22 333.55 70.25C333.55 65.1 332.27 60 329.87 55.47C328.17 52.54 325.52 50.32 322.36 49.1C317.83 47.73 313.15 46.92 308.43 46.74C304.51 46.59 291.76 46.22 285.57 46.03C280.52 45.89 269.76 45.46 267.3 44.89C266.21 44.8 265.17 44.28 264.47 43.38C263.81 42.53 263.48 41.4 263.62 40.31C263.33 38.09 264.89 36.11 267.06 35.73C272.73 34.6 278.49 34.08 284.3 34.18C290.01 34.08 295.73 34.41 301.35 35.17C303 35.5 304.46 36.39 305.55 37.67C306.16 38.76 306.54 39.98 306.59 41.21Z', 'brand'),
        p('M386.48 46.07L411.93 16L441.97 16L398.57 67.7L398.57 95.37L374.82 95.37L374.39 67.7L331 16L361.03 16Z', 'brand'),
        p('M634.01 16L634.01 36.91L599.3 36.91L599.3 95.37L575.17 95.37L575.17 36.91L540.47 36.91L540.47 16Z', 'brand'),
        p('M666.92 77.19L727.32 77.19L727.32 95.37L642.79 95.37L642.79 16L727.32 16L727.32 34.18L666.92 34.18L666.92 46.59L723.59 46.59L723.59 64.77L666.92 64.77Z', 'brand'),
        p('M804.28 95.37L795.08 95.37L765.89 42.77C765.61 42.25 765.19 41.54 764.62 41.64C763.86 41.83 763.86 42.72 763.86 43.29L763.86 95.37L739.73 95.37L739.73 16L777.42 16L804 63.97C804.1 64.11 804.19 64.16 804.28 64.16C804.43 64.11 804.52 64.11 804.57 63.97L831.15 16L868.83 16L868.83 95.37L844.7 95.37L844.7 43.29C844.7 42.68 844.7 41.83 843.95 41.64C843.38 41.54 842.96 42.25 842.67 42.77L813.49 95.37Z', 'brand'),
        p('M508.88 41.21L532.68 41.21C532.68 38.09 532.49 34.93 532.06 31.86C531.54 27.71 529.42 23.98 526.16 21.38C521.25 18.64 515.87 16.94 510.25 16.33C501.84 15.57 493.44 15.24 484.98 15.38C476.67 15.33 468.36 15.9 460.15 17.13C454.53 18.17 449.47 21.14 445.84 25.53C443.05 29.93 441.54 35.03 441.4 40.22C441.12 45.51 442.01 50.75 444 55.66C445.37 58.4 447.54 60.67 450.18 62.13C455 64.07 460.15 64.96 465.34 64.87C472.19 65.2 480.26 65.34 486.73 65.53C493.34 65.72 502.12 66.1 505.67 66.38C507.13 66.29 508.55 66.8 509.58 67.8C510.67 68.79 511.28 70.16 511.28 71.62C511.43 74.03 509.92 76.2 507.6 76.86C501.23 77.71 494.81 78 488.38 77.81C482.29 77.85 476.15 77.62 470.11 77.05C466.85 76.53 464.49 73.7 464.54 70.44L440.93 70.39C440.93 73.89 441.16 77.38 441.68 80.78C442.3 84.09 443.85 87.11 446.12 89.56C448.06 91.74 450.61 93.29 453.44 94C464.16 95.61 474.97 96.32 485.79 96.13C495.75 96.32 505.67 96.03 515.58 95.23C519.78 94.66 523.8 93.15 527.39 90.89C530.36 88.48 532.68 85.36 534.19 81.87C535.46 78.14 536.03 74.22 535.84 70.25C535.84 65.1 534.56 60 532.16 55.47C530.46 52.54 527.81 50.28 524.65 49.1C520.11 47.73 515.44 46.92 510.72 46.78C506.8 46.59 494.05 46.22 487.86 46.03C482.81 45.89 472.05 45.46 469.59 44.89C468.5 44.8 467.46 44.28 466.76 43.38C466.1 42.53 465.76 41.4 465.91 40.31C465.67 38.09 467.18 36.06 469.35 35.73C475.02 34.6 480.83 34.08 486.59 34.18C492.3 34.08 498.02 34.41 503.64 35.17C505.29 35.5 506.75 36.39 507.84 37.67C508.45 38.76 508.78 39.98 508.88 41.21Z', 'brand')
      ]
    },
    {
      /* The official HD2Lab logo — the round emblem of LOGO.png, drawn as an
         image op so the plate carries the brand's own artwork (colour, or the
         one-ink print when All Black is on). */
      id: 'hd2lab', name: 'HD2Lab', vb: [100, 100],
      ops: [
        i(0, 0, 100, 100)
      ]
    }
  ];

  var BY_ID = {};
  LIST.forEach(function (e) { BY_ID[e.id] = e; });

  /* ---- official logo image ------------------------------------------------
     The badge is raster artwork, so it is decoded once and reused: the plate
     canvas draws the Image itself, and All Black prints a grayscale copy made
     on an offscreen canvas (one ink, no brand colour left). */
  var logoImage = null;          /* HTMLImageElement once decoded */
  var logoMono = null;           /* grayscale canvas, built on demand */
  var logoListeners = [];
  var logoDone = false;

  function afterLogo(fn) {
    if (logoDone) { fn(); return; }
    logoListeners.push(fn);
  }

  function settleLogo() {
    logoDone = true;
    var pending = logoListeners;
    logoListeners = [];
    pending.forEach(function (fn) { try { fn(); } catch (e) {} });
    try {
      global.dispatchEvent(new CustomEvent('sp-emblem-logo'));
    } catch (e) {}
  }

  function monoOf(src) {
    if (logoMono) return logoMono;
    var w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
    if (!w || !h) return null;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var cx = c.getContext('2d');
    cx.drawImage(src, 0, 0, w, h);
    try {
      var data = cx.getImageData(0, 0, w, h);
      var px = data.data;
      for (var k = 0; k < px.length; k += 4) {
        /* Rec. 601 luma: one ink, the artwork's own light and shade kept */
        var v = Math.round(px[k] * 0.299 + px[k + 1] * 0.587 + px[k + 2] * 0.114);
        px[k] = px[k + 1] = px[k + 2] = v;
      }
      cx.putImageData(data, 0, 0);
    } catch (e) {}
    logoMono = c;
    return logoMono;
  }

  function logoFor(mono) {
    if (!logoImage || !logoImage.complete || !logoImage.naturalWidth) return null;
    return mono ? monoOf(logoImage) : logoImage;
  }

  if (typeof global.Image === 'function') {
    logoImage = new global.Image();
    logoImage.decoding = 'async';
    logoImage.onload = settleLogo;
    logoImage.onerror = settleLogo;
    logoImage.src = LOGO_SRC;
    if (logoImage.complete && logoImage.naturalWidth) settleLogo();
  } else {
    settleLogo();
  }

  var MAKE_MAP = [
    [/samsung|\bnx\b|nx[0-9]/i, 'samsung'],
    [/sony/i, 'sony'],
    [/canon/i, 'canon'],
    [/nikon/i, 'nikon'],
    [/fuji/i, 'fujifilm'],
    [/leica/i, 'leica'],
    [/hasselblad/i, 'hasselblad'],
    [/apple|iphone|ipad/i, 'apple'],
    [/panasonic|lumix/i, 'lumix'],
    [/om digital|olympus|om system|om-?d/i, 'omsystem'],
    [/hd2lab/i, 'hd2lab']
  ];

  function fromMake(make, model) {
    var s = String(make || '') + ' ' + String(model || '');
    for (var i = 0; i < MAKE_MAP.length; i++) {
      if (MAKE_MAP[i][0].test(s)) return MAKE_MAP[i][1];
    }
    return 'hd2lab';
  }

  /* A maker's own colour, with a night value where the official blue would
     sink into a dark plate (Samsung's #1428A0 and OM System's #0033A0 lose all
     their edge on #16150f). `colors.mono` is the All Black switch: one ink for
     the whole mark — brand colour and HD2Lab's orange accent included. */
  function brandOf(e, colors) {
    var b = (e && e.brand) || {};
    var dark = !!colors && colors.light === false;
    return (dark && b.dark) || b.light || (colors && colors.accent) || '#ff824f';
  }

  function color(v, colors, e) {
    if (!v) return 'none';
    if (colors && colors.mono) return colors.ink;      // All Black — 단색
    if (v === 'ink') return colors.ink;
    if (v === 'accent') return colors.accent;
    if (v === 'brand') return brandOf(e, colors);
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
        out.push('<path d="' + op.d + '" fill="' + color(op.fill, colors, e) + '"' +
          (op.rule && op.rule !== 'nonzero' ? ' fill-rule="' + op.rule + '"' : '') +
          (op.stroke ? ' stroke="' + color(op.stroke, colors, e) + '" stroke-width="' + op.sw + '"' : '') + '/>');
      } else if (op.t === 'c') {
        out.push('<circle cx="' + op.cx + '" cy="' + op.cy + '" r="' + op.r + '" fill="' + color(op.fill, colors, e) + '"' +
          (op.stroke ? ' stroke="' + color(op.stroke, colors, e) + '" stroke-width="' + op.sw + '"' : '') + '/>');
      } else if (op.t === 'r') {
        out.push('<rect x="' + op.x + '" y="' + op.y + '" width="' + op.w + '" height="' + op.h + '" rx="' + op.rx + '" fill="' + color(op.fill, colors, e) + '"' +
          (op.stroke ? ' stroke="' + color(op.stroke, colors, e) + '" stroke-width="' + op.sw + '"' : '') + '/>');
      } else if (op.t === 'i') {
        out.push('<image x="' + op.x + '" y="' + op.y + '" width="' + op.w + '" height="' + op.h +
          '" href="' + esc(op.src) + '"' +
          (colors && colors.mono ? ' style="filter:grayscale(1)"' : '') + '/>');
      } else if (op.t === 't') {
        var fam = op.family === 'mono' ? MONO : op.family === 'serif' ? SERIF : SANS;
        out.push('<text x="' + op.x + '" y="' + op.y + '" font-family="' + esc(fam) + '" font-size="' + op.size +
          '" font-weight="' + op.weight + '" letter-spacing="' + op.ls + '" fill="' + color(op.fill || 'ink', colors, e) +
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
    e.ops.forEach(function (op) {
      if (op.t === 'p') {
        var path = new Path2D(op.d);
        if (op.fill) { ctx.fillStyle = color(op.fill, colors, e); ctx.fill(path, op.rule || 'nonzero'); }
        if (op.stroke) {
          ctx.strokeStyle = color(op.stroke, colors, e); ctx.lineWidth = op.sw;
          /* the official mark keeps its mitred points — no rounded join */
          ctx.lineJoin = op.join || 'miter';
          ctx.lineCap = op.cap || 'butt';
          ctx.stroke(path);
        }
      } else if (op.t === 'c') {
        ctx.beginPath(); ctx.arc(op.cx, op.cy, op.r, 0, Math.PI * 2);
        if (op.fill) { ctx.fillStyle = color(op.fill, colors, e); ctx.fill(); }
        if (op.stroke) { ctx.strokeStyle = color(op.stroke, colors, e); ctx.lineWidth = op.sw; ctx.stroke(); }
      } else if (op.t === 'r') {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(op.x, op.y, op.w, op.h, op.rx);
        else ctx.rect(op.x, op.y, op.w, op.h);
        if (op.fill) { ctx.fillStyle = color(op.fill, colors, e); ctx.fill(); }
        if (op.stroke) { ctx.strokeStyle = color(op.stroke, colors, e); ctx.lineWidth = op.sw; ctx.stroke(); }
      } else if (op.t === 'i') {
        var art = logoFor(!!(colors && colors.mono));
        if (art) ctx.drawImage(art, op.x, op.y, op.w, op.h);
      } else if (op.t === 't') {
        setFont(ctx, op, 1);
        ctx.fillStyle = color(op.fill || 'ink', colors, e);
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
    list: LIST,
    LOGO_SRC: LOGO_SRC,
    afterLogo: afterLogo,
    get: function (id) { return BY_ID[id] || BY_ID.hd2lab; },
    has: function (id) { return !!BY_ID[id]; },
    fromMake: fromMake,
    svg: svg,
    draw: draw,
    widthFor: widthFor
  };
})(window);
