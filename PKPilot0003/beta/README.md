# Shutterplate BETA · `PKPilot0003/beta/`

The beta build of **HD2Lab Shutterplate**. It is a self-contained static app —
its own `index.html`, `style.css`, `app.js`, `js/`, samples, icons and manifest —
so it runs from its own URL (`/PKPilot0003/beta/`) and shares nothing at runtime
with the production build in `/PKPilot0003/`.

> Production is unchanged: eight frames, no beta header, no multi-cut code.

## What the beta adds

**Eleven single-cut signatures, then two multi-cut plates** — the frame library
keeps that order everywhere (landing grid, studio strip, theme window):

| # | id | name | kind |
|---|----|------|------|
| 01 | `horizon` | Clean Horizon | single |
| 02 | `gallery` | Classic Gallery | single |
| 03 | `dual` | Dual Deck | single |
| 04 | `strap` | Strap Bar | single |
| 05 | `film` | Film Sprocket | single |
| 06 | `studio` | Studio Dark | single |
| 07 | `edge` | Minimal Edge | single |
| 08 | `pro` | Pro Studio | single |
| 09 | `polaroid` | Instant Polaroid | single |
| 10 | `frosted` | Frosted Glass | single |
| 11 | `editorial` | Editorial Cover | single |
| 12 | `contact` | Contact Sheet | multi (4-up, 3:2 cells) |
| 13 | `fyra04` | FYRA 04 | multi (1×4 / 2×2, six themes) |

### Multi-cut slots

`state.slots` holds up to four photographs (`SLOT_COUNT = 4`). Each slot keeps
the file it came from, its own bitmap, EXIF and label; **slot 0 is mirrored into
`state.photo`**, so the EXIF sheet, the single-cut frames and the export need no
second implementation.

- `loadSlots(fileList)` — open up to four photos at once (`사진 4장` in the floating 4-cut control)
- `setSlotFile(index, file)` — replace one cell (tap a cell)
- `swapSlots(a, b)` — exchange two cells (`⇄` on a cell swaps with the next one)
- `seedSlots()` — fill empty cells from the photo already on the plate, so opening
  one photo and picking FYRA 04 never leaves three empty boxes
- `loadSampleSlots()` — the three bundled samples fill the four cells for testing

### The floating 4-cut control

The four cells are a control on the plate, not a bar beside it. While a
multi-cut frame is selected a compact `▦ 4` button sits in the stage's
bottom-right corner (`bottom: 12px; right: 12px;`); one tap opens the
**4-cut slot panel** just above it (`bottom: 66px; right: 12px;`, a full-width
sheet above the button under 640px) with the `#1~#4` cells, their `⇄` swap
buttons, `샘플` and `사진 4장`. A tap outside, a second tap on the button, or
`Escape` folds it away. The permanent slot bar is gone, so the stage keeps its
height on a phone.

On a multi-cut plate the single-photo `.session` strip under the stage is hidden
entirely — the four cells already say which photographs are on the plate — and
it comes back the moment a single-cut frame is selected.

### Badges on a frame tile

The `NORDIC 4-CUT` tag keeps the thumbnail's top-right corner; the FYRA 04
re-click hint (`다시 눌러 테마` in the strip, `6 THEMES` on the landing) sits in
its bottom-left corner. The two can never overlap, however narrow the tile.

### FYRA 04 and its six themes

The first tap on the FYRA 04 tile selects and renders it. **The second tap opens
the theme window** (`#fyraModal`, six cards, each painting its own live preview).
Picking a theme applies it at once and closes the window; `Escape` closes it and
returns focus to the tile. The tile carries a `다시 눌러 테마` hint.

| id | theme | layout |
|----|-------|--------|
| `classic` | Classic Strip | 1×4 ivory strip + FYRA 04 / date / emblem |
| `nordic` | Nordic Grid | 2×2 off-white gallery grid + editorial margin |
| `dark` | Dark Studio | 1×4 matte dark strip + orange accent / EXIF summary |
| `film` | Film Strip | 1×4 perforations + #01~#04 frame numbers |
| `editorial` | Editorial Grid | 2×2 serif masthead + magazine grid |
| `minimal` | Minimal Twin | 2×2 hairlines + one-line emblem & date |

### Resolution

Single-cut plates export at the photo's own 1:1 pixels (with the
`4096 → 3072 → 2048px` device fallback and the KakaoTalk in-app workaround).
Multi-cut plates are drawn in design units where a cell's long side is 400 and
scaled once, so each cell prints at the sharpest slot's own resolution while the
whole plate stays under 7200px on its long edge.

## Tests

```bash
python3 tests/run_tests.py        # -v for every check, -s to fail on skips
```

248 checks across the static and Chromium layers, including the floating 4-cut
control (button placement, panel open/close, cells still loading/replacing/
swapping from the panel), the hidden single-photo strip on multi-cut plates, zero
badge overlap on FYRA 04 in both the strip and the landing grid, and the mobile
header's right-aligned actions at 390 / 320px. Browser checks skip when
Playwright is missing.
