// live/dungeon_rooms.js — the floor's rooms: shapes, plans, the floor type, rivers and terraces laid out.
// A stage of tryGen (ARCHITECTURE.md §4.2): it reads the floor's shared values from GF and leaves there what later stages use; null rerolls.
(function (root) {
  const DGX = root.DGX, {
    D, mul32, noise2, rectsOf } = DGX;
  DGX.rooms = (GF) => {
    const {
      AR, H, R, ST, W, boss, cave, depth, floor, lastTry, mixed, opts, plat, ri, seed, set } = GF;
    // ---- rooms ----
    // a cave's rooms stand six cells apart and more: the rock between them holds its water and its long tunnels
    // a small map (the endless descent's first floors, TASKS 349) takes smaller rooms, or eight of them never fit
    const small = !cave && W < 64;
    // a rooms floor's layout (TASKS 379, data.js ARCH: rooms, maze, hall, catacomb): its knobs on the rooms, links and contents below
    const LY = cave ? null : D.ARCH[ST.lay || 'rooms'];
    const rooms = [];
    // (a plateau boss's arena keeps AR.arenaGap round it, TASKS 422: its rim stays dark rock, never a channel the hero wades over)
    const apart = (x, y, w, h, g0 = pl ? TY.gap : cave ? [6, 6] : LY.gap) => !rooms.some((r) => { const g = pl && boss && r.id === 0 ? [Math.max(g0[0], AR.arenaGap), Math.max(g0[1], AR.arenaGap)] : g0;
      const G = r.court ? LY.court.moat + LY.court.ring + 2 : 0;
      return (G ? [[r.x - G, r.y - G, r.w + 2 * G, r.h + 2 * G]] : rectsOf(r)).some(([rx, ry, rw, rh]) => x < rx + rw + g[0] && x + w + g[0] > rx && y < ry + rh + g[1] && y + h + g[1] > ry); });
    // a room's shape (TASKS 374, data.js ROOM_SHAPES): its outer box, its core (a box inside it, x0 y0 w h from its corner) and the
    // mask of its floor; the floor past the core is laid as the room's wings, a box per row's run, runs alike stacked into one
    const shapeRoom = () => { const S = LY.shapes ? Object.fromEntries(Object.entries(LY.shapes).map(([k, p]) => [k, { p }])) : D.ROOM_SHAPES, ks = Object.keys(S).filter((k) => (!S[k].from || W >= S[k].from) && (k !== 'closet' || rooms.filter((r) => r.shape === 'closet').length < (LY.shapes ? 4 : 2))); let t = R() * ks.reduce((a, k) => a + S[k].p, 0), k = ks[0];
      for (const q of ks) { t -= S[q].p; if (t < 0) { k = q; break; } }
      const box = (w, h, kk = k) => ({ k: kk, w, h, core: [0, 0, w, h], mask: () => true });
      if (LY.big && rooms.length < LY.big[0]) return box(ri(...LY.big[1]), ri(...LY.big[2]), 'rect');
      if (k === 'rect') return LY.rect ? box(ri(...LY.rect[0]), ri(...LY.rect[1])) : box(small ? ri(6, 11) : ri(7, 14), small ? ri(5, 8) : ri(6, 10));
      if (k === 'closet') return box(ri(4, 5), ri(4, 5));
      if (k === 'gallery') return R() < 0.5 ? box(ri(14, small ? 16 : 20), ri(4, 5)) : box(ri(4, 5), ri(11, small ? 13 : 15));
      if (k === 'hall') return box(ri(16, 20), ri(12, 16));
      if (k === 'colonnade') return box(small ? ri(11, 13) : ri(12, 16), small ? ri(7, 8) : ri(8, 10));
      if (k === 'pit') return box(ri(10, 14), ri(8, 11));
      if (k === 'tier') return box(ri(14, 18), ri(12, 15));
      if (k === 'L') { const w = ri(10, 14), h = ri(9, 13);
        if (R() < 0.5) { const d = Math.min(ri(3, 5), h - 5), ww = ri(Math.ceil(w * 0.35), Math.floor(w * 0.55)), left = R() < 0.5;
          return { k, w, h, core: [0, 0, w, h - d], mask: (i, j) => j < h - d || (left ? i < ww : i >= w - ww) }; }
        const d = Math.min(ri(3, 5), w - 6), hh = ri(Math.ceil(h * 0.4), Math.floor(h * 0.6)), top = R() < 0.5, right = R() < 0.5;
        return { k, w, h, core: [right ? 0 : d, 0, w - d, h], mask: (i, j) => (right ? i < w - d : i >= d) || (top ? j < hh : j >= h - hh) }; }
      if (k === 'T' || k === 'cross') { const w = ri(11, 15), h = k === 'T' ? ri(9, 12) : ri(10, 13), hb = ri(5, 6), ws = ri(4, 6), sx = (w - ws) >> 1, up = k === 'T' && R() < 0.4;
        const by = k === 'cross' ? (h - hb) >> 1 : up ? h - hb : 0;
        return { k, w, h, core: [0, by, w, hb], mask: (i, j) => (j >= by && j < by + hb) || (i >= sx && i < sx + ws) }; }
      const w = ri(10, 14), h = w - ri(0, 2), a = Math.round(w / 2 * 0.72), b = Math.round(h / 2 * 0.72);
      return { k, w, h, core: [(w >> 1) - a, (h >> 1) - b, 2 * a, 2 * b], mask: (i, j) => ((i + 0.5 - w / 2) / (w / 2)) ** 2 + ((j + 0.5 - h / 2) / (h / 2)) ** 2 < 1.04 }; };
    const shaped = (x, y, sh) => { const [cx0, cy0, cw, ch] = sh.core, wings = [], prev = new Map();
      for (let j = 0; j < sh.h; j++) { const runs = []; for (let i = 0; i < sh.w; i++) { if (!sh.mask(i, j) || (i >= cx0 && i < cx0 + cw && j >= cy0 && j < cy0 + ch)) continue;
          if (runs.length && runs[runs.length - 1][0] + runs[runs.length - 1][1] === i) runs[runs.length - 1][1]++; else runs.push([i, 1]); }
        const next = new Map(); for (const [i, n] of runs) { const o = prev.get(i + ':' + n); if (o) { o[3]++; next.set(i + ':' + n, o); } else { const q = [x + i, y + j, n, 1]; wings.push(q); next.set(i + ':' + n, q); } }
        prev.clear(); for (const [kk, v] of next) prev.set(kk, v); }
      return { x: x + cx0, y: y + cy0, w: cw, h: ch, cx: x + cx0 + (cw >> 1), cy: y + cy0 + (ch >> 1), shape: sh.k, ...(wings.length ? { wings } : {}) }; };
    // the floor's type (TASKS 426), by the run's seed so a retry keeps it: never the last floor's (its own pick, so the
    // whole run's chain is the same however it is reached), the plain plateaus on a boss's floor, AR.first on the run's first
    // (a check may ask for a type: opts.ftype)
    let ftype2 = null;
    const ftype = !plat ? null : opts.ftype && !boss ? (ftype2 = opts.ftype2 || null, opts.ftype) : (() => { const T = AR.types, rs = (opts.runSeed ?? seed) >>> 0; let prev = null, t = 'plain', pm = false;
      for (let f = 1; f <= floor; f++) { const Q = mul32((rs ^ 0x426f) + f * 7907); Q(); const c = T.filter((x) => x !== prev && !(f > 1 && x === AR.first)); t = f === 1 && AR.first ? AR.first : c[Math.floor(Q() * c.length)]; prev = t;
        const m = AR.blend.over.includes(t) && !pm && mul32((rs ^ 0x4260) + f * 6007)() < AR.blend.p; pm = m; ftype2 = m ? AR.blend.with : null; }
      return boss ? (ftype2 = null, 'plain') : t; })();
    // the mix of two floor types (TASKS 426): a figure floor (the lake, the river, the terraces) over the chasm: the plateaus stand
    // apart over the dark with bridges between, and the figure alone keeps the lava; its sizes and walk over the chasm's, the floor's share of lava its own
    const MIX = plat && ftype2 ? AR[ftype2] : null;
    // a lake floor's lake (TASKS 427): the floor's figure, a ragged blob in the middle of the map no plateau stands on or grows into,
    // with a chain of islands across it along its longer axis, zigzagging: one big (the hoard's), then the smaller sizes in turn, in
    // a random order along the chain; the lava pours into its rock once the floor is laid (platLava). The plateaus on its shore are
    // smaller than the plain floor's and ring it
    // a floor type's own sizes and spacing over the plain floor's (data.js ARCH.plateau[type])
    const TY = Object.assign({}, AR, MIX ? Object.assign({}, MIX, { lakes: 0, gap: AR.blend.gap }) : {}, plat && ftype && AR[ftype] ? AR[ftype] : {}), shareOf = !plat ? null : MIX ? [Math.min(MIX.share[0], AR[ftype].share[0]), Math.max(MIX.share[1], AR[ftype].share[1])] : (AR[ftype] && AR[ftype].share) || AR.lava.share;
    // a cave floor of the magma caves (TASKS 431) is laid out as the water caves' are, halls in the rock and winding tunnels, its
    // water lava; pl: the plateaus' layout (everything else of the magma caves holds for both)
    const lc = plat && ftype === 'cave', pl = plat && !lc;
    const want = pl ? Math.round(W * H / AR.cells) : cave ? Math.round(W * H / 420) : Math.max(LY.min || 0, Math.round((Array.isArray(ST.rooms) ? ri(...ST.rooms) : ST.rooms || 13 + Math.min(4, depth >> 1)) * LY.room));
    const fig = ftype === 'lake' || ftype === 'river' || ftype === 'terrace' ? new Uint8Array(W * H) : null, figAt = [];
    if (ftype === 'lake') { const L = AR.lake, F = mul32(seed ^ 0x427a), fr = (a) => a[0] + F() * (a[1] - a[0]), cx = W * fr(L.at[0]), cy = H * fr(L.at[1]), rx = W * fr(L.fig[0]), ry = H * fr(L.fig[1]), nzF = noise2(F, 6);
      for (let y = 6; y < H - 4; y++) for (let x = 4; x < W - 4; x++) { const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry; if (Math.hypot(u, v) < 1 + 0.35 * (nzF(x, y) - 0.5)) fig[y * W + x] = 1; }
      figAt.push(cx, cy, rx, ry);
      const n = L.isles[0] + Math.floor(F() * (L.isles[1] - L.isles[0] + 1)), hor = L.axis === 'short' ? rx < ry : rx >= ry * 1.2, inFig = (x, y, w, h) => { for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) if (!fig[(y + j) * W + x + i]) return false; return true; };
      // (the big one takes a middle slot, where the lake is widest, and is laid first; the others' sizes alternate in a random order)
      const mid = (n - 1 + Math.floor(F() * 2)) >> 1, kinds = Array.from({ length: n }, (_, i) => (i === mid ? 0 : 1 + ((i + Math.floor(F() * 2)) % 2))), zig = F() < 0.5 ? -1 : 1;
      const order = [mid, ...Array.from({ length: n }, (_, i) => i).filter((i) => i !== mid)];
      for (let o = 0, tries = 0; o < n && tries < 400; tries++) { const i = order[o], sz = L.isle[kinds[i]], t = -0.74 + 1.48 * (i + 0.5) / n + (F() - 0.5) * 0.08, s = zig * (i % 2 ? 1 : -1) * (i === mid ? 0.1 * F() : 0.12 + 0.2 * F()), w = sz[0][0] + Math.floor(F() * (sz[0][1] - sz[0][0] + 1)), h = sz[1][0] + Math.floor(F() * (sz[1][1] - sz[1][0] + 1));
        const px = cx + (hor ? t * rx : s * rx), py = cy + (hor ? s * ry : t * ry), x = Math.round(px - w / 2), y = Math.round(py - h / 2);
        if (x < 4 || y < 6 || x + w > W - 4 || y + h > H - 4 || !inFig(x, y, w, h) || rooms.some((r) => x < r.x + r.w + 3 && x + w + 3 > r.x && y < r.y + r.h + 3 && y + h + 3 > r.y)) { if (tries % 80 === 79) o++; continue; }
        rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), type: 'combat', id: rooms.length, isle: kinds[i] ? 1 : 2 }); o++; }
      if (rooms.length < 2 && !lastTry) return null; }
    // a river floor's river (TASKS 428): a band of lava across the map from edge to edge, winding, a cell or so wider or narrower
    // as it goes, and wide round an island in its middle reach; the plateaus stand on its two banks
    const riverY = [], riverB = [];
    if (ftype === 'river') { const L = AR.river, F = mul32(seed ^ 0x428a), fr = (a) => a[0] + F() * (a[1] - a[0]), y0 = H * fr(L.at), amp = H * fr(L.amp), wv = fr(L.waves), ph = F() * 6.283, wd = fr(L.w), nzF = noise2(F, 9);
      const iw = L.isle[0][0] + Math.floor(F() * (L.isle[0][1] - L.isle[0][0] + 1)), ih = L.isle[1][0] + Math.floor(F() * (L.isle[1][1] - L.isle[1][0] + 1)), ix = Math.round(W * fr(L.isleAt));
      for (let x = 0; x < W; x++) { const yc = y0 + amp * Math.sin(6.283 * wv * x / W + ph), bump = Math.max(0, 1 - Math.abs(x + 0.5 - ix) / (iw / 2 + 5)), half = (wd + 2 * (nzF(x, 0) - 0.5)) / 2 + bump * bump * (3 - 2 * bump) * (ih / 2 + 2.5);
        riverY.push(yc); riverB.push([yc - half, yc + half]); for (let y = Math.max(6, Math.floor(yc - half)); y <= Math.min(H - 5, Math.ceil(yc + half)); y++) if (Math.abs(y + 0.5 - yc) < half) fig[y * W + x] = 1; }
      const x = ix - (iw >> 1), y = Math.round(riverY[ix] - ih / 2); figAt.push(ix, riverY[ix], W / 2, wd / 2);
      rooms.push({ x, y, w: iw, h: ih, cx: x + (iw >> 1), cy: y + (ih >> 1), type: 'combat', id: rooms.length, isle: 2 }); }
    // a terrace floor (TASKS 430): the lavafall's river down one side, and the terraces laid row by row on the other, from the top
    // (under the caches' stretches of wall) down; their joins are set with the floor's tree (below)
    const terr = ftype === 'terrace' ? { rows: [], branch: [], fx: 0, fw: 0 } : null;
    if (terr) { const L = AR.terrace, F = mul32(seed ^ 0x430a), fr = (a) => a[0] + F() * (a[1] - a[0]), fi = (a) => a[0] + Math.floor(F() * (a[1] - a[0] + 1)), left = F() < 0.5;
      const fx = Math.round(left ? W * fr(L.fallAt) : W * (1 - fr(L.fallAt))), wd = fi(L.w), ph = F() * 6.283; terr.fx = fx; terr.fw = wd; terr.left = left;
      for (let y = 3; y < H - 3; y++) { const xc = fx + 1.5 * Math.sin(y / 9 + ph) * Math.min(1, (y - 3) / 8); for (let x = Math.floor(xc - wd / 2); x < xc + wd / 2; x++) if (x > 1 && x < W - 2) fig[y * W + x] = 1; }
      figAt.push(fx, H / 2, wd / 2, H / 2);
      const x0 = left ? fx + Math.ceil(wd / 2) + 2 + L.margin + 1 : 3, x1 = left ? W - 3 : fx - Math.ceil(wd / 2) - 2 - L.margin - 1;
      // (each row comes up to the river by the fall; its end away from it stops short by a share `short` of the width, so the rows
      // stagger like switchbacks, not a stack of bars)
      for (let y = 3 + AR.cacheRows + AR.gap[1]; ; ) { const rk = mixed ? F() : 0.5, RK = rk < L.ridgeRow.p && terr.rows.length && y + L.ridgeRow.h[1] + L.step[1] + Math.max(L.rowH[1], L.broadRow.h[1]) <= H - 6 ? 'ridge' : rk > 1 - L.broadRow.p && !terr.broad ? (terr.broad = 'arena') : null, RL = RK === 'ridge' ? L.ridgeRow : RK ? L.broadRow : null;
        const h = fi(RL ? RL.h : L.rowH); if (y + h > H - 6) break; const k = fi(RL ? RL.per : L.per), gap = 3, cutW = Math.round((x1 - x0) * fr(L.short));
        const ra = left ? x0 : x0 + cutW, rb = left ? x1 - cutW : x1, span = rb - ra - gap * (k - 1);
        const cut = Array.from({ length: k }, () => 0.7 + 0.6 * F()), tot = cut.reduce((a, b) => a + b, 0), row = []; let x = ra;
        for (let i = 0; i < k; i++) { const w = i === k - 1 ? rb - x : Math.round(span * cut[i] / tot), dy = fi([-1, 1]), hh = h - (F() < 0.4 && RK !== 'ridge' ? 1 : 0);
          rooms.push(Object.assign({ x, y: y + dy, w, h: hh, cx: x + (w >> 1), cy: y + dy + (hh >> 1), type: 'combat', id: rooms.length, row: terr.rows.length }, RK ? { kind: RK } : {})); row.push(rooms.length - 1); x += w + gap; }
        terr.rows.push(row); y += h + fi(L.step); }
      const nb = fi(L.branch), bx0 = left ? 3 : fx + Math.ceil(wd / 2) + 2 + L.margin + 1, bx1 = left ? fx - Math.ceil(wd / 2) - 2 - L.margin - 1 : W - 3;
      for (let i = 0, tries = 0; i < nb && tries < 60 && bx1 - bx0 >= 7; tries++) { const w = Math.min(bx1 - bx0, fi([7, 10])), h = fi([6, 8]), x = bx0 + Math.floor(F() * (bx1 - bx0 - w + 1)), y = 12 + Math.floor(F() * (H - 16 - h));
        if (rooms.some((r) => x < r.x + r.w + 4 && x + w + 4 > r.x && y < r.y + r.h + 4 && y + h + 4 > r.y)) continue; rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), type: 'combat', id: rooms.length, branch: 1 }); terr.branch.push(rooms.length - 1); i++; } }
    // the secret caches are dug up into the top wall (TASKS 425): a block of rock standing alone in the lava was the only dark on a
    // floor this full and gave them away. A few stretches of the wall's foot are held clear of the plateaus (AR.caches: how many,
    // AR.cacheSize wide, AR.cacheRows deep from row 3), so the wall stands deep enough there for a cache behind it
    const holds = [];
    if (pl) { const Q = mul32(seed ^ 0x422c), n = AR.caches[0] + Math.floor(Q() * (AR.caches[1] - AR.caches[0] + 1)), c = AR.cacheSize;
      for (let i = 0; i < 300 && holds.length < n; i++) { const x = 4 + Math.floor(Q() * (W - c - 8)); if (!holds.some((q) => x < q.x + q.w + 6 && x + c + 6 > q.x)) holds.push({ x, y: 3, w: c, h: AR.cacheRows }); } }
    const holdHit = (x, y, w, h) => holds.some((q) => x < q.x + q.w + AR.gap[0] && x + w + AR.gap[0] > q.x && y < q.y + q.h + AR.gap[1] && y + h + AR.gap[1] > q.y);
    const figHit = (x, y, w, h) => { if (!fig) return false; const m = TY.margin; for (let j = y - m; j < y + h + m; j++) for (let i = x - m; i < x + w + m; i++) if (i >= 0 && j >= 0 && i < W && j < H && fig[j * W + i]) return true; return false; };
    // the plateaus' kinds (TASKS 432, ARCH.plateau.mix): the arenas and ridges are laid first, while the floor is open, the ledges
    // last, over the floor's count, in the gaps left (in place of plateaus, they left the floor to the lava), or in the last tries
    // where the floor's count is never reached (a lava cave's halls stand far apart); a kind that finds no place in 200 tries is let go. The later tries lay the plain sizes: a seed whose
    // kinds leave no walk long enough (an arena cuts the way short) still gets a floor
    const MX = plat && mixed && TY.mix, kq = [];
    let nLedge = 0, kt = 0, pend = null, pendT = 0;
    if (MX) { const Q = mul32(seed ^ 0x432a), qi = (a) => a[0] + Math.floor(Q() * (a[1] - a[0] + 1));
      if (MX.arena && !boss) for (let k = qi(MX.arena.n); k > 0; k--) kq.push('arena');
      if (MX.ridge) for (let k = qi(MX.ridge.n); k > 0; k--) kq.push('ridge');
      nLedge = MX.ledge ? qi(MX.ledge.n) : 0; }
    // a terrace floor's ledges (TASKS 433) stand past its rows' short ends and over the river on its narrow side, where the rows
    // leave room: dead ends off the serpentine
    if (terr && MX && MX.ledge) { const Q = mul32(seed ^ 0x433e), qi = (a) => a[0] + Math.floor(Q() * (a[1] - a[0] + 1)), K = MX.ledge;
      for (let n = qi(AR.terrace.ledges), i = 0; n > 0 && i < 400; i++) { const w = qi(K.box[0]), h = qi(K.box[1]), x = 3 + Math.floor(Q() * (W - w - 6)), y = 4 + AR.cacheRows + Math.floor(Q() * (H - h - 7 - AR.cacheRows));
        if (!apart(x, y, w, h) || figHit(x, y, w, h) || holdHit(x, y, w, h)) continue;
        rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), type: 'combat', id: rooms.length, kind: 'ledge', g: K.grow }); n--; } }
    // a catacomb (TASKS 379): its chambers all one size on a grid, a patch of it grown from one cell to the floor's count
    if (LY && LY.grid && !boss) { const [cw, chh] = LY.grid.cell, [sx, sy] = LY.grid.step, cols = Math.floor((W - 6 - cw) / sx) + 1, rows = Math.floor((H - 7 - chh) / sy) + 1;
      const ox = 3 + Math.floor((W - 6 - (cols - 1) * sx - cw) / 2), oy = 4 + Math.floor((H - 7 - (rows - 1) * sy - chh) / 2), got = new Set([ri(0, cols * rows - 1)]);
      while (got.size < Math.min(want, cols * rows)) { const c = []; for (const k of got) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = k % cols + dx, y = Math.floor(k / cols) + dy, n = y * cols + x;
          if (x >= 0 && y >= 0 && x < cols && y < rows && !got.has(n) && !c.includes(n)) c.push(n); }
        if (!c.length) break; got.add(c[Math.floor(R() * c.length)]); }
      for (const k of [...got].sort((a, b) => a - b)) { const x = ox + (k % cols) * sx, y = oy + Math.floor(k / cols) * sy; rooms.push({ x, y, w: cw, h: chh, cx: x + (cw >> 1), cy: y + (chh >> 1), type: 'combat', id: rooms.length, shape: 'rect' }); } }
    // a tomb (TASKS 378): the map cut in two again and again with a wall two cells thick at each cut, down to rooms of the layout's
    // sizes; a patch of them grown from one to the floor's count; `nb`, the rooms sharing a wall four cells long and more with it
    if (LY && LY.bsp && !boss) { const B = LY.bsp, cut = [];
      const split = (x, y, w, h) => { const cw = w >= 2 * B.min[0] + 2, chh = h >= 2 * B.min[1] + 2;
        if ((w <= B.max[0] && h <= B.max[1]) || (!cw && !chh)) { cut.push([x, y, w, h]); return; }
        if (cw && (!chh || w / h > 1.2 || (w / h > 0.8 && R() < 0.5))) { const a = ri(B.min[0], w - B.min[0] - 2); split(x, y, a, h); split(x + a + 2, y, w - a - 2, h); }
        else { const a = ri(B.min[1], h - B.min[1] - 2); split(x, y, w, a); split(x, y + a + 2, w, h - a - 2); } };
      split(3, 4, W - 6, H - 7);
      const touch = (p, q) => { const [ax, ay, aw, ah] = p, [bx, by, bw, bh] = q, ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
        return ((ax + aw + 2 === bx || bx + bw + 2 === ax) && ov(ay, ay + ah, by, by + bh) >= 4) || ((ay + ah + 2 === by || by + bh + 2 === ay) && ov(ax, ax + aw, bx, bx + bw) >= 4); };
      const got = [ri(0, cut.length - 1)];
      while (got.length < Math.min(want, cut.length)) { const c = []; for (let i = 0; i < cut.length; i++) if (!got.includes(i) && got.some((g) => touch(cut[g], cut[i]))) c.push(i); if (!c.length) break; got.push(c[Math.floor(R() * c.length)]); }
      got.sort((a, b) => a - b);
      for (const i of got) { const [x, y, w, h] = cut[i]; rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), type: 'combat', id: rooms.length, shape: 'rect' }); }
      for (const r of rooms) r.nb = rooms.filter((q) => q !== r && touch([r.x, r.y, r.w, r.h], [q.x, q.y, q.w, q.h])).map((q) => q.id); }
    // a fortress's courtyard (TASKS 380): first, in the middle of the map; the ring round it is kept clear by `apart`
    if (LY && LY.court && !boss) { const C = LY.court, w = ri(...C.w), h = ri(...C.h), x = ((W - w) >> 1) + ri(-2, 2), y = ((H - h) >> 1) + ri(-1, 1);
      rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), type: 'combat', id: 0, shape: 'rect', court: 1 }); }
    for (let i = 0; i < (terr || (LY && (LY.grid || LY.bsp) && !boss) ? 0 : 900) && rooms.length < want + nLedge; i++) {
      const big = rooms.length === 0 && boss;
      const kind = !MX || big ? null : kq.length ? kq[0] : rooms.length >= want || (i >= 600 && nLedge) ? 'ledge' : null, K = kind && MX[kind];
      if (K && kind !== 'ledge' && ++kt > 200) { kq.shift(); kt = 0; continue; }
      const sz = pl && !big && !K && (i < AR.bigTries ? TY.plat : TY.small), up = kind === 'ridge' && R() < K.tall;
      let w = big ? (plat ? AR.arena.w : 18) : K ? ri(...K.box[0]) : sz ? ri(...sz[0]) : cave ? ri(9, 15) : small ? ri(6, 11) : ri(7, 14), h = big ? (plat ? AR.arena.h : 14) : K ? ri(...K.box[1]) : sz ? ri(...sz[1]) : cave ? ri(8, 12) : small ? ri(5, 8) : ri(6, 10);
      if (up) [w, h] = [h, w];
      // (a shape drawn keeps its 40 tries at a place: drawn anew each try, the small ones that fit anywhere crowded out the big)
      const sh = !cave && !big ? (pend && pendT++ < 40 ? pend : (pendT = 0, pend = shapeRoom())) : null; if (sh) { w = sh.w; h = sh.h; }
      // a rooms floor's boss hall stands against one side of the map (TASKS 506): set anywhere, a hall of 18×14 sat in the middle of a
      // small map and one floor in five walked to it in under half the map's width and height
      const edge = big && !pl && !cave ? ri(0, 3) : -1, x = edge === 0 ? 3 : edge === 1 ? W - w - 3 : ri(3, W - w - 3), y = edge === 2 ? 4 : edge === 3 ? H - h - 3 : ri(4, H - h - 3);
      if (sh ? (x + w > W - 3 || y + h > H - 3) : (!apart(x, y, w, h) || figHit(x, y, w, h) || holdHit(x, y, w, h))) continue;
      const r = sh ? shaped(x, y, sh) : { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), type: 'combat', id: rooms.length };
      if (sh) { if (!rectsOf(r).every(([a, b, c, d]) => apart(a, b, c, d))) continue; Object.assign(r, { type: 'combat', id: rooms.length }); pend = null; }
      if (K) { r.kind = kind; r.g = K.grow && (up ? [K.grow[1], K.grow[0]] : K.grow); if (kind === kq[0]) { kq.shift(); kt = 0; } }
      rooms.push(r);
    }
    if (rooms.length < (cave ? 6 : LY.min || 8)) return null;
    // the plateaus stand close (TASKS 422): each box but a boss's arena grows a side at a time into the free rock, up to AR.grow,
    // so the floor is mostly plateau with narrow lava between, as the reference has it, not tables far apart over the dark
    if (pl && !terr) for (let more = true; more;) { more = false;
      for (const r of rooms) { if ((boss && r.id === 0) || r.isle) continue;
        for (const [dx, dy, dw, dh] of [[-1, 0, 1, 0], [0, 0, 1, 0], [0, -1, 0, 1], [0, 0, 0, 1]]) { const x = r.x + dx, y = r.y + dy, w = r.w + dw, h = r.h + dh;
          if (w > (r.g || TY.grow)[0] || h > (r.g || TY.grow)[1] || x < 3 || y < 4 || x + w > W - 3 || y + h > H - 3) continue;
          const o = rooms.indexOf(r); rooms.splice(o, 1); const ok = apart(x, y, w, h) && !figHit(x, y, w, h) && !holdHit(x, y, w, h); rooms.splice(o, 0, r);
          if (ok) { Object.assign(r, { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) }); more = true; } } } }
    const side = (r) => (!riverY.length ? 0 : r.isle ? 2 : r.cy + 0.5 < riverY[Math.min(W - 1, Math.max(0, r.cx))] ? -1 : 1);
    // a river's plateaus (TASKS 428) grow on to its bank, past AR.grow the river's way only, so their edges are its banks and no strip
    // of rock between turns to a field of lava round it
    if (riverY.length) for (let more = true; more;) { more = false;
      for (const r of rooms) { if (r.isle) continue; const dn = side(r) < 0, x = r.x, y = dn ? r.y : r.y - 1, w = r.w, h = r.h + 1;
        if (h > TY.grow[1] + 10 || y < 4 || y + h > H - 3) continue;
        const o = rooms.indexOf(r); rooms.splice(o, 1); const ok = apart(x, y, w, h) && !figHit(x, y, w, h) && !holdHit(x, y, w, h); rooms.splice(o, 0, r);
        if (ok) { Object.assign(r, { y, h, cy: y + (h >> 1) }); more = true; } } }
    const main = rooms.length;
    if (cave && !pl) for (let i = 0, n = ri(2, 3); i < 400 && rooms.length < main + n; i++) { const w = ri(5, 6), h = ri(5, 6), x = ri(3, W - w - 3), y = ri(4, H - h - 3);
      if (apart(x, y, w, h, [3, 3])) rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), type: 'combat', id: rooms.length, pocket: 1 }); }
    const keep = new Set();
    if (!cave) for (const r of rooms) for (const [bx, by, bw, bh] of rectsOf(r)) for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) set(x, y, 1);
    const edgeNz = pl ? noise2(mul32(seed ^ 0x422e), 4) : null;
    const blob = (r) => { const KB = r.kind ? MX[r.kind] : {}, EB = KB.edge || TY.edge, ph = [0, 1, 2, 3].map(() => R() * 6.283), am = [0, 1, 2, 3].map((k) => (0.04 + 0.1 * R()) / (1 + 0.5 * k) * (pl ? (boss && r.id === 0 ? AR.arena.rag : TY.rag * (KB.rag || 1)) : 1)), hw = r.w / 2, hh = r.h / 2;
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const u = (x + 0.5 - r.x - hw) / hw, v = (y + 0.5 - r.y - hh) / hh, a = Math.atan2(v, u);
        let lim = 1.1; for (let k = 0; k < 4; k++) lim -= am[k] * (1 + Math.cos((k + 2) * a + ph[k]));
        // a plateau (TASKS 422) fills its box as a rounded square, its edge pushed in and out by a noise of a few cells' grain, so
        // the close-set plateaus leave narrow channels between them, not the dark corners of ellipses, and their edges stay ragged
        const sq = pl && !r.pocket && !r.isle && !(boss && r.id === 0);
        if (sq ? Math.pow(Math.abs(u) ** AR.round + Math.abs(v) ** AR.round, 1 / AR.round) < lim + (edgeNz(x, y) - 0.5) * 2 * EB[1] / Math.min(hw, hh) + EB[0] / Math.min(hw, hh) : Math.hypot(u, v) < lim) set(x, y, 1); }
      const [x0, x1, y0, y1] = r.pocket ? [r.cx - 1, r.cx, r.cy - 1, r.cy] : r.id === 0 && boss ? [r.cx - 4, r.cx + 3, r.cy - 4, r.cy + 5] : [r.cx - 1, r.cx + 2, r.cy - 1, r.cy + 3];
      // (a ridge keeps a band three cells wide along its length: its ragged edge pinched it to a cell a big body could not pass)
      if (r.kind === 'ridge') { const long = r.w >= r.h; for (let t = long ? r.x + 1 : r.y + 1; t < (long ? r.x + r.w - 1 : r.y + r.h - 1); t++) for (let o = -1; o <= 1; o++) { const x = long ? t : r.cx + o, y = long ? r.cy + o : t; set(x, y, 1); keep.add(y * W + x); } }
      // (a narrow plateau's core stays inside its box: past it, it reached across the channel to the next)
      for (let y = r.kind ? Math.max(y0, r.y) : y0; y <= (r.kind ? Math.min(y1, r.y + r.h - 1) : y1); y++) for (let x = r.kind ? Math.max(x0, r.x) : x0; x <= (r.kind ? Math.min(x1, r.x + r.w - 1) : x1); x++) { set(x, y, 1); keep.add(y * W + x); } };
    if (cave) for (const r of rooms) blob(r);
    // a river's plateau runs its floor on to the bank along the river's bends (TASKS 428), TY.margin cells off it, between its box's
    // corners, where no other plateau's box comes near
    if (riverY.length) for (const r of rooms) { if (r.isle || r.pocket) continue; const dn = side(r) < 0;
      for (let x = r.x + 2; x < r.x + r.w - 2; x++) { const b = dn ? Math.floor(riverB[x][0]) - TY.margin : Math.ceil(riverB[x][1]) + TY.margin;
        for (let y = dn ? r.y + r.h : r.y - 1; dn ? y < b : y > b; y += dn ? 1 : -1) { if (rooms.some((q) => q !== r && x >= q.x - AR.gap[0] && x < q.x + q.w + AR.gap[0] && y >= q.y - AR.gap[1] && y < q.y + q.h + AR.gap[1]) || holdHit(x, y, 1, 1)) break; set(x, y, 1); } } }
    Object.assign(GF, {
      LY, MIX, MX, TY, apart, blob, fig, figAt, figHit, ftype, ftype2, holdHit, keep, lc, main, pl, riverB, riverY, rooms, shareOf, side,
      terr });
  };
})(typeof window !== 'undefined' ? window : globalThis);
