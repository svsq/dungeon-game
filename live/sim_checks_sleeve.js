// live/sim_checks_sleeve.js — selfCheck's part for the mage's weapon sleeve (TASKS 2204), composited on the CPU from the sprites drawHero
// lays down in the node sandbox (SIMX.heroLayers.compose) and the textures' own pixels. Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, { D, heroSt, newRun, spawn } = SIMX;
  const lab = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }, R = f(r), G = f(g), B = f(b);
    const h = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116), X = h((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), Y = h(0.2126 * R + 0.7152 * G + 0.0722 * B), Z = h((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
    return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)]; };
  // (TASKS 2204) the far arm holding the staff or the wand read as a prosthesis (author's frame 36, critics r5 item 11): beside the torso
  // only the upper arm's dark outline and shade showed (90-100 % of its px under L* 22), a 3 px seam between the torso and the arm, its
  // blue ΔE 7.6-10 under the robe's, and under it a pale grey funnel as big as the fist with no forearm. At rest (both facings, two
  // moments of the breath) and on the run, in the arch and in the world, each outfit with the staff and the wand:
  //  TONE   the robe's sleeve top (uarmR px over L* 20 above the middle of the upper arm) against the robe's blue beside the shoulder
  //         (body px with B over R by BLUE, within NEAR of the height toward the body's centre: the grey of the beard
  //         and the hair in that box is not the robe), CIELab ΔE76; only the plain robe, the other outfits
  //         put a pad or a hood of their own material over the sleeve's top
  //  DARK   the share of the sleeve shown (uarmR and cuffR px) that is ink: under L* 22 and chroma INK_C (the leather pad's own
  //         shade, L* 21-22 at chroma 25, is not)
  //  SEAM   per row from the shoulder to the elbow where the arm shows beside the torso, the dark run (L* < 20) from the torso's cloth to
  //         the arm's, world px, the mean
  //  CUFF   pale px of the forearm (L* over 45, chroma under 15: the under-sleeve) shown, against the fist's shown px
  //  FORE   the forearm's blue shown (cuffR px, b* < -5) but for the held weapon passing over it (the raised wand's butt), its length
  //         along the forearm in world px, at rest (on the run the swing takes the forearm behind the torso)
  // All are held where SHOWN world px² of the upper arm show: facing left at rest the torso hides the whole arm, the fist on its edge
  const TONE = 5, DARK = 0.4, SEAM = 1.5, CUFF = 0.3, FORE = 3, SHOWN = 2, BLUE = 30, INK_C = 20, NEAR = 0.07, DARK_L = 22, SEAM_L = 20;
  const KITS = [];
  for (const weapon of ['staff', 'wand']) for (const armor of ['robe', 'leather_armor', 'cloak']) KITS.push({ weapon, armor });
  const POSES = [['rest', 0, 10], ['rest', 0, 11.3], ['run', 150, 10], ['run', 150, 10.25]];
  function measure(spr, J, face, menu, robe) {
    const { compose } = SIMX.heroLayers, H = J.ground[1] - J.top[1], sh = J.shR, el = J.elbowR, hd = J.handR, Z = menu ? 360 / 84 : 4;
    const x0 = sh[0] - 0.24 * H, y0 = sh[1] - 0.2 * H, c = compose(spr, [x0, y0, sh[0] + 0.24 * H, hd[1] + 0.15 * H], Z);
    const nm = (i) => (c.top[i] >= 0 ? spr[c.top[i]].n : ''), q = (i) => lab(c.rgb[i * 3], c.rgb[i * 3 + 1], c.rgb[i * 3 + 2]);
    const isBody = (n) => /__body/.test(n) && !/back/.test(n), isArm = (n) => /__(uarmR|cuffR)/.test(n);
    const sx = (sh[0] - x0) * Z, sy = (sh[1] - y0) * Z, ey = (el[1] - y0) * Z, mid = (sy + ey) / 2, near = NEAR * H * Z, out = face;
    const arm = [0, 0, 0], tor = [0, 0, 0]; let na = 0, nt = 0, ua = 0, ud = 0, us = 0, cream = 0, fist = 0; const fore = [];
    const ax = [hd[0] - el[0], hd[1] - el[1]], al = Math.hypot(...ax);
    for (let y = 0; y < c.H; y++) for (let x = 0; x < c.W; x++) { const i = y * c.W + x, n = nm(i); if (!n) continue; const L = q(i);
      if (/__(uarmR|cuffR)/.test(n)) { ua++; if (L[0] < DARK_L && Math.hypot(L[1], L[2]) < INK_C) ud++; }
      if (/__uarmR/.test(n)) { us++; if (y < mid && L[0] >= SEAM_L) { na++; for (let j = 0; j < 3; j++) arm[j] += L[j]; } }
      if (isBody(n) && (x - sx) * out < 0 && Math.abs(x - sx) < near && Math.abs(y - sy) < near && L[0] >= SEAM_L && c.rgb[i * 3 + 2] > c.rgb[i * 3] + BLUE) { nt++; for (let j = 0; j < 3; j++) tor[j] += L[j]; }
      if (/__fistR/.test(n)) fist++;
      if (/__cuffR/.test(n) && L[0] > 45 && Math.hypot(L[1], L[2]) < 15) cream++; }
    const cw = compose(spr.map((p) => (/^it_/.test(p.n) ? { n: p.n, o: null } : p)), [x0, y0, sh[0] + 0.24 * H, hd[1] + 0.15 * H], Z);
    for (let y = 0; y < cw.H; y++) for (let x = 0; x < cw.W; x++) { const i = y * cw.W + x; if (cw.top[i] < 0 || !/__cuffR/.test(spr[cw.top[i]].n)) continue;
      const L = lab(cw.rgb[i * 3], cw.rgb[i * 3 + 1], cw.rgb[i * 3 + 2]);
      if (L[2] < -5 && L[0] >= SEAM_L) fore.push(((x0 + (x + 0.5) / Z - el[0]) * ax[0] + (y0 + (y + 0.5) / Z - el[1]) * ax[1]) / al); }
    let runs = 0, rows = 0;
    for (let y = Math.max(0, Math.round(sy)); y < Math.min(c.H, Math.round(ey)); y++) {
      const xs = out > 0 ? [...Array(c.W).keys()] : [...Array(c.W).keys()].reverse();
      for (let k = 1; k < xs.length; k++) { const i0 = y * c.W + xs[k - 1];
        if (!(isBody(nm(i0)) && q(i0)[0] >= SEAM_L)) continue;
        let m = k, d = 0; while (m < xs.length && nm(y * c.W + xs[m]) && q(y * c.W + xs[m])[0] < SEAM_L) { d++; m++; }
        if (d > 0 && m < xs.length && isArm(nm(y * c.W + xs[m]))) { runs += d; rows++; }
      } }
    const mean = (s, n) => s.map((v) => v / Math.max(n, 1));
    return { tone: robe && na && nt ? Math.hypot(...mean(arm, na).map((v, j) => v - mean(tor, nt)[j])) : null, dark: ua ? ud / ua : 0, shown: us / Z / Z,
      seam: rows ? runs / rows / Z : 0, cuff: fist ? cream / fist : 0, fore: fore.length ? Math.max(...fore) - Math.min(...fore) : 0 };
  }
  function heroSleeveCheck(out, report) {
    const SB = require('./sandbox.cjs'), { drawHero, L } = SB.heroBox(D, root.SIM, SB.assets()), seen = new Set();
    for (const kit of KITS) for (const menu of [1, 0]) for (const face of [1, -1]) for (const [pose, vx, GT] of POSES) {
      if (menu && pose !== 'rest') continue;
      const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls: 'mage' }); S.run = R; const it = (b) => ({ id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 2 });
      R.hero.eq.weapon = it(kit.weapon); R.hero.eq.armor = it(kit.armor); delete R.hero.eq.helm;
      const J = {}, spr = []; L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
      drawHero(Object.assign({}, R.hero, { vx: vx * face, vy: 0, gp: GT * 4, face, aim: face > 0 ? 0 : Math.PI, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT: -9, patkT: -9, castT: -9, whirlT: -9 }), 300, 300, GT, heroSt(S), menu ? { menu: 1 } : {});
      if (!J.shR || !J.elbowR) continue;
      const m = measure(spr, J, face, menu, kit.armor === 'robe'), tag = `${kit.weapon} ${kit.armor} ${pose} face ${face} ${menu ? 'arch' : 'world'} at ${GT}`;
      if (report) report.push(`${tag.padEnd(44)} tone ${m.tone === null ? '  - ' : m.tone.toFixed(1).padStart(4)}  dark ${m.dark.toFixed(2)} upper arm ${m.shown.toFixed(1)} px²  seam ${m.seam.toFixed(2)}  cuff ${m.cuff.toFixed(2)}  fore ${m.fore.toFixed(1)}`);
      const say = (k, msg) => { const key = kit.weapon + kit.armor + menu + k; if (!seen.has(key)) { seen.add(key); out.push(`hero sleeve: mage ${tag}: ${msg}`); } };
      if (m.shown < SHOWN) continue;
      if (m.tone !== null && m.tone > TONE) say('tone', `the sleeve's top is ΔE ${m.tone.toFixed(1)} off the robe beside the shoulder (${TONE})`);
      if (m.dark > DARK) say('dark', `${(m.dark * 100).toFixed(0)} % of the sleeve shown is ink (${DARK * 100} %)`);
      if (m.seam > SEAM) say('seam', `a ${m.seam.toFixed(2)} px dark seam between the torso and the arm (${SEAM})`);
      if (m.cuff > CUFF) say('cuff', `the under-sleeve shown is ${m.cuff.toFixed(2)} of the fist (${CUFF})`);
      if (pose === 'rest' && m.fore < FORE) say('fore', `${m.fore.toFixed(1)} px of the forearm's sleeve shown (${FORE})`);
    }
  }
  SIMX.heroSleeve = heroSleeveCheck;
  SIMX.checks.add('heroSleeveCheck', heroSleeveCheck);
})(typeof globalThis !== 'undefined' ? globalThis : this);
