// live/hud_kit.js — the shared parts of the «Кодекс и кожа» interface (R-41, TASKS 1300): nine-slice panels, the book, buttons with
// their states, slider, checkbox, tabs, cells, title banner and the small brass and wax pieces. Every screen of look B draws with
// these, not with its own frames. Pure: it reads the state it is handed.
(function () {
  const L = LIB, K = (window.KIT = {});
  // one art pixel of the parts is two screen px, the world's own art pixel at ×1
  const PX = (K.PX = 2);
  K.INK = { t: '#2a1a10', d: '#5a3a22', r: '#7d1e12', g: '#4d2c08', off: '#6b5f50', cream: '#f3e2bd', gold: '#ffd76a' };
  // per part: its texture, its drawn art size, and the ends (left, top, right, bottom, art px) that are not stretched
  const PART = {
    leather: { tex: 'ui_b_leather_panel', art: [96, 96], cut: [24, 24, 24, 24] },
    torn: { tex: 'ui_b_parchment_torn', art: [96, 96], cut: [24, 24, 24, 24] },
    cell: { tex: 'ui_b_cell', art: [32, 32], cut: [8, 8, 8, 8] },
    btn: { tex: 'ui_b_button_parchment', art: [100, 24], cut: [12, 0, 12, 0] },
    wax: { tex: 'ui_b_button_wax', art: [120, 30], cut: [16, 0, 16, 0] },
    tab: { tex: 'ui_b_tab', art: [120, 28], cut: [20, 0, 20, 0] },
    banner: { tex: 'ui_b_title_banner', art: [240, 40], cut: [56, 0, 56, 0] },
    bar: { tex: 'ui_b_bar_frame', art: [120, 16], cut: [12, 0, 12, 0] },
    rod: { tex: 'ui_b_scroll_rod', art: [240, 24], cut: [24, 0, 24, 0] },
    ribbon: { tex: 'ui_b_ribbon', art: [24, 120], cut: [0, 12, 0, 28] },
    gutter: { tex: 'ui_b_book_gutter', art: [40, 160], cut: [0, 16, 0, 16] },
  };
  K.PART = PART;
  const has = (n) => !!(window.ASSETS && window.ASSETS[n]);
  // the drawn size of a part's ends in screen px at scale k
  K.ends = (p, k = 1) => PART[p].cut.map((v) => v * PX * k);
  // a part stretched to w×h: the corners kept, the edges stretched one way, the middle both ways (a 3-slice is a nine-slice with
  // two zero ends)
  K.nine = (p, x, y, w, h, o = {}) => {
    const P = PART[p]; if (!has(P.tex)) return;
    const k = o.k || 1, [cl, ct, cr, cb] = P.cut, [aw, ah] = P.art;
    const T = G.tex(P.tex);
    let dl = cl * PX * k, dr = cr * PX * k, dt = ct * PX * k, db = cb * PX * k;
    if (!ct && !cb) { const s = h * T.w / T.h / aw; dl = cl * s; dr = cr * s; }
    if (!cl && !cr) { const s = w * T.h / T.w / ah; dt = ct * s; db = cb * s; }
    if (dl + dr > w) { const s = w / (dl + dr); dl *= s; dr *= s; }
    if (dt + db > h) { const s = h / (dt + db); dt *= s; db *= s; }
    const us = [0, cl / aw, 1 - cr / aw, 1], vs = [0, ct / ah, 1 - cb / ah, 1], xs = [x, x + dl, x + w - dr, x + w], ys = [y, y + dt, y + h - db, y + h];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      if (o.hollow && i === 1 && j === 1) continue;
      const sw = xs[i + 1] - xs[i], sh = ys[j + 1] - ys[j]; if (sw <= 0.01 || sh <= 0.01 || us[i + 1] <= us[i] || vs[j + 1] <= vs[j]) continue;
      L.sprite(P.tex, xs[i], ys[j], { w: sw, h: sh, src: [us[i], vs[j], us[i + 1], vs[j + 1]], u: o.u }); }
  };
  // the drawn width of a 3-slice's end at height h, where a label may not reach
  K.endW = (p, h) => { const P = PART[p]; return has(P.tex) ? P.cut[0] * h * G.tex(P.tex).w / G.tex(P.tex).h / P.art[0] : 0; };
  // a part drawn whole at its art size × k, its top-left at x, y (or centred with o.c)
  K.part = (tex, art, x, y, o = {}) => { if (!has(tex)) return [0, 0]; const k = o.k || 1, w = art[0] * PX * k, h = w * G.tex(tex).h / G.tex(tex).w;
    L.sprite(tex, o.c ? x - w / 2 : x, o.c ? y - h / 2 : y, { w, h, flip: o.flip, u: o.u }); return [w, h]; };
  // the aged parchment tiled over a rect, cut at its right and bottom edges
  K.paper = (x, y, w, h, o = {}) => { if (!has('ui_b_parchment_tile')) return; const s = 128 * PX * (o.k || 1);
    for (let ty = 0; ty < h; ty += s) for (let tx = 0; tx < w; tx += s) { const sw = Math.min(s, w - tx), sh = Math.min(s, h - ty);
      L.sprite('ui_b_parchment_tile', x + tx, y + ty, { w: sw, h: sh, src: [0, 0, sw / s, sh / s], u: o.u }); } };
  // the state a control is drawn in, from the sim: the pointer over it (hover), held down on it (press), the keyboard's focus
  K.st = (S, id, on = true) => ({ hover: on && S.hover === id, press: on && S.hover === id && !!S.pressWas, focus: on && S.focus === id, off: !on });
  const gradeOf = (st) => (st.off ? [0.15, 0.62, 0, 0.9] : st.press ? [1, 0.82, 0, 1] : st.hover || st.focus ? [1.08, 1.13, 0, 1.04] : [1, 1, 0, 1]);
  // the keyboard's focus: a thin brass frame just outside the control, its corners marked
  K.focus = (x, y, w, h, gap = 5) => { const c = [0.98, 0.78, 0.29], d = [0.24, 0.12, 0.05], X = x - gap, Y = y - gap, W2 = w + gap * 2, H2 = h + gap * 2, t = 2;
    for (const [col, o] of [[d, 2], [c, 0]]) { L.solid(X - o / 2, Y - o / 2, W2 + o, t + o, col); L.solid(X - o / 2, Y + H2 - t - o / 2, W2 + o, t + o, col); L.solid(X - o / 2, Y - o / 2, t + o, H2 + o, col); L.solid(X + W2 - t - o / 2, Y - o / 2, t + o, H2 + o, col); }
    for (const [cx, cy] of [[X, Y], [X + W2, Y], [X, Y + H2], [X + W2, Y + H2]]) { L.solid(cx - 5, cy - 5, 10, 10, d); L.solid(cx - 3, cy - 3, 6, 6, c); } };
  // ink on parchment: no outline (a dark outline under dark glyphs reads as a second, blurred line)
  K.ink = (id, s, x, y, o = {}) => L.label(id, String(s), x, y, Object.assign({ size: 26, col: K.INK.t, out: '' }, o));
  K.light = (id, s, x, y, o = {}) => L.label(id, String(s), x, y, Object.assign({ size: 26, col: K.INK.cream, out: '#2a0d08' }, o));
  // a panel: 'leather' (stitched, brass corners) or 'torn' (a loose parchment sheet, its middle filled with the tile); returns the
  // rect inside its border, which is also the box its texts are checked against
  K.panel = (id, x, y, w, h, kind = 'leather', o = {}) => {
    if (kind === 'torn') K.nine('torn', x, y, w, h, { k: o.k });
    else K.nine('leather', x, y, w, h, { k: o.k });
    const e = K.ends(kind, o.k || 1).map((v) => v * 0.55), r = { x: x + e[0], y: y + e[1], w: w - e[0] - e[2], h: h - e[1] - e[3] };
    L.uiBox(id, r.x, r.y, r.w, r.h, o.pad === undefined ? 6 : o.pad); return r;
  };
  // an open book: a leather cover, two pages of parchment with the gutter between, a brass clasp on the right edge; returns
  // the two pages' writing areas and the whole spread
  K.book = (id, x, y, w, h, o = {}) => {
    K.nine('leather', x, y, w, h);
    const m = 22, px = x + m, py = y + m, pw = w - 2 * m, ph = h - 2 * m, gw = 56;
    K.paper(px, py, pw, ph);
    L.solid(px, py + ph - 3, pw, 3, [0.36, 0.23, 0.13]); L.solid(px, py, pw, 2, [0.62, 0.48, 0.32], 0, 0, 0, 0.6);
    K.nine('gutter', x + w / 2 - gw / 2, py - 4, gw, ph + 8);
    if (o.clasp !== false) K.part('ui_b_clasp', [48, 32], x + w - 18, y + h / 2 - 32);
    const pad = o.pad || 40, L0 = { x: px + pad, y: py + pad, w: pw / 2 - gw / 2 - pad * 1.5, h: ph - pad * 2 }, R0 = { x: x + w / 2 + gw / 2 + pad / 2, y: py + pad, w: pw / 2 - gw / 2 - pad * 1.5, h: ph - pad * 2 };
    const all = { x: px + pad, y: py + pad, w: pw - pad * 2, h: ph - pad * 2 };
    L.uiBox(id, all.x, all.y, all.w, all.h, 0); return { L: L0, R: R0, all };
  };
  // a button: b = { x, y, w, h, label, on }; kind 'parch' (the plain one) or 'wax' (the one that does the thing, light letters)
  K.button = (id, b, st, kind = 'parch') => {
    const g = gradeOf(st), dy = st.press ? 2 : 0;
    K.nine(kind === 'wax' ? 'wax' : 'btn', b.x, b.y + dy, b.w, b.h, { u: { grade: g } });
    if (st.focus) K.focus(b.x, b.y, b.w, b.h);
    const size = L.sizeToFit(b.label, b.w - K.endW(kind === 'wax' ? 'wax' : 'btn', b.h) - 24, b.size || 26), col = st.off ? K.INK.off : kind === 'wax' ? (st.hover ? '#fff4d6' : K.INK.cream) : st.hover ? K.INK.r : K.INK.t;
    (kind === 'wax' ? K.light : K.ink)(id + '_l', b.label, b.x + b.w / 2, b.y + b.h / 2 + 1 + dy, { size, al: 0.5, col });
    L.uiBox(id, b.x + 6, b.y, b.w - 12, b.h, 4);
  };
  // the slider: an ink rule with ticks, a brass knob at f (0..1); o.ticks (count), o.value (text over the knob), o.ends ([left,
  // right] under the rule's ends). Its hit rect is the rule's whole length, h tall, centred on y
  K.slider = (id, x, y, w, f, st, o = {}) => {
    const ink = st.off ? [0.5, 0.44, 0.36] : [0.17, 0.10, 0.06], n = o.ticks || 0, kx = x + w * Math.max(0, Math.min(1, f));
    L.solid(x, y - 1, w, 3, ink);
    for (let i = 0; i < n; i++) { const tx = Math.round(x + w * i / (n - 1)) - 1; L.solid(tx, y - 8, 3, 17, ink); }
    if (st.focus) K.focus(x - 18, y - 22, w + 36, 44, 0);
    const kk = st.press ? 1.15 : st.hover || st.focus ? 1.1 : 1;
    K.part('ui_b_knob', [16, 16], kx, y + 1, { c: true, k: kk, u: { grade: gradeOf(Object.assign({}, st, { press: false })) } });
    if (o.value !== undefined) K.ink(id + '_v', o.value, kx, y - 40, { size: 24, al: 0.5, col: st.hover || st.focus ? K.INK.r : K.INK.t });
    if (o.ends) { K.ink(id + '_e0', o.ends[0], x, y + 42, { size: 20, al: 0.5, col: K.INK.d }); K.ink(id + '_e1', o.ends[1], x + w, y + 42, { size: 20, al: 0.5, col: K.INK.d }); }
    L.uiBox(id, x - 40, y - 60, w + 80, 120, 0);
  };
  // the checkbox: an ink square on the page, the red tick in it when on
  K.check = (id, x, y, on, st, s = 36) => {
    const ink = st.off ? [0.5, 0.44, 0.36] : st.hover || st.focus ? [0.49, 0.12, 0.07] : [0.17, 0.10, 0.06];
    L.solid(x, y, s, s, [0.80, 0.70, 0.52]); for (const [a, b, c, d] of [[0, 0, s, 3], [0, s - 3, s, 3], [0, 0, 3, s], [s - 3, 0, 3, s]]) L.solid(x + a, y + b, c, d, ink);
    if (on) K.part('ui_b_check_tick', [24, 24], x + s / 2 + 4, y + s / 2 - 6, { c: true, k: s / 36 * 1.05, u: { grade: gradeOf(st) } });
    if (st.focus) K.focus(x, y, s, s, 6);
    L.uiBox(id, x, y, s, s, 0);
  };
  // the tabs over a page: tabs = [{ id, label, x, y, w, h }]; the open one stands taller, with the wax seal on its corner
  K.tabs = (id, tabs, open, S) => { for (const b of tabs) { const st = K.st(S, b.id), up = b.id === open ? 8 : 0;
    K.nine('tab', b.x, b.y - up, b.w, b.h, { u: { grade: b.id === open ? [1, 1.06, 0, 1] : gradeOf(st).map((v, i) => (i === 1 ? v * 0.82 : v)) } });
    if (b.id === open) K.part('ui_b_wax_seal', [40, 40], b.x + 6, b.y - up + 2, { c: true, k: 0.55 });
    if (st.focus) K.focus(b.x, b.y - up, b.w, b.h);
    K.ink(id + b.id, b.label, b.x + b.w / 2, b.y - up + b.h / 2 + 2, { size: L.sizeToFit(b.label, b.w - 0.6 * K.endW('tab', b.h) - 8, 24), al: 0.5, col: b.id === open ? K.INK.r : st.hover ? K.INK.r : K.INK.d });
    L.uiBox(id + b.id, b.x + 8, b.y - up, b.w - 16, b.h, 4); } };
  // an item cell: square (the bag) or round (a skill, a trophy); o.sel (picked), o.off (locked)
  K.cell = (id, x, y, s, st, o = {}) => {
    if (o.round) L.rrect(x + s * 0.12, y + s * 0.12, s * 0.76, s * 0.76, s * 0.38, [0.11, 0.08, 0.09], [0.06, 0.045, 0.05]);
    if (o.round) K.part('ui_b_cell_round', [48, 48], x, y, { k: s / 96, u: { grade: gradeOf(st) } });
    else K.nine('cell', x, y, s, s, { u: { grade: gradeOf(st) } });
    if ((st.hover || st.press) && !st.off) L.glow(x + s / 2, y + s / 2, s * 0.62, [0.95, 0.68, 0.3], st.press ? 0.18 : 0.32, 2.2);
    if (o.sel) { const r = s * 0.17; K.part('ui_b_wax_seal', [40, 40], x + s - r * 0.6, y + r * 0.6, { c: true, k: r * 2 / 80 }); }
    if (st.focus) K.focus(x, y, s, s, 3);
    L.uiBox(id, x, y, s, s, 0);
  };
  // the title banner, centred on cx, its heading in red ink
  K.banner = (id, cx, y, w, s, o = {}) => { const h = o.h || 80; K.nine('banner', cx - w / 2, y, w, h);
    const e = K.ends('banner')[0] * h / (40 * PX), size = L.sizeToFit(s, w - 2 * e * 0.8, o.size || 36);
    K.ink(id + '_t', s, cx, y + h / 2 + 1, { size, al: 0.5, col: K.INK.r }); L.uiBox(id, cx - w / 2 + e * 0.7, y, w - e * 1.4, h, 2); };
  // a heading straight on the page, a flourish to each side of it
  K.heading = (id, s, cx, y, o = {}) => { const tw = K.ink(id, s, cx, y, { size: o.size || 48, al: 0.5, col: K.INK.r }), r = o.wing || 90;
    K.rule(cx - tw / 2 - 24 - r, y + 2, r, 0.8); K.rule(cx + tw / 2 + 24, y + 2, r, 0.8); K.rule(cx - tw / 2 * 0.8, y + (o.size || 48) * 0.75, tw * 0.8); return tw; };
  // the vine flourishes in a page's four corners
  K.corners = (P, k = 0.8) => { const s = 64 * PX * k, h = s * G.tex('ui_b_flourish').h / G.tex('ui_b_flourish').w;
    L.sprite('ui_b_flourish', P.x, P.y, { w: s, h }); L.sprite('ui_b_flourish', P.x + P.w - s, P.y, { w: s, h, flip: true });
    L.sprite('ui_b_flourish', P.x + P.w - s, P.y + P.h - h, { w: s, h, rot: Math.PI, pivot: [s / 2, h / 2] }); L.sprite('ui_b_flourish', P.x, P.y + P.h - h, { w: s, h, rot: Math.PI, pivot: [s / 2, h / 2], flip: true }); };
  // a rule across the page: an ink line with a diamond at each end
  K.rule = (x, y, w, a = 1) => { const c = [0.42, 0.27, 0.15]; L.solid(x + 8, y, w - 16, 2, c, 0, 0, 0, a); for (const dx of [0, w]) L.solid(x + dx - 4, y - 3, 8, 8, c, 0.7854, 4, 4, a); };
  // a dotted leader from a row's name to its control
  K.leader = (x0, x1, y) => { for (let x = x0; x < x1 - 4; x += 12) L.solid(Math.round(x), y, 4, 4, [0.35, 0.23, 0.14]); };
  // a bar: the brass frame over its fill (f 0..1, colours c0 → c1 along it)
  K.bar = (id, x, y, w, h, f, c0, c1 = c0) => { const ix = h * 12 / 16, iy = h * 0.3, fw = Math.max(0, Math.min(1, f)) * (w - 2 * ix);
    L.solid(x + ix, y + iy, w - 2 * ix, h - 2 * iy, [0.05, 0.03, 0.03]); if (fw > 1) { L.rrect(x + ix, y + iy, fw, h - 2 * iy, 0, c0, c1); L.solid(x + ix, y + iy, fw, (h - 2 * iy) * 0.3, [1, 1, 1], 0, 0, 0, 0.14); }
    K.nine('bar', x, y, w, h); L.uiBox(id, x, y, w, h, 0); };
  // a flask: its liquid (colour col, level f) drawn behind the glass
  K.flask = (id, x, y, h, f, col) => { const w = h * 48 / 72, k = h / (72 * PX), bx = x + w * 0.12, bw = w * 0.76, top = y + h * 0.38, bot = y + h * 0.94, lv = bot - (bot - top) * Math.max(0, Math.min(1, f));
    if (f > 0) { L.rrect(bx, lv, bw, bot - lv, Math.min(bw / 2, (bot - lv) / 2), col.map((v) => v * 1.15), col.map((v) => v * 0.55)); L.solid(bx + bw * 0.18, lv + 3, bw * 0.12, Math.max(0, bot - lv - 14), [1, 1, 1], 0, 0, 0, 0.18); }
    K.part('ui_b_flask', [48, 72], x, y, { k }); L.uiBox(id, x, y, w, h, 0); };
  K.seal = (x, y, k = 1) => K.part('ui_b_wax_seal', [40, 40], x, y, { c: true, k });
  K.ribbon = (x, y, len, k = 1) => K.nine('ribbon', x, y, 24 * PX * k, len, { k });
  K.rod = (x, y, w, k = 1) => K.nine('rod', x, y, w, 24 * PX * k, { k });
  K.knob = (x, y, k = 1) => K.part('ui_b_knob', [16, 16], x, y, { c: true, k });

  // the QA sheet (state 'uikit'): every part in every state, the longest labels the game has on its buttons
  K.sheet = () => {
    L.solid(0, 0, 1920, 1080, [0.07, 0.055, 0.07]);
    const ST = [{}, { hover: true }, { hover: true, press: true }, { focus: true }, { off: true }], st = (i) => Object.assign({ hover: false, press: false, focus: false, off: false }, ST[i]);
    const B = K.book('k_book', 40, 40, 880, 520);
    K.corners({ x: B.L.x - 30, y: B.L.y - 30, w: B.L.w + B.R.w + 140, h: B.L.h + 60 }, 0.6);
    K.heading('k_head', TXT('UI.menu.9'), B.L.x + B.L.w / 2, B.L.y + 40, { size: 40, wing: 50 });
    K.ink('k_row', TXT('UI.menu.6', { name: TXT('DIFF.normal.name') }), B.L.x, B.L.y + 150, { size: 24 }); K.leader(B.L.x + 300, B.L.x + B.L.w, B.L.y + 160);
    K.tabs('k_tab', [['a', TXT('DIFF.easy.name')], ['b', TXT('DIFF.normal.name')], ['c', TXT('DIFF.hard.name')]].map(([id, label], i) => ({ id, label, x: B.R.x - 60 + i * 150, y: B.R.y + 6, w: 160, h: 44 })), 'b', { hover: 'c', focus: '' });
    K.rule(B.R.x, B.R.y + 70, B.R.w);
    for (let i = 0; i < 3; i++) K.check('k_chk' + i, B.R.x + i * 70, B.R.y + 100, i !== 0, st([0, 1, 3][i]));
    K.check('k_chk3', B.R.x + 210, B.R.y + 100, true, st(4));
    K.slider('k_sl0', B.L.x + 40, B.L.y + 260, B.L.w - 80, 0.5, st(0), { ticks: 5, value: '×1,0', ends: ['×0,5', '×1,5'] });
    K.slider('k_sl1', B.L.x + 40, B.L.y + 380, B.L.w - 80, 0, st(3), { ticks: 5, value: '×0,5' });
    K.slider('k_sl2', B.R.x + 40, B.R.y + 260, B.R.w - 80, 1, st(1), { ticks: 5, value: '×1,5' });
    K.slider('k_sl3', B.R.x + 40, B.R.y + 380, B.R.w - 80, 0.25, st(4), { ticks: 5 });
    K.panel('k_lea', 960, 40, 420, 250, 'leather');
    K.light('k_lea_t', TXT('hud.draw.2'), 1170, 165, { size: 36, al: 0.5 });
    const P = K.panel('k_torn', 1420, 40, 460, 250, 'torn'); K.ink('k_torn_t', TXT('UI.end.4'), P.x + P.w / 2, P.y + P.h / 2, { size: 26, al: 0.5 });
    K.banner('k_ban', 1170, 320, 440, TXT('UI.menu.9'));
    K.rod(1420, 330, 460); K.ribbon(1860, 300, 200); K.seal(1440, 440, 1.2); K.knob(1520, 440, 2);
    K.part('ui_b_flourish', [64, 64], 1580, 400, { k: 1 }); K.part('ui_b_clasp', [48, 32], 1730, 410);
    K.bar('k_hp', 960, 420, 400, 40, 0.7, [0.75, 0.12, 0.08], [0.45, 0.05, 0.04]); K.bar('k_mp', 960, 474, 400, 40, 0.35, [0.18, 0.35, 0.85], [0.08, 0.15, 0.5]);
    K.flask('k_fl0', 1400, 480, 110, 0.8, [0.7, 0.08, 0.06]); K.flask('k_fl1', 1490, 480, 110, 0.3, [0.15, 0.3, 0.8]); K.flask('k_fl2', 1580, 480, 110, 0, [0.7, 0.08, 0.06]);
    const labels = [TXT('UI.classes.back'), TXT('UI.classes.go'), TXT('UI.pause.3'), TXT('UI.pause.4'), TXT('UI.end.4')];
    for (let i = 0; i < 5; i++) { K.button('k_bp' + i, { x: 40 + i * 376, y: 620, w: 356, h: 56, label: labels[i] }, st(i), 'parch'); K.button('k_bw' + i, { x: 40 + i * 376, y: 704, w: 356, h: 60, label: labels[4 - i] }, st(i), 'wax'); }
    for (let i = 0; i < 5; i++) { K.cell('k_c' + i, 60 + i * 110, 820, 88, st(i), { sel: i === 2 }); K.cell('k_r' + i, 640 + i * 120, 816, 96, st(i), { round: true, sel: i === 2 }); }
  };
})();
