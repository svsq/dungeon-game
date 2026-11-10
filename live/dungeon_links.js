// live/dungeon_links.js — the connections: a Prim MST on centre distance plus short extra edges for loops, carved as corridors.
// A stage of tryGen (ARCHITECTURE.md §4.2): it reads the floor's shared values from GF and leaves there what later stages use; null rerolls.
(function (root) {
  const DGX = root.DGX, {
    inRm, narrowTo, straightRuns } = DGX;
  DGX.links = (GF) => {
    const {
      AR, H, LY, R, TY, W, apart, at, blob, boss, cave, cells, figAt, figHit, ftype, holdHit, keep, main, pl, ri, riverY, rooms, seed, set,
      side, terr } = GF;
    // ---- connections: Prim MST on centre distance + extra short edges for loops ----
    // (a catacomb's chambers stand evenly on their grid: a jitter per pair, so its tree is no comb of equal links taken in order)
    // (a tomb's rooms join their neighbours only, TASKS 378: any other pair is as good as never)
    const dist = LY && LY.bsp && !boss ? (a, b) => Math.hypot(a.cx - b.cx, (a.cy - b.cy) * 1.2) + (a.nb && a.nb.includes(b.id) ? 2 * (((a.id * 7919 + b.id * 104729 + seed) >>> 0) % 997) / 997 : 1e6) : LY && LY.grid ? (a, b) => Math.hypot(a.cx - b.cx, (a.cy - b.cy) * 1.2) + 2 * (((a.id * 7919 + b.id * 104729 + seed) >>> 0) % 997) / 997 : (a, b) => Math.hypot(a.cx - b.cx, (a.cy - b.cy) * 1.2);
    // the plateaus' tree (TASKS 400) holds each plateau to two ridges, three only when no other way joins the next one: a long chain
    // with a few forks, so the walk from the start to the stairs crosses most of the floor
    // a ledge (TASKS 433) is a dead end off the tree, not a link in its chain: hung off its nearest plateau below, a side way the walk
    // to the stairs never needs, with the floor's rewards at its end
    const dead = (i) => rooms[i].kind === 'ledge', top0 = Math.max(0, rooms.findIndex((r, i) => i < main && !dead(i)));
    const inT = new Set([top0, ...rooms.map((r, i) => i).filter((i) => i < main && dead(i))]), edges = [], deg = rooms.map(() => 0);
    // (a terrace floor's tree is its serpentine: each row's plateaus in a line, a row joined to the next at its one end and that to
    // the next at its other, the branches to the nearest terrace)
    if (terr) { const link = (a, b) => { edges.push([a, b, dist(rooms[a], rooms[b])]); deg[a]++; deg[b]++; };
      terr.rows.forEach((row, i) => { for (let j = 1; j < row.length; j++) link(row[j - 1], row[j]); if (i) { const end = ((i - 1) % 2 === 0) === terr.left ? (r) => r[r.length - 1] : (r) => r[0]; link(end(terr.rows[i - 1]), end(row)); } });
      for (const b of terr.branch) { let best = null; for (const row of terr.rows) for (const a of row) { const d = dist(rooms[a], rooms[b]); if (!best || d < best[1]) best = [a, d]; } if (best) link(best[0], b); }
      for (let k = 0; k < main; k++) inT.add(k); }
    // a lake floor's choice (TASKS 472): the shore's plateaus ring the lake, each joined to the next round it, and the islands chain
    // across it from the plateau past its one end to the plateau past its other, the start and the stairs; the islands are the
    // short way under fire, the ring the long way round
    let lakeEnds = null;
    if (ftype === 'lake') { const [lx, ly, lrx, lry] = figAt, hor = AR.lake.axis === 'short' ? lrx < lry : lrx >= lry * 1.2, ax = (r) => (hor ? r.cx : r.cy);
      const link = (a, b) => { edges.push([a, b, dist(rooms[a], rooms[b])]); deg[a]++; deg[b]++; inT.add(a); inT.add(b); };
      const isl = rooms.map((r, i) => i).filter((i) => i < main && rooms[i].isle).sort((a, b) => ax(rooms[a]) - ax(rooms[b]));
      const shore = rooms.map((r, i) => i).filter((i) => i < main && !rooms[i].isle && !dead(i)), ang = (i) => Math.atan2((rooms[i].cy + 0.5 - ly) / lry, (rooms[i].cx + 0.5 - lx) / lrx);
      shore.sort((a, b) => ang(a) - ang(b));
      if (isl.length && shore.length >= 4) { for (let j = 0; j < shore.length; j++) link(shore[j], shore[(j + 1) % shore.length]);
        // (the plateau past a chain's end on the lake's axis: off the axis it is as near to the other end round the shore)
        const off = (r) => (hor ? Math.abs(r.cy + 0.5 - ly) / lry : Math.abs(r.cx + 0.5 - lx) / lrx);
        // (a chain's end lands on the two best plateaus past it; the start and the stairs are the pair of them, one each end, whose
        // ways come nearest the middle of AR.lake.save)
        const past = (i, s) => shore.filter((b) => s * (ax(rooms[b]) - ax(rooms[i])) > 0).map((b) => [b, s * (ax(rooms[b]) - ax(rooms[i])) / (hor ? lrx : lry) + 2.5 * off(rooms[b])]).sort((p, q) => p[1] - q[1]).slice(0, 2).map((p) => p[0]);
        const As = past(isl[0], -1), Bs = past(isl[isl.length - 1], 1).filter((b) => !As.includes(b));
        if (As.length && Bs.length) { for (const a of As) link(a, isl[0]); for (let j = 1; j < isl.length; j++) link(isl[j - 1], isl[j]); for (const b of Bs) link(isl[isl.length - 1], b); lakeEnds = [As, Bs]; } } }
    // a river floor's choice (TASKS 473): each bank's plateaus are a chain of their own along the river, so a single way over takes
    // the hero from the one bank to the other; the tree then crosses once and the places below add the rest
    if (riverY.length) { const link = (a, b) => { edges.push([a, b, dist(rooms[a], rooms[b])]); deg[a]++; deg[b]++; inT.add(a); inT.add(b); };
      for (const sd of [-1, 1]) { const bank = rooms.map((r, i) => i).filter((i) => i < main && !dead(i) && !rooms[i].isle && side(rooms[i]) === sd).sort((a, b) => rooms[a].cx - rooms[b].cx);
        for (let j = 1; j < bank.length; j++) link(bank[j - 1], bank[j]); } }
    while (inT.size < main) { let best = null;
      for (const cap of pl ? [AR.deg, AR.deg + 1, 99] : [99]) { for (const a of inT) if (deg[a] < cap && !dead(a)) for (let b = 0; b < main; b++) if (!inT.has(b)) { const d = dist(rooms[a], rooms[b]); if (!best || d < best[2]) best = [a, b, d]; } if (best) break; }
      edges.push(best); inT.add(best[1]); deg[best[0]]++; deg[best[1]]++; }
    for (let l = 0; l < main; l++) if (dead(l)) { let best = null; for (let b = 0; b < main; b++) if (!dead(b) && !rooms[b].isle && side(rooms[b]) === side(rooms[l])) { const d = dist(rooms[b], rooms[l]); if (!best || d < best[2]) best = [b, l, d]; }
      if (best) { edges.push(best); deg[best[0]]++; deg[best[1]]++; } }
    // a river's banks (TASKS 428) are joined across it in TY.cross places, the island's ways counting, spread along it: the tree
    // crosses once or twice, the nearest pairs of plateaus on the two banks well off those places add the rest
    // (the island's two ways, one to each bank, are one place)
    if (riverY.length) { const over = (e) => side(rooms[e[0]]) !== side(rooms[e[1]]), midX = (e) => (rooms[e[0]].cx + rooms[e[1]].cx) / 2, want = ri(...TY.cross);
      const places = () => { const ss = edges.filter((e) => over(e) && (rooms[e[0]].isle || rooms[e[1]].isle)).map((e) => side(rooms[e[0]]) + side(rooms[e[1]]) - 2);
        return edges.filter((e) => over(e) && !rooms[e[0]].isle && !rooms[e[1]].isle).length + (ss.includes(-1) && ss.includes(1) ? 1 : ss.length ? 0.5 : 0); };
      const cand = []; for (let a = 0; a < main; a++) for (let b = a + 1; b < main; b++) if (side(rooms[a]) * side(rooms[b]) === -1 && !dead(a) && !dead(b)) cand.push([a, b, dist(rooms[a], rooms[b])]);
      cand.sort((p, q) => p[2] - q[2]);
      // the island is a way over: joined to both banks, its nearest plateau on the bank it lacks
      const isl = rooms.findIndex((r) => r.isle), got = edges.filter((e) => e.includes(isl)).map((e) => side(rooms[e[0] === isl ? e[1] : e[0]]));
      for (const sd of [-1, 1]) if (isl >= 0 && !got.includes(sd)) { let best = null; for (let b = 0; b < main; b++) if (side(rooms[b]) === sd && !dead(b)) { const d = dist(rooms[isl], rooms[b]); if (!best || d < best[2]) best = [isl, b, d]; }
        if (best) { edges.push(best); deg[best[0]]++; deg[best[1]]++; } }
      // (a second pass reaches farther when the first left one place: an arena on a bank, TASKS 432, leaves its pairs far apart)
      for (const lim of [48, 64]) for (const e of cand) { if (places() >= (lim > 48 ? 2 : want)) break; if (e[2] > lim || edges.filter(over).some((f) => Math.abs(midX(f) - midX(e)) < W / 6)) continue; edges.push(e); deg[e[0]]++; deg[e[1]]++; } }
    // a pocket hangs off its nearest room and leads nowhere else
    for (let p = main; p < rooms.length; p++) { let best = null; for (let b = 0; b < main; b++) if (!dead(b)) { const d = dist(rooms[p], rooms[b]); if (!best || d < best[2]) best = [b, p, d]; } edges.push(best); }
    if (!pl) for (let a = 0; a < main; a++) for (let b = a + 1; b < main; b++) { if (dead(a) || dead(b)) continue;
      if (edges.some((e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a))) continue;
      const d = dist(rooms[a], rooms[b]); if (d < (LY ? LY.loops[0] : 26) && R() < (LY ? LY.loops[1] : 0.28)) edges.push([a, b, d]); }
    // the plateaus' loops join only plateaus far apart on the tree and not too far on the map: a short loop would cut the way short
    else { const tree = edges.slice(), hopT = (a) => { const h = rooms.map(() => 99), q = [a]; h[a] = 0;
        for (let i = 0; i < q.length; i++) for (const [p, o] of tree) for (const [u, v] of [[p, o], [o, p]]) if (u === q[i] && h[v] > h[u] + 1) { h[v] = h[u] + 1; q.push(v); } return h; };
      const cand = []; if (!terr && !lakeEnds) for (let a = 0; a < main; a++) { const h = hopT(a); for (let b = a + 1; b < main; b++) { const d = dist(rooms[a], rooms[b]); if (!dead(a) && !dead(b) && h[b] >= AR.loopHops && d < 44 && side(rooms[a]) === side(rooms[b])) cand.push([a, b, d]); } }
      for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
      var loopCand = cand, loopWant = ri(...AR.loops); }
    // (a two-cell corridor runs on the line and the cell past it, as it always has; a three-cell one is centred on it)
    const carveH = (x0, x1, y, wd = 2) => { const o = wd === 3 ? -1 : 0; for (let x = Math.min(x0, x1) + o; x <= Math.max(x0, x1) + o + wd - 1 - (wd === 2 ? 1 : 0); x++) for (let j = 0; j < wd; j++) if (!at(x, y + o + j)) set(x, y + o + j, 1); };
    const carveV = (y0, y1, x, wd = 2) => { const o = wd === 3 ? -1 : 0; for (let y = Math.min(y0, y1) + o; y <= Math.max(y0, y1) + o + wd - 1 - (wd === 2 ? 1 : 0); y++) for (let i = 0; i < wd; i++) if (!at(x + o + i, y)) set(x + o + i, y, 1); };
    // a rooms floor's corridor (TASKS 376): from core to core, past 16 cells through one or two bends set two to four cells off the
    // straight line (the rooms stand close: farther out, the bends ate the rock the caches are dug into), each leg an L of straight
    // runs; a quarter of them three cells wide
    const winding = (A, B) => { const wd = R() < LY.wide ? 3 : 2, L = Math.hypot(B.cx - A.cx, B.cy - A.cy) || 1, k = L < LY.bends[0] ? 0 : L < LY.bends[1] ? 1 : 1 + (R() < 0.5 ? 1 : 0), nx = -(B.cy - A.cy) / L, ny = (B.cx - A.cx) / L, pts = [[A.cx, A.cy]];
      for (let i = 1; i <= k; i++) { const t = i / (k + 1) + (R() - 0.5) * 0.15, o = (R() < 0.5 ? -1 : 1) * (LY.off[0] + R() * (LY.off[1] - LY.off[0]));
        pts.push([Math.max(4, Math.min(W - 7, Math.round(A.cx + (B.cx - A.cx) * t + nx * o))), Math.max(5, Math.min(H - 7, Math.round(A.cy + (B.cy - A.cy) * t + ny * o)))]); }
      pts.push([B.cx, B.cy]);
      for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; if (R() < 0.5) { carveH(ax, bx, ay, wd); carveV(ay, by, bx, wd); } else { carveV(ay, by, ax, wd); carveH(ax, bx, by, wd); } } };
    // a tunnel bends off the straight line between the two cores and comes back to it, 2–4 cells wide; its middle line is kept
    // open through the smoothing so it never closes
    const tunnel = (A, B) => { const x0 = A.cx + 0.5, y0 = A.cy + 0.5, x1 = B.cx + 0.5, y1 = B.cy + 0.5, L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      const amp = Math.min(4, L / 6) * (0.4 + 0.6 * R()) * (R() < 0.5 ? -1 : 1), turns = 1 + Math.floor(R() * 2), wd = 2 + Math.floor(R() * 2), wide = R() * 6.283;
      for (let s = 0; s <= L; s += 0.5) { const t = s / L, o = amp * Math.sin(Math.PI * t * turns) * Math.sin(Math.PI * t), px = x0 + (x1 - x0) * t + nx * o, py = y0 + (y1 - y0) * t + ny * o;
        const b = wd + (Math.sin(t * 9 + wide) > 0.7 ? 1 : 0), bx = Math.round(px - b / 2), by = Math.round(py - b / 2);
        for (let j = 0; j < b; j++) for (let i = 0; i < b; i++) set(bx + i, by + j, 1); keep.add(Math.floor(py) * W + Math.floor(px)); } };
    // a plateaus' ridge runs from core to core through one to three bends set off the straight line by turns either side, a square
    // brush of 2–3 cells along it (so every cell of it lies in a 2×2 of floor and it never narrows to one); all of it is kept through
    // the smoothing. Its middle line is kept for the ledges
    const lines = [];
    const ridge = (A, B, side) => { const x0 = A.cx + 0.5, y0 = A.cy + 0.5, x1 = B.cx + 0.5, y1 = B.cy + 0.5, L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      const k = side ? 1 : 1 + (R() < 0.5 ? 1 : 0) + (L > 34 ? 1 : 0), s0 = side || (R() < 0.5 ? -1 : 1), cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v)), pts = [[x0, y0]];
      for (let i = 1; i <= k; i++) { const t = (i - 0.3 + 0.6 * R()) / (k + 1), o = s0 * (i % 2 ? 1 : -1) * (TY.ridge.bend[0] + R() * (TY.ridge.bend[1] - TY.ridge.bend[0])) * Math.min(1, L / 24);
        pts.push([cl(x0 + (x1 - x0) * t + nx * o, 5, W - 6), cl(y0 + (y1 - y0) * t + ny * o, 6, H - 6)]); }
      pts.push([x1, y1]);
      let wd = ri(...TY.ridge.w); const line = [];
      for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], l = Math.hypot(bx - ax, by - ay);
        for (let s = 0; s <= l; s += 0.5) { const px = ax + (bx - ax) * s / l, py = ay + (by - ay) * s / l;
          if (R() < 0.04) wd = wd === 2 ? 3 : 2;
          const b = wd, qx = Math.round(px - b / 2), qy = Math.round(py - b / 2); for (let j = 0; j < b; j++) for (let ii = 0; ii < b; ii++) { set(qx + ii, qy + j, 1); keep.add((qy + j) * W + qx + ii); }
          line.push([px, py]); } }
      lines.push({ a: A.id, b: B.id, line, s0 }); };
    // a ridge's length, plateau edge to plateau edge: its middle line's run off every plateau's floor, in cells
    const ridgeLen = (q) => q.line.filter(([x, y]) => !rooms.some((r) => !r.pocket && Math.hypot((x - r.cx - 0.5) / (r.w / 2), (y - r.cy - 0.5) / (r.h / 2)) < 0.9)).length / 2;
    // a fortress's ring and gates (TASKS 380): the ring a corridor round the court `moat` cells off it, the gates straight from the
    // court's middle out to it on two opposite sides; a link to the court runs to the ring's nearest cell instead
    const court = LY && LY.court ? rooms.find((r) => r.court) : null, ringC = [];
    if (court) { const C = LY.court, G = C.moat + C.ring, x0 = court.x - G, y0 = court.y - G, x1 = court.x + court.w + G - 1, y1 = court.y + court.h + G - 1;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x < x0 + C.ring || x > x1 - C.ring || y < y0 + C.ring || y > y1 - C.ring) { set(x, y, 1); ringC.push([x, y]); }
      const hor = R() < 0.5, sides = (hor ? ['l', 'r'] : ['u', 'd']).slice(0, C.gates);
      for (const sd of sides) { if (sd === 'u') carveV(court.y, y0, court.cx - 1); if (sd === 'd') carveV(court.y + court.h - 1, y1, court.cx - 1); if (sd === 'l') carveH(court.x, x0, court.cy - 1); if (sd === 'r') carveH(court.x + court.w - 1, x1, court.cy - 1); }
      court.ring = [x0, y0, x1, y1]; court.gates = sides;
      GF.moat = (x, y) => x >= x0 + C.ring && x <= x1 - C.ring && y >= y0 + C.ring && y <= y1 - C.ring && !inRm(court, x, y) && cells[y * W + x] !== 1; }
    // a tomb's way between two neighbours (TASKS 378): two cells wide straight through the wall they share, at a random place along it
    const opening = (A, B) => { const hor = A.x + A.w + 2 === B.x || B.x + B.w + 2 === A.x, L = hor ? (A.x < B.x ? A : B) : (A.y < B.y ? A : B), O = L === A ? B : A;
      const lo = hor ? Math.max(A.y, B.y) : Math.max(A.x, B.x), hi = hor ? Math.min(A.y + A.h, B.y + B.h) : Math.min(A.x + A.w, B.x + B.w), t = ri(lo + 1, Math.max(lo + 1, hi - 3)); void O;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { if (hor) set(L.x + L.w + i, t + j, 1); else set(t + j, L.y + L.h + i, 1); } };
    const toRing = (O) => { let b = null, bd = 1e9; for (const [x, y] of ringC) { const d = Math.hypot(x - O.cx, y - O.cy); if (d < bd) { bd = d; b = [x, y]; } } return { cx: b[0], cy: b[1] }; };
    for (const [a, b] of edges) { const A = rooms[a], B = rooms[b];
      if (pl) ridge(A, B);
      else if (cave) tunnel(A, B);
      else if (A.court || B.court) { const O = A.court ? B : A; winding(O, toRing(O)); }
      else if (A.nb && A.nb.includes(B.id)) opening(A, B);
      else winding(A, B); }
    // a rooms floor's dead ends (TASKS 376): a nook of 4–5 cells in the rock the corridors left whole (two cells of it all round),
    // ten cells and more from the nearest room, at the end of a way of its own from that room: a chest's place or an ambush's
    if (!cave) for (let i = 0, n = ri(...LY.nooks) + (W * H >= 3500 && LY.nooks[1] ? 1 : 0), m0 = rooms.length; i < 600 && rooms.length < m0 + n; i++) { const w = ri(4, 5), h = ri(4, 5), x = ri(4, W - w - 4), y = ri(5, H - h - 4);
      let solid = true; for (let yy = y - 2; yy < y + h + 2 && solid; yy++) for (let xx = x - 2; xx < x + w + 2; xx++) if (at(xx, yy)) { solid = false; break; }
      const cx = x + (w >> 1), cy = y + (h >> 1); let b = -1, bd = 1e9; for (let k = 0; k < main; k++) { const d = Math.hypot(rooms[k].cx - cx, (rooms[k].cy - cy) * 1.2); if (d < bd) { bd = d; b = k; } }
      if (!solid || bd < 10 || bd > 26 || !apart(x, y, w, h, [3, 3])) continue;
      const P = { x, y, w, h, cx, cy, type: 'combat', id: rooms.length, pocket: 1 }; rooms.push(P); for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, 1);
      edges.push([b, P.id, bd]); winding(rooms[b], P); }
    // a plateaus' loop is laid one at a time and kept only if the longest walk between two plateaus stays within AR.loopKeep of
    // what it was: a loop gives another way round, not a short cut past half the floor
    const longest = () => { let top = 0; for (let a = 0; a < main; a++) { const d = new Int32Array(W * H).fill(-1), q = [rooms[a].cy * W + rooms[a].cx]; d[q[0]] = 0;
      for (let i = 0; i < q.length; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (d[n] < 0 && cells[n]) { d[n] = d[q[i]] + 1; q.push(n); } }
      for (let b = a + 1; b < main; b++) top = Math.max(top, d[rooms[b].cy * W + rooms[b].cx]); } return top; };
    // a lava cave's loops (TASKS 1726): its halls hung on a tree of tunnels, and a stream over a tunnel left the walk no way round it
    // (25 floors of 30); a tunnel between two halls far apart on the tree, kept as the plateaus' are, so the streams laid next cross
    // either way
    // (kept only if no two halls' walk loses more than 1 − keep: the start and the stairs are picked after it, and the longest walk
    // alone let a loop cut a floor's walk 106 → 39)
    if (cave && !pl && ftype === 'cave' && TY.loop) { const C = TY.loop, tree = edges.slice();
      const walks = () => { const out = []; for (let a = 0; a < main; a++) { if (dead(a)) continue; const d = new Int32Array(W * H).fill(-1), q = [rooms[a].cy * W + rooms[a].cx]; d[q[0]] = 0;
        for (let i = 0; i < q.length; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (d[n] < 0 && cells[n]) { d[n] = d[q[i]] + 1; q.push(n); } }
        for (let b = a + 1; b < main; b++) if (!dead(b)) out.push(d[rooms[b].cy * W + rooms[b].cx]); } return out; };
      const base = walks(), kept = () => { const now = walks(); return now.every((v, i) => base[i] < 0 || v >= base[i] * C.keep); };
      const hopT = (a) => { const h = rooms.map(() => 99), q = [a]; h[a] = 0; for (let i = 0; i < q.length; i++) for (const [p, o] of tree) for (const [u, v] of [[p, o], [o, p]]) if (u === q[i] && h[v] > h[u] + 1) { h[v] = h[u] + 1; q.push(v); } return h; };
      const cand = []; for (let a = 0; a < main; a++) { if (dead(a)) continue; const h = hopT(a); for (let b = a + 1; b < main; b++) { const d = dist(rooms[a], rooms[b]); if (!dead(b) && h[b] >= C.hops && d < C.d) cand.push([a, b, d]); } }
      for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
      let want = ri(...C.n); for (const e of cand) { if (want <= 0) break; const c0 = cells.slice(), k0 = new Set(keep); tunnel(rooms[e[0]], rooms[e[1]]);
        if (kept()) { edges.push(e); want--; continue; } for (let k = 0; k < W * H; k++) cells[k] = c0[k]; keep.clear(); for (const k of k0) keep.add(k); } }
    if (pl) { const top = longest(); let got = 0;
      for (const e of loopCand) { if (loopWant <= 0) break; const c0 = cells.slice(), k0 = new Set(keep), n0 = lines.length; ridge(rooms[e[0]], rooms[e[1]]);
        if (longest() >= top * AR.loopKeep) { edges.push(e); loopWant--; got++; continue; }
        for (let k = 0; k < W * H; k++) cells[k] = c0[k]; keep.clear(); for (const k of k0) keep.add(k); lines.length = n0; }
      // short of loops, a ridge of the tree gets a second one bowed the other way: a fork round an island of lava or dark that meets
      // again at the next plateau (no short cut: both ways are about as long); the floor's first loop may cost the walk down to
      // AR.loopLast, so every floor has one
      const twin = terr || lakeEnds ? [] : lines.slice(0, main - 1).filter((q) => !dead(q.a) && !dead(q.b) && Math.hypot(rooms[q.a].cx - rooms[q.b].cx, rooms[q.a].cy - rooms[q.b].cy) >= 22 && side(rooms[q.a]) === side(rooms[q.b]));
      for (let i = twin.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [twin[i], twin[j]] = [twin[j], twin[i]]; }
      for (const q of twin) { if (loopWant <= 0) break; const c0 = cells.slice(), k0 = new Set(keep), n0 = lines.length; ridge(rooms[q.a], rooms[q.b], -q.s0);
        if (longest() >= top * (got ? AR.loopKeep : AR.loopLast)) { loopWant--; got++; continue; }
        for (let k = 0; k < W * H; k++) cells[k] = c0[k]; keep.clear(); for (const k of k0) keep.add(k); lines.length = n0; } }
    // a ledge: a spur two cells wide off the middle of a ridge, out to a small pad over the lava or the chasm, a dead end for a chest,
    // an ambush or a cache (a pocket, as in the cave)
    if (pl) { const isFloor = (x, y) => at(x, y) !== 0;
      const pool = lines.filter((q) => q.line.length >= 40); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      for (let n = ri(...AR.ledges), i = 0; n > 0 && i < pool.length * 3; i++) { const q = pool[i % pool.length], m = q.line.length, at0 = Math.floor(m * (0.3 + 0.4 * R())), [px, py] = q.line[at0];
        const [qx, qy] = q.line[Math.min(m - 1, at0 + 4)], [ox, oy] = q.line[Math.max(0, at0 - 4)], tl = Math.hypot(qx - ox, qy - oy) || 1, sd = R() < 0.5 ? -1 : 1, nx = -(qy - oy) / tl * sd, ny = (qx - ox) / tl * sd;
        const d = 6 + 2 * R(), w = ri(5, 6), h = ri(5, 6), cx = Math.round(px + nx * d), cy = Math.round(py + ny * d), x = cx - (w >> 1), y = cy - (h >> 1);
        if (x < 3 || y < 4 || x + w > W - 3 || y + h > H - 3 || !apart(x, y, w, h, [3, 3]) || figHit(x, y, w, h) || holdHit(x, y, w, h)) continue;
        let clear = true; for (let yy = y - 1; yy < y + h + 1 && clear; yy++) for (let xx = x - 1; xx < x + w + 1; xx++) if (isFloor(xx, yy)) { clear = false; break; }
        if (!clear) continue;
        const r = { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), type: 'combat', id: rooms.length, pocket: 1 }; rooms.push(r); blob(r);
        for (let s = 0; s <= d; s += 0.5) { const sx = Math.round(px + nx * s - 1), sy = Math.round(py + ny * s - 1); for (let j = 0; j < 2; j++) for (let ii = 0; ii < 2; ii++) { set(sx + ii, sy + j, 1); keep.add((sy + j) * W + sx + ii); } }
        const near = Math.hypot(rooms[q.a].cx - px, rooms[q.a].cy - py) < Math.hypot(rooms[q.b].cx - px, rooms[q.b].cy - py) ? q.a : q.b; edges.push([near, r.id, dist(rooms[near], r)]); n--; } }
    // the cave's walls are smoothed (spurs into rock filled, lone rock knobs in the floor dug out), and floor the smoothing cut off
    // from the rooms goes back to rock
    const reach = () => { const seen = new Uint8Array(W * H), st = [rooms[0].cy * W + rooms[0].cx]; seen[st[0]] = 1;
      while (st.length) { const k = st.pop(); for (const d of [1, -1, W, -W]) { const n = k + d; if (cells[n] && !seen[n]) { seen[n] = 1; st.push(n); } } } return seen; };
    if (cave) { for (let pass = 0; pass < 2; pass++) { const nb = cells.slice();
        for (let y = 3; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { let n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if ((i || j) && !at(x + i, y + j)) n++;
          const k = y * W + x; if (cells[k] && n >= 6 && !keep.has(k)) nb[k] = 0; else if (!cells[k] && n <= 2) nb[k] = 1; }
        for (let k = 0; k < W * H; k++) cells[k] = nb[k]; }
      const seen = reach(); for (let k = 0; k < W * H; k++) if (cells[k] && !seen[k]) cells[k] = 0; }
    // two floors meeting only at a cell's corner (a 2×2 of floor and rock on the diagonals) can't be walked but let blows and bolts
    // through the corner: open the square into a two-cell way, like the corridors (TASKS 174)
    // rock one cell thick between floor above and below has room for a wall face but not its top, so it hangs in the floor as a
    // strip of masonry: it is dug out and the two floors merge (TASKS 178); a two-cell wall keeps its top and face
    const tidy = () => { for (let pass = 0, n = 1; n && pass < 6; pass++) { n = 0;
      for (let y = 2; y < H - 3; y++) for (let x = 1; x < W - 3; x++) { const a = !at(x, y), b = !at(x + 1, y), c = !at(x, y + 1), d = !at(x + 1, y + 1);
        if (a === d && b === c && a !== b) { n++; set(x, y, 1); set(x + 1, y, 1); set(x, y + 1, 1); set(x + 1, y + 1, 1); } }
      for (let y = 3; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (!at(x, y) && at(x, y - 1) && at(x, y + 1)) { n++; set(x, y, 1); } } };
    tidy();
    // a straight stretch of cave wall over four cells is broken in its middle, by a niche dug into the rock or a knob of rock left
    // in the floor (only where two cells of floor stay open past it; never in a plateaus' ridge, where two knobs a cell apart on its
    // two edges pinched it to one)
    const breakRuns = (skip) => { for (let pass = 0; pass < 8; pass++) { const runs = straightRuns(cells, W, H, skip); if (!runs.length) break;
      for (const { x, y, dx, dy, nx, ny, n } of runs) { const mx = x + dx * (n >> 1), my = y + dy * (n >> 1);
        // (a plateau's top edge takes a knob, not a niche: the rock above stays whole for the merchant's back wall, TASKS 422)
        if ((R() < 0.5 || (pl && ny < 0)) && at(mx - nx, my - ny) && at(mx - 2 * nx, my - 2 * ny) && !(pl && keep.has(my * W + mx))) set(mx, my, 0); else set(mx + nx, my + ny, 1); }
      tidy(); const seen = reach(); for (let k = 0; k < W * H; k++) if (cells[k] && !seen[k]) cells[k] = 0; } };
    if (cave) breakRuns(() => false);
    if (pl && narrowTo(cells, W, H, rooms[0].cy * W + rooms[0].cx, rooms.map((r) => r.cy * W + r.cx)).length) return null;
    const adj = rooms.map(() => []); for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
    Object.assign(GF, {
      adj, breakRuns, court, dist, edges, lakeEnds, lines, ridgeLen, tidy });
  };
})(typeof window !== 'undefined' ? window : globalThis);
