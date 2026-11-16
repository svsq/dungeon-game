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
  // a currency's count, wherever a screen shows one (TASKS 2084): the icon, then the number on its own parchment plate. Each screen
  // used to draw its own copy, and a fix to one never reached the others three releases running, so a screen hands in only which
  // currencies and their values; the look is this one record, and a group's plates all take its widest number's width
  const PURSE = { icons: { gold: 'it_gold', shards: 'crystal', key: 'it_key' }, plate: 'btn', ink: 't', size: 26, h: 42, icon: 32, gap: 6, padX: 22, minW: 64, inset: 12, ty: 1, step: [10, 8] };
  const purseBox = (rows, measure) => { const P = PURSE, cw = Math.ceil(Math.max(P.minW, ...rows.flat().map((q) => measure(q.s, P.size) + 2 * P.padX))), uw = P.icon + P.gap + cw, n = Math.max(...rows.map((r) => r.length));
    return { w: n * uw + (n - 1) * P.step[0], h: rows.length * P.h + (rows.length - 1) * P.step[1], cw, uw }; };
  // rows: [[{ k: 'gold', s }, ...], ...]; al places the block's x by its left (0), middle (0.5) or right (1) edge
  const purseLay = (rows, x, y, measure, al = 0) => { const P = PURSE, B = purseBox(rows, measure), x0 = Math.round(x - B.w * al);
    return rows.flatMap((row, j) => row.map((q, i) => { const ux = x0 + i * (B.uw + P.step[0]), uy = y + j * (P.h + P.step[1]), px = ux + P.icon + P.gap;
      return Object.assign({}, q, { ic: P.icons[q.k], icon: { x: ux, y: uy + (P.h - P.icon) / 2, s: P.icon }, plate: { x: px, y: uy, w: B.cw, h: P.h }, c: [px + B.cw / 2, uy + P.h / 2 + P.ty] }); })); };
  // the quest tracker stands still under the minimap (TASKS 2110: in 2100 it dodged the town's adit and jumped across the screen as the
  // camera moved); over the adit it shows only the rows that end above the adit's top, the rest go to its «и ещё N» line, one row at least.
  // Its width has a ceiling, a quarter of the view at most, and a longer line ends in «…»: one long quest name stretched it over half
  // the screen (the author's 2110, again after 1992). Hidden, it is a small chip with the count
  // one layout gives the box's height and every line's place, so the drawn rows and the «и ещё N» line can never outgrow the box. The font
  // has no step under 20 px (lib.js), so the tracker is made smaller by its spacing and its width ceiling, not by a smaller size
  const TRACKER = { rows: 4, right: 14, gap: 14, head: 30, nameDy: 11, more: 26, bot: 6, textH: 24, out: 4, clear: 12, minW: 240, maxW: 460,
    share: 0.24, chip: 32, pad: 12, box: 16, inset: 24, size: { title: 20, name: 19, line: 20, btn: 18 }, btnH: 24, btnPad: 16, btnGap: 8, headGap: 12 };
  // a row's two lines and the next row stand a text height apart, so the spacing follows textH and no line can lie on another (TASKS 2117)
  TRACKER.lineDy = TRACKER.nameDy + TRACKER.textH; TRACKER.row = 2 * TRACKER.textH;
  const trkMaxW = (W) => Math.min(TRACKER.maxW, Math.round(W * TRACKER.share));
  const trkH = (n, more) => { const T = TRACKER; return T.head + n * T.row + (more ? T.more : 0) + T.bot; };
  const trkLay = (W, mmBot, want, total, adit, hidden) => { const T = TRACKER, w = hidden ? Math.min(want, trkMaxW(W)) : Math.max(T.minW, Math.min(want, trkMaxW(W))),
    x = W - T.right - w, y = mmBot + T.gap, e = T.out + T.clear;
    if (hidden) return { x, y, w, h: T.chip, n: 0, more: 0, rows: [], titleY: y + T.chip / 2 };
    let n = Math.min(T.rows, total);
    const near = adit && x - e < adit[0] + adit[2] && x + w + e > adit[0] && y - e < adit[1] + adit[3], over = (k) => near && y + trkH(k, total > k) + e > adit[1];
    while (n > 1 && over(n)) n--;
    // even one row on the adit: the tracker folds to its chip (TASKS 2117), the HUD sizes the chip by its count
    if (n && over(n)) return { x, y, w, h: T.chip, n: 0, more: total, rows: [], titleY: y + T.chip / 2, fold: true };
    const rows = Array.from({ length: n }, (_, i) => { const top = y + T.head + i * T.row; return { nameY: top + T.nameDy, lineY: top + T.lineDy }; });
    return { x, y, w, h: trkH(n, total > n), n, more: total - n, rows, titleY: y + T.head / 2, moreY: y + T.head + n * T.row + T.more / 2,
      textX: x + T.pad + T.inset, textW: w - 2 * T.pad - T.inset }; };
  // a line too long for the tracker loses its tail to «…»; measure(s, size) is the page's font or a check's stand-in
  const trkFit = (s, maxW, size, measure) => { s = String(s); if (measure(s, size) <= maxW) return s; let lo = 0, hi = s.length;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (measure(s.slice(0, m).trimEnd() + '…', size) <= maxW) lo = m; else hi = m - 1; }
    return s.slice(0, lo).trimEnd() + '…'; };
  // a button's «+» and «−» (TASKS 2114): the font's glyph has its own height and side bearings, so a text «+» sat off the button's
  // middle; the sign is two solid bars instead. A bar's length and thickness take the parity of the centre's doubled coordinate, so the
  // bar's edges fall on whole px and its middle on the centre exactly, on odd and even buttons alike
  const SIGN = { span: 0.46, stroke: 0.1, min: 2 };
  const signLen = (raw, odd, min) => { let v = Math.max(min, Math.round(raw)); if ((v & 1) !== odd) v += raw >= v || v - 1 < min ? 1 : -1; return v; };
  const signRects = (cx, cy, size, plus = true) => { const c = [Math.round(cx * 2) / 2, Math.round(cy * 2) / 2], odd = c.map((v) => (v * 2) & 1);
    const bar = (lx, ly) => { const w = signLen(lx, odd[0], SIGN.min), h = signLen(ly, odd[1], SIGN.min); return { x: c[0] - w / 2, y: c[1] - h / 2, w, h }; };
    const a = size * SIGN.span, t = size * SIGN.stroke, r = [bar(a, t)]; if (plus) r.push(bar(t, a)); return r; };
  const SIGN_OF = { '+': true, '−': false };
  // A pixel font keeps its grid only at whole multiples of its em, so a requested size is a width target, not a pixel size:
  // two faces of one family (em 10 and 12) give the steps 20, 24, 30, 36, 40... and each size takes the step whose
  // Cyrillic line is closest in width to the Trebuchet line the layout was tuned for. No step below 20 (TASKS 1753, 1861):
  // one-pixel stems blur away when the 1920×1080 canvas is shown at 1280×720
  const FONT = { faces: [['Galmuri9', 10, 0.589], ['Galmuri11', 12, 0.614]], trebuchetW: 0.547, units: [2, 12] }, FACE = new Map();
  const face = (size, bold = false) => { const n = Math.round(size), k = bold ? 'b' + n : n; let r = FACE.get(k); if (r) return r; let best = Infinity;
    for (const [name, em, adv] of bold ? FONT.faces.slice(1) : FONT.faces) for (let unit = FONT.units[0]; unit <= FONT.units[1]; unit++) {
      const d = Math.abs(adv * em * unit - FONT.trebuchetW * n); if (d < best) { best = d; r = { name, font: `${em * unit}px ${name}`, px: em * unit, unit }; } }
    FACE.set(k, r); return r; };
  UI.add('kit', {
    // the bottom panel's height and its gap to the view's foot: the HUD lays it out by them and the camera keeps the hero above it (TASKS 1911)
    bp: { h: 122, foot: 6, purseY: 10 },
    purse: PURSE,
  });
  UI.kit = { wrapLine, SORTS, paperClose, sortCol, CELL, STEP, COLS, grid, bagTabs, tabAt, bagTabOf, bagGrid, tabRow, INV, purseBox, purseLay, TRACKER, trkMaxW, trkLay, trkFit, FONT, face, SIGN, SIGN_OF, signRects };
  UI.share('kit', { VIEW_H, uiDy, feedOf, bagTabs, bagTabOf });
})(typeof window !== 'undefined' ? window : globalThis);
