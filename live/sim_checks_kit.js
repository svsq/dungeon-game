// live/sim_checks_kit.js — helpers that checks of more than one domain share. Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, {
    D, enterFloor, newRun, step, toPx } = SIMX;
  // the checks that start a game from the menu for something else skip the Keeper's welcome (TASKS 1849), which holds the hero
  const noWelcome = (S) => { if (S.run && S.run.greet === 1) S.run.greet = 'done'; };
  const plainRun = (Z) => { for (let sd = 3; sd < 60; sd++) { Z.run = newRun(Z, 'magma', sd); for (let f = 2; f < D.RUNS.magma.floors; f++) { enterFloor(Z, Z.run, f); if (Z.run.map.ftype === 'plain') return Z.run; } } return Z.run; };
  // a run whose townsfolk have no quest business (no offers, the Keeper's chain in hand), for the checks of the talk and the workshops
  const noQuests = (R) => { R.offers = []; R.quests = [{ id: -1, key: 'chapter', f: 99, need: 1, n: 0, st: 'taken', from: 'keeper', rw: {} }]; };
  const swing = (S, R, q) => { const h = R.hero; h.x = q.x; h.y = q.y + 34; h.vx = h.vy = 0; h.cd.atk = 0; const A = { ...toPx(R, q.x, q.y - 30) }; step(S, Object.assign({ press: 1, keys: [] }, A)); for (let j = 0; j < 40; j++) step(S, Object.assign({ keys: [] }, A)); };
  // the state as tools/samecheck.mjs writes it, sets and typed arrays whole
  const stateJson = (v) => JSON.stringify(v, (k, x) => (x instanceof Set ? [...x] : x instanceof Map ? [...x.entries()] : ArrayBuffer.isView(x) ? [...x] : x));
  // a label's width as the page's canvas measures it: the face UI.kit.face picks, its advances read from the TTF in font_data.js (cmap
  // and hmtx), and bold's one grid pixel between letters. Kerning is left out: the pixel faces set their spacing in the advances
  const FONTS = {};
  const ttf = (name) => { if (FONTS[name]) return FONTS[name]; const src = require('fs').readFileSync(require('path').join(__dirname, 'font_data.js'), 'utf8');
    const m = new RegExp(`\\b${name}: '([A-Za-z0-9+/=]+)'`).exec(src); if (!m) throw new Error(`font_data.js has no ${name}`);
    const b = Buffer.from(m[1], 'base64'), tab = {}; for (let i = 0, n = b.readUInt16BE(4); i < n; i++) tab[b.toString('latin1', 12 + i * 16, 16 + i * 16)] = b.readUInt32BE(20 + i * 16);
    const upm = b.readUInt16BE(tab.head + 18), nh = b.readUInt16BE(tab.hhea + 34), adv = (g) => b.readUInt16BE(tab.hmtx + 4 * Math.min(g, nh - 1)), map = new Map(), c = tab.cmap;
    for (let i = 0, n = b.readUInt16BE(c + 2); i < n; i++) { const o = c + b.readUInt32BE(c + 8 + i * 8), f = b.readUInt16BE(o);
      if (f === 4) { const sx = b.readUInt16BE(o + 6) / 2, ends = o + 14, starts = ends + 2 * sx + 2, dl = starts + 2 * sx, ro = dl + 2 * sx;
        for (let k = 0; k < sx; k++) { const e = b.readUInt16BE(ends + 2 * k), st = b.readUInt16BE(starts + 2 * k), d = b.readInt16BE(dl + 2 * k), r = b.readUInt16BE(ro + 2 * k);
          for (let ch = st; ch <= e && ch !== 0xffff; ch++) { if (map.has(ch)) continue; const g = r ? b.readUInt16BE(ro + 2 * k + r + 2 * (ch - st)) : ch; map.set(ch, g && (g + d) & 0xffff); } } }
      else if (f === 12) for (let k = 0, ng = b.readUInt32BE(o + 12); k < ng; k++) { const q = o + 16 + k * 12, a = b.readUInt32BE(q), e = b.readUInt32BE(q + 4), g0 = b.readUInt32BE(q + 8);
        for (let ch = a; ch <= e; ch++) if (!map.has(ch)) map.set(ch, g0 + ch - a); } }
    return (FONTS[name] = { upm, adv: (ch) => adv(map.get(ch) || 0) }); };
  const fontW = (str, size, bold = false) => { const f = D.UI.kit.face(size, bold), T = ttf(f.name), cs = [...String(str)];
    return cs.reduce((w, ch) => w + T.adv(ch.codePointAt(0)) * f.px / T.upm, 0) + (bold ? f.unit * cs.length : 0); };
  // a label's size and text after the page's fit (lib.js L.fitText): steps down to 20, then the tail goes to «…»
  const fitW = (str, maxW, size, bold = false) => { let s = size; while (s > 20 && fontW(str, s, bold) > maxW) s -= 1; return { size: s, w: fontW(str, s, bold), cut: fontW(str, s, bold) > maxW }; };
  Object.assign(SIMX.checks.kit, { noWelcome, plainRun, noQuests, swing, stateJson, fontW, fitW });
})(typeof window !== 'undefined' ? window : globalThis);
