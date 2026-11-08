// live/data_core.js — the shared base: the tile, the camera's zoom steps, the seed hash, plurals, UI hit-testing.
// One of the DATA files (ARCHITECTURE.md §4.2): pure data and pure helpers, no state; data.js checks the set.
(function (root) {
  const D = root.DATA || (root.DATA = {});
  // the game's version (TASKS 1038): the main menu's corner, the desktop build and the changelog's top entry read this one
  const VERSION = '0.2.0';
  const TILE = 32;                         // world units are view px; HD-pixel art drawn at display size (styles.md §1)
  // the camera's zoom: the world fills the 1920×1080 screen from a 1920/ZOOM × 1080/ZOOM window. Only whole art-pixel steps keep
  // the pixel grid whole: 1 (one art pixel = 2 screen px, the reference's scale), 1.5 (3 px) or 2 (4 px); the player picks one in
  // the menu or the pause (S.meta.zoom), ZOOM is the default. The HUD stays in screen px
  const ZOOM = 1, ZOOMS = [1, 1.5, 2];
  const zoomName = (z) => '×' + String(z || ZOOM).replace('.', ',');

  const mix32 = (a) => { a = Math.imul(a ^ (a >>> 16), 2246822519) >>> 0; a = Math.imul(a ^ (a >>> 13), 3266489917) >>> 0; return (a ^ (a >>> 16)) >>> 0; };

  const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many);

  const hitUI = (rects, x, y) => rects.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);

  Object.assign(D, { VERSION, TILE, ZOOM, ZOOMS, zoomName, mix32, plural, hitUI });
})(typeof window !== 'undefined' ? window : globalThis);
