// live/data_core.js — the shared base: the tile, the camera's zoom steps, the seed hash, UI hit-testing.
// One of the DATA files (ARCHITECTURE.md §4.2): pure data and pure helpers, no state; data.js checks the set.
(function (root) {
  const D = root.DATA || (root.DATA = {});
  // the game's version (TASKS 1038): the main menu's corner, the desktop build and the changelog's top entry read this one
  const VERSION = '0.5.1';
  const TILE = 32;                         // world units are view px; HD-pixel art drawn at display size (styles.md §1)
  // the camera's zoom: the world fills the 1920×1080 screen from a 1920/ZOOM × 1080/ZOOM window. The player sets it on the
  // settings screen's slider (S.meta.zoom, TASKS 1302), ZOOM is the default. ×0,5, ×1 and ×1,5 keep the art pixel whole (1, 2 or
  // 3 screen px); the quarter steps between them were asked for and cost an uneven pixel, which only the world shows. The HUD
  // stays in screen px
  const ZOOM = 1, ZOOMS = [0.5, 0.75, 1, 1.25, 1.5];
  // a saved zoom off the slider's steps (the old ×2) takes the nearest one
  const zoomFix = (z) => ZOOMS.reduce((a, b) => (Math.abs(b - (z || ZOOM)) < Math.abs(a - (z || ZOOM)) ? b : a), ZOOM);
  const zoomName = (z) => '×' + TXT.num(z || ZOOM, (z || ZOOM) * 4 % 2 ? 2 : 1, true);

  const mulOut = (s) => { let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const mul32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; return mulOut(a); };
  // a Fisher–Yates shuffle in place, one draw of rng per step from the end: the order of the draws is part of every seed's floor
  const shuffleBy = (a, rng) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const mix32 = (a) => { a = Math.imul(a ^ (a >>> 16), 2246822519) >>> 0; a = Math.imul(a ^ (a >>> 13), 3266489917) >>> 0; return (a ^ (a >>> 16)) >>> 0; };


  const hitUI = (rects, x, y) => rects.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);

  Object.assign(D, { VERSION, TILE, ZOOM, ZOOMS, zoomFix, zoomName, mix32, mulOut, mul32, shuffleBy, hitUI });
})(typeof window !== 'undefined' ? window : globalThis);
