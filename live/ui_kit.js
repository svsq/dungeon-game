// live/ui_kit.js — the UI layout registry and the helpers every screen shares (ARCHITECTURE.md §4.7). Loaded before the ui_<screen>.js files,
// which the page and Node find like the text files (modules.js); a new screen is one new file and no common list.
(function (root) {
  const D = root.DATA || (root.DATA = {});
  const UI = D.UI || (D.UI = {});
  // a name held by two files used to be overwritten without a word; UI.domains[name] names the file's domain
  UI.domains = {};
  UI.add = (domain, table) => { for (const k of Object.keys(table)) { if (k in UI.domains) throw new Error(`ui_kit.js: UI.${k} is in ${UI.domains[k]} and in ${domain}`); UI[k] = table[k]; UI.domains[k] = domain; } };
  UI.names = () => Object.keys(UI.domains);
  // what a screen file shares as DATA.<name> (the sim, the HUD and the tools read these), with the same refusal of a repeat
  const shared = {};
  UI.share = (domain, table) => { for (const k of Object.keys(table)) { if (k in shared) throw new Error(`ui_kit.js: DATA.${k} is shared by ${shared[k]} and by ${domain}`); D[k] = table[k]; shared[k] = domain; } };
  const wrapLine = (s, n) => { const out = []; let cur = '';
    for (const w of s.split(' ')) { if (cur && cur.length + 1 + w.length > n) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
    return cur ? out.concat([cur]) : out; };
  // the sort buttons beside a grid: by type, rarity, level, stacked from (x, y)
  const SORTS = [['type', TXT('UI.sort.type')], ['rar', TXT('UI.sort.rar')], ['lvl', TXT('UI.sort.lvl')]];
  // the paper windows close by a button at the bottom's middle, as «Уйти» at the gate and altars, not by a corner cross (TASKS 1899)
  const paperClose = (P) => ({ id: 'close', label: TXT('UI.paper.close'), on: true, x: P.x + P.w / 2 - 150, y: P.y + P.h - 60, w: 300, h: 60 });
  const sortCol = (pre, x, y, w = 210, h = 46) => SORTS.map(([k, label], i) => ({ id: pre + ':' + k, k, label, on: true, x, y: y + i * (h + 12), w, h }));
  // the bag's cells (TASKS 1332): 72 px on an 80 px step, eight to a row, as on ref_ui_inv_b; `id` makes each cell's id from its
  // index, so the merchant's grid sells what the hero screen's grid wears
  const CELL = 72, STEP = 80, COLS = 8;
  const grid = (id, n, x, y, o = {}) => Array.from({ length: n }, (_, j) => Object.assign({ id: id + ':' + ((o.a || 0) + j), i: (o.a || 0) + j, x: x + (j % COLS) * STEP, y: y + Math.floor(j / COLS) * (o.dy || STEP), w: CELL, h: CELL }));
  // the bag's tabs (TASKS 1687): the bag's own 24 cells, then a tab for each pouch of 16 bought at the Altar of souls; a grid shows
  // the open tab's cells, their ids the bag's own indices
  const bagTabs = (len = D.BAG.start) => { const t = [{ a: 0, n: Math.min(len, D.BAG.start) }]; for (let a = D.BAG.start; a < len; a += D.BAG.pouch) t.push({ a, n: Math.min(D.BAG.pouch, len - a) }); return t; };
  const tabAt = (len, tab) => { const T = bagTabs(len); return T[Math.max(0, Math.min(T.length - 1, tab | 0))]; };
  const bagTabOf = (len, i) => bagTabs(len).findIndex((q) => i >= q.a && i < q.a + q.n);
  const bagGrid = (x, y, pre = 'bag', dy, len, tab) => { const T = tabAt(len, tab); return grid(pre, T.n, x, y, { a: T.a, dy }); };
  const tabRow = (x, y, len, w = 200, h = 50) => bagTabs(len).map((q, k) => ({ id: 'btab:' + k, tab: k, label: k ? TXT('hud.inv.pouch', { n: k }) : TXT('hud.inv.10'), on: true, x: x + k * (w + 8), y, w, h }));
  // the view's height range (TASKS 1861, the sim keeps the size: sim_core) and the windows' frame: they are laid out on 1920×1080, the menu's
  // sheet and the talk stand on the view's bottom edge, the rest in its middle, on the 2 px grid
  const VIEW_H = [1080, 1248], uiDy = (scr, vh) => (!scr || scr === 'play' ? 0 : scr === 'menu' || scr === 'talk' ? vh - VIEW_H[0] : Math.round((vh - VIEW_H[0]) / 4) * 2);
  // the play feed's plates, newest last: a refusal said again while its plate still shows takes that plate's place, fresh, instead of
  // stacking a copy (TASKS 1815). Kept here and not in the bus (review of PR 57): S.ev stays append-only for everyone who reads it
  const FEED_K = new Set(['pickup', 'nope', 'lvl', 'unlock', 'trade']);
  const feedOf = (ev, t, n = 5) => { const f = ev.filter((e) => FEED_K.has(e.k) && t - e.t < 3);
    return f.filter((e, i) => !(e.k === 'nope' && e.s && f.some((q, j) => j > i && q.k === 'nope' && q.s === e.s))).slice(-n); };
  const INV = { L: { x: 96, y: 84, w: 600, h: 912 }, R: { x: 720, y: 84, w: 1104, h: 912 } };
  UI.add('kit', {
    // the bottom panel's height and its gap to the view's foot: the HUD lays it out by them and the camera keeps the hero above it (TASKS 1911)
    bp: { h: 122, foot: 6 },
  });
  UI.kit = { wrapLine, SORTS, paperClose, sortCol, CELL, STEP, COLS, grid, bagTabs, tabAt, bagTabOf, bagGrid, tabRow, INV };
  UI.share('kit', { VIEW_H, uiDy, feedOf, bagTabs, bagTabOf });
})(typeof window !== 'undefined' ? window : globalThis);
