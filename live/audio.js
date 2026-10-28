// live/audio.js: sound synthesised in WebAudio, driven by the sim event bus (S.ev). No sound files: every effect is built from
// oscillators and filtered noise, panned and attenuated by where it happens on screen, through one shared dungeon reverb.
// The ambience is a per-biome bed (a low drone, air, drips / embers / shimmer) and a heartbeat on low health.
// AUDIO.update(S) runs once a frame from the live loop; M mutes (remembered). Sound starts on the first key or click,
// as browsers require, and stays silent in the attract demo.
(function () {
  const W = 1920, H = 1080;
  let played = 0, ctx = null, master, dry, wet, noiseBuf, lastT = -1, lastRun = null, muted = false, amb = null, beatT = 0;
  try { muted = localStorage.getItem('dc_mute') === '1'; } catch (e) {}
  const recent = {};
  let waterAmb = null;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(comp);
    dry = ctx.createGain(); dry.connect(master);
    // a stone hall: two seconds of decaying noise, darker at the tail
    const conv = ctx.createConvolver(), n = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { const k = i / n; lp += ((Math.random() * 2 - 1) - lp) * (0.6 - 0.45 * k); d[i] = lp * Math.pow(1 - k, 2.6); } }
    conv.buffer = ir; wet = ctx.createGain(); wet.gain.value = 0.35; wet.connect(conv); conv.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }
  addEventListener('keydown', (e) => { init(); if (e.code === 'KeyM' && ctx) { muted = !muted; master.gain.setTargetAtTime(muted ? 0 : 0.7, ctx.currentTime, 0.05); try { localStorage.setItem('dc_mute', muted ? '1' : '0'); } catch (er) {} } });
  addEventListener('pointerdown', init);

  // ---- building blocks: every voice ends in a panner and a send to the reverb ----
  const now = () => ctx.currentTime;
  function out(pan = 0, vol = 1, rev = 0.3) { const g = ctx.createGain(); g.gain.value = vol; const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p); p.connect(dry); if (rev > 0) { const s = ctx.createGain(); s.gain.value = rev; p.connect(s); s.connect(wet); } return g; }
  function env(g, t, a, peak, d, end = 0.0001) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); }
  function tone(dst, { type = 'sine', f0, f1 = f0, t = now(), a = 0.005, d = 0.2, v = 0.3, det = 0 }) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.detune.value = det; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + a + d);
    env(g, t, a, v, d); o.connect(g); g.connect(dst); o.start(t); o.stop(t + a + d + 0.05); return o; }
  function noise(dst, { t = now(), a = 0.003, d = 0.2, v = 0.3, type = 'bandpass', f0 = 1000, f1 = f0, q = 1 }) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; s.loop = true;
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + a + d);
    env(g, t, a, v, d); s.connect(f); f.connect(g); g.connect(dst); s.start(t, Math.random() * 1.5); s.stop(t + a + d + 0.05); return s; }
  const rr = (a, b) => a + Math.random() * (b - a);

  // ---- one recipe per event kind ----
  const SFX = {
    swing: (o) => noise(o, { d: 0.16, v: 0.35, f0: 2400, f1: 500, q: 1.4 }),
    whirl: (o) => { noise(o, { a: 0.05, d: 0.38, v: 0.4, f0: 600, f1: 2600, q: 2 }); noise(o, { t: now() + 0.12, d: 0.25, v: 0.25, f0: 2200, f1: 700, q: 2 }); },
    eswing: (o) => noise(o, { d: 0.14, v: 0.22, f0: 1500, f1: 400, q: 1.2 }),
    dash: (o) => noise(o, { a: 0.02, d: 0.22, v: 0.3, type: 'lowpass', f0: 2500, f1: 400 }),
    step: (o, e) => e.wet ? SFX.splash(o) : noise(o, { d: 0.05, v: 0.06, type: 'lowpass', f0: rr(500, 800) }),
    splash: (o) => { noise(o, { d: 0.14, v: 0.12, f0: 1400, f1: 450, q: 0.7 }); tone(o, { f0: 440, f1: 180, d: 0.08, v: 0.04 }); },
    douse: (o) => noise(o, { a: 0.02, d: 0.58, v: 0.28, type: 'highpass', f0: 4000, f1: 1200 }),
    snuff: (o) => noise(o, { d: 0.18, v: 0.1, type: 'highpass', f0: 3200, f1: 1500 }),
    hollow: (o) => { tone(o, { f0: 85, f1: 65, d: 0.28, v: 0.35 }); noise(o, { d: 0.25, v: 0.2, f0: 240, q: 6 }); },
    merchantHit: (o) => { tone(o, { type: 'triangle', f0: 170, f1: 250, d: 0.12, v: 0.18 }); noise(o, { d: 0.09, v: 0.12, type: 'lowpass', f0: 700 }); },
    hit: (o, e) => { tone(o, { f0: e.crit ? 180 : 150, f1: 55, d: 0.12, v: 0.5 }); noise(o, { d: 0.06, v: 0.3, type: 'highpass', f0: 1800 });
      if (e.crit) tone(o, { type: 'triangle', f0: 1900, d: 0.25, v: 0.12 }); if (e.fire) noise(o, { d: 0.25, v: 0.2, type: 'highpass', f0: 3000 }); },
    kill: (o, e) => { tone(o, { f0: 110, f1: 40, d: 0.25, v: 0.45 });
      if (e.type === 'skeleton' || e.type === 'brute') for (let i = 0; i < 6; i++) noise(o, { t: now() + 0.04 + i * rr(0.03, 0.06), d: 0.03, v: 0.18, f0: rr(1800, 3500), q: 6 });
      else if (e.type === 'ghost') tone(o, { type: 'triangle', f0: 700, f1: 180, a: 0.05, d: 0.6, v: 0.15 });
      else noise(o, { d: 0.18, v: 0.2, type: 'lowpass', f0: 900, f1: 200 }); },
    hurt: (o) => { tone(o, { f0: 120, f1: 50, d: 0.16, v: 0.55 }); tone(o, { type: 'sawtooth', f0: 210, f1: 150, a: 0.01, d: 0.14, v: 0.06 }); noise(o, { d: 0.08, v: 0.2, f0: 700, q: 2 }); },
    die: (o) => { tone(o, { f0: 90, f1: 28, a: 0.02, d: 1.4, v: 0.6 }); tone(o, { type: 'triangle', f0: 440, f1: 110, a: 0.3, d: 1.4, v: 0.12 }); noise(o, { a: 0.2, d: 1.2, v: 0.15, type: 'lowpass', f0: 800, f1: 100 }); },
    cast: (o) => { noise(o, { a: 0.02, d: 0.3, v: 0.3, type: 'bandpass', f0: 500, f1: 1800, q: 1 }); tone(o, { type: 'sawtooth', f0: 160, f1: 320, d: 0.2, v: 0.05 }); },
    boom: (o) => { noise(o, { a: 0.005, d: 0.8, v: 0.6, type: 'lowpass', f0: 1600, f1: 90 }); tone(o, { f0: 75, f1: 30, d: 0.6, v: 0.6 }); },
    slam: (o, e) => { noise(o, { d: e.big ? 1.0 : 0.5, v: 0.6, type: 'lowpass', f0: 900, f1: 60 }); tone(o, { f0: 60, f1: 25, d: e.big ? 0.9 : 0.45, v: 0.7 }); },
    eshoot: (o) => tone(o, { type: 'triangle', f0: 500, f1: 900, a: 0.02, d: 0.2, v: 0.12 }),
    pop: (o, e) => { if (e.c === 'hex') tone(o, { type: 'square', f0: 900, f1: 300, d: 0.12, v: e.hero ? 0.12 : 0.05 }); noise(o, { d: e.hero ? 0.3 : 0.15, v: e.hero ? 0.35 : 0.15, type: 'lowpass', f0: 1800, f1: 200 }); },
    spike: (o) => { noise(o, { d: 0.12, v: 0.3, type: 'highpass', f0: 3500 }); tone(o, { type: 'triangle', f0: 1650, d: 0.3, v: 0.08 }); tone(o, { type: 'triangle', f0: 2470, d: 0.22, v: 0.05 }); },
    scorch: (o) => noise(o, { a: 0.01, d: 0.3, v: 0.18, type: 'highpass', f0: 2400 }),
    gold: (o) => { for (let i = 0; i < 4; i++) tone(o, { type: 'triangle', f0: rr(2200, 3600), t: now() + i * rr(0.03, 0.07), d: 0.18, v: 0.08 }); },
    pickup: (o, e) => { tone(o, { type: 'triangle', f0: 660, f1: 990, d: 0.12, v: 0.12 }); if ((e.rar || 0) >= 2) tone(o, { f0: 1320, t: now() + 0.08, d: 0.4, v: 0.1 }); },
    shard: (o) => { tone(o, { f0: 1245, d: 0.7, v: 0.12 }); tone(o, { f0: 1865, t: now() + 0.06, d: 0.6, v: 0.08 }); },
    chest: (o) => { tone(o, { type: 'sawtooth', f0: 85, f1: 120, a: 0.05, d: 0.3, v: 0.05 }); noise(o, { d: 0.12, v: 0.25, type: 'lowpass', f0: 600 }); SFX.gold(o); },
    break: (o, e) => { if (e.kind === 'pot' || e.kind.startsWith('vase')) { noise(o, { d: 0.25, v: 0.35, f0: 2200, q: 1.5 }); for (let i = 0; i < 4; i++) noise(o, { t: now() + 0.05 + i * 0.04, d: 0.03, v: 0.12, f0: rr(2500, 4500), q: 5 }); }
      else if (e.kind === 'gold' || e.kind === 'goldpile') SFX.gold(o); else { noise(o, { d: 0.2, v: 0.35, type: 'lowpass', f0: 900, f1: 250 }); tone(o, { f0: 140, f1: 70, d: 0.12, v: 0.3 }); } },
    // a knocked prop: a wooden thunk, a dull stone crack, a metal clang with a ringing tail, a glassy chime, a muffled thump
    prop: (o, e) => { const m = e.mat;
      if (m === 'wood') { tone(o, { f0: 180, f1: 110, d: 0.12, v: 0.35 }); noise(o, { d: 0.12, v: 0.3, f0: 700, q: 3 }); }
      else if (m === 'stone') { tone(o, { f0: 95, f1: 60, d: 0.15, v: 0.4 }); noise(o, { d: 0.18, v: 0.3, type: 'lowpass', f0: 1400, f1: 300 }); noise(o, { d: 0.05, v: 0.15, type: 'highpass', f0: 3000 }); }
      else if (m === 'metal') { noise(o, { d: 0.06, v: 0.3, type: 'highpass', f0: 2500 }); [520, 1370, 2210].forEach((f, i) => tone(o, { type: 'triangle', f0: f * rr(0.97, 1.03), d: 0.7 - i * 0.15, v: 0.09 - i * 0.02 })); }
      else if (m === 'crystal') [1568, 2349, 3136].forEach((f, i) => tone(o, { f0: f * rr(0.99, 1.01), t: now() + i * 0.03, d: 1.0, v: 0.07 }));
      else if (m === 'bone') for (let i = 0; i < 4; i++) noise(o, { t: now() + i * 0.035, d: 0.035, v: 0.12, f0: rr(1600, 2800), q: 5 });
      else if (m === 'fire') noise(o, { a: 0.01, d: 0.35, v: 0.2, type: 'highpass', f0: 2600, f1: 900 });
      else if (m === 'wax') return;
      else noise(o, { d: 0.18, v: 0.35, type: 'lowpass', f0: 500, f1: 150 });
      if (e.n === 'brazier') noise(o, { t: now() + 0.03, a: 0.02, d: 0.4, v: 0.15, type: 'highpass', f0: 2400 });
      if (e.n === 'shop_gold') SFX.gold(o); },
    // a mechanism catches: a click, then the grind of stone starting to move
    click: (o) => { tone(o, { f0: 700, f1: 420, d: 0.06, v: 0.3 }); noise(o, { d: 0.05, v: 0.25, type: 'highpass', f0: 1800 }); tone(o, { f0: 90, f1: 60, a: 0.12, d: 0.5, v: 0.25 }); },
    // a fake wall sounds hollow: a knock with a resonant body behind it; breaking it is a rumble, falling stones and a chime
    wallhit: (o) => { tone(o, { f0: 120, f1: 80, d: 0.18, v: 0.45 }); noise(o, { d: 0.35, v: 0.3, f0: 320, q: 8 }); noise(o, { d: 0.08, v: 0.2, type: 'highpass', f0: 2000 }); },
    secret: (o) => { noise(o, { a: 0.01, d: 1.1, v: 0.6, type: 'lowpass', f0: 1200, f1: 80 }); tone(o, { f0: 70, f1: 32, d: 0.9, v: 0.6 });
      for (let i = 0; i < 8; i++) noise(o, { t: now() + 0.1 + i * rr(0.05, 0.1), d: 0.05, v: 0.18, type: 'lowpass', f0: rr(600, 1400) });
      [659, 880, 1319].forEach((f, i) => tone(o, { type: 'triangle', f0: f, t: now() + 0.45 + i * 0.12, d: 1.1, v: 0.08 })); },
    // doors: a creak and the leaf hitting the wall (a kick slams it), a locked one rattles in its frame, a key turns, a lever clanks
    door: (o, e) => { if (e.kick) { noise(o, { d: 0.25, v: 0.5, type: 'lowpass', f0: 600, f1: 120 }); tone(o, { f0: 110, f1: 60, d: 0.3, v: 0.4 }); }
      else { tone(o, { type: 'sawtooth', f0: 330, f1: 180, a: 0.05, d: 0.35, v: 0.05, det: 12 }); noise(o, { t: now() + 0.3, d: 0.2, v: 0.3, type: 'lowpass', f0: 500, f1: 120 }); } },
    locked: (o) => { for (let i = 0; i < 3; i++) noise(o, { t: now() + i * 0.06, d: 0.05, v: 0.25, f0: rr(900, 1300), q: 6 }); tone(o, { f0: 140, f1: 100, d: 0.12, v: 0.2 }); },
    unlatch: (o) => { tone(o, { f0: 900, f1: 600, d: 0.05, v: 0.2 }); tone(o, { f0: 600, f1: 380, t: now() + 0.12, d: 0.07, v: 0.25 }); noise(o, { t: now() + 0.12, d: 0.06, v: 0.2, type: 'highpass', f0: 2000 }); },
    lever: (o) => { noise(o, { d: 0.12, v: 0.4, f0: 700, q: 4 }); tone(o, { f0: 180, f1: 90, d: 0.25, v: 0.3 }); noise(o, { t: now() + 0.4, a: 0.05, d: 0.6, v: 0.15, type: 'lowpass', f0: 400, f1: 100 }); },
    key: (o) => [1319, 1760, 2093].forEach((f, i) => tone(o, { type: 'triangle', f0: f, t: now() + i * 0.05, d: 0.35, v: 0.07 })),
    // traps: silk catches with a sticky creak, tears with a dry rip, burns with a hiss; an ambush is a low drum and a rising whoosh
    web: (o) => { noise(o, { a: 0.02, d: 0.25, v: 0.18, f0: 2600, f1: 1400, q: 5 }); tone(o, { type: 'triangle', f0: 240, f1: 170, d: 0.2, v: 0.05 }); },
    webtear: (o) => noise(o, { d: 0.18, v: 0.3, type: 'highpass', f0: 3000, f1: 1500 }),
    webburn: (o) => noise(o, { a: 0.02, d: 0.5, v: 0.25, type: 'bandpass', f0: 1800, f1: 600, q: 2 }),
    ambush: (o) => { tone(o, { f0: 65, f1: 45, d: 0.6, v: 0.6 }); tone(o, { f0: 98, f1: 60, t: now() + 0.18, d: 0.5, v: 0.4 }); noise(o, { a: 0.3, d: 0.4, v: 0.2, type: 'bandpass', f0: 300, f1: 1800, q: 3 }); },
    lvl: (o) => [523, 659, 784, 1047].forEach((f, i) => tone(o, { type: 'triangle', f0: f, t: now() + i * 0.09, d: 0.6, v: 0.12 })),
    unlock: (o) => [784, 1175].forEach((f, i) => tone(o, { f0: f, t: now() + i * 0.12, d: 0.8, v: 0.12 })),
    drink: (o) => { for (let i = 0; i < 3; i++) tone(o, { f0: rr(260, 340), f1: rr(450, 560), t: now() + i * 0.11, d: 0.08, v: 0.14 }); },
    shield: (o) => { tone(o, { f0: 520, f1: 1040, a: 0.05, d: 0.5, v: 0.1 }); tone(o, { f0: 780, f1: 1560, a: 0.05, d: 0.5, v: 0.07, det: 8 }); },
    dodge: (o) => noise(o, { d: 0.14, v: 0.18, type: 'bandpass', f0: 2400, f1: 900, q: 1.5 }),
    absorb: (o) => tone(o, { type: 'triangle', f0: 1400, f1: 1100, d: 0.18, v: 0.1 }),
    bless: (o) => [392, 494, 587, 784].forEach((f) => { tone(o, { f0: f, a: 0.4, d: 1.4, v: 0.07 }); tone(o, { f0: f, a: 0.4, d: 1.4, v: 0.04, det: 9 }); }),
    teleport: (o) => { tone(o, { f0: 260, f1: 1600, a: 0.05, d: 0.6, v: 0.12 }); noise(o, { a: 0.1, d: 0.5, v: 0.15, f0: 900, f1: 5000, q: 3 }); },
    // stairs: footfalls going down stone steps, each lower and further; the floor altar: a low hum under a dark bell
    stairs: (o) => { for (let i = 0; i < 4; i++) { const t = now() + i * 0.17; tone(o, { f0: 130 - i * 14, f1: 60 - i * 6, t, d: 0.12, v: 0.32 - i * 0.05 }); noise(o, { t, d: 0.07, v: 0.16 - i * 0.025, type: 'lowpass', f0: 900 - i * 120 }); }
      noise(o, { t: now() + 0.05, a: 0.1, d: 0.6, v: 0.06, type: 'lowpass', f0: 500, f1: 150 }); },
    altar: (o) => { tone(o, { f0: 73, a: 0.25, d: 1.6, v: 0.22 }); tone(o, { f0: 110, a: 0.25, d: 1.4, v: 0.1, det: 7 });
      [294, 440].forEach((f, i) => tone(o, { type: 'triangle', f0: f, t: now() + 0.1 + i * 0.18, d: 1.3, v: 0.07 })); },
    floor: (o) => { tone(o, { f0: 98, f1: 92, a: 0.01, d: 1.8, v: 0.3 }); tone(o, { type: 'triangle', f0: 196, a: 0.01, d: 1.6, v: 0.08, det: 6 }); },
    roar: (o) => { const t = now(), s = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.type = 'sawtooth'; s.frequency.setValueAtTime(95, t); s.frequency.exponentialRampToValueAtTime(55, t + 1.3); lfo.frequency.value = 23; lg.gain.value = 18; lfo.connect(lg); lg.connect(s.frequency);
      f.type = 'lowpass'; f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(300, t + 1.3); env(g, t, 0.08, 0.5, 1.3); s.connect(f); f.connect(g); g.connect(o);
      s.start(t); lfo.start(t); s.stop(t + 1.5); lfo.stop(t + 1.5); noise(o, { a: 0.05, d: 1.2, v: 0.25, type: 'lowpass', f0: 700, f1: 120 }); },
    summon: (o) => tone(o, { type: 'triangle', f0: 600, f1: 150, a: 0.1, d: 0.7, v: 0.12, det: 20 }),
    // an explosive corpse hisses louder up to its burst; a vampire's drain is a low wet pull
    fuse: (o) => { noise(o, { a: 0.9, d: 0.15, v: 0.22, type: 'bandpass', f0: 1200, f1: 4200 }); tone(o, { type: 'square', f0: 220, f1: 880, a: 0.9, d: 0.1, v: 0.05 }); },
    drain: (o) => tone(o, { type: 'sawtooth', f0: 180, f1: 70, a: 0.03, d: 0.35, v: 0.1, det: 12 }),
    alert: (o) => tone(o, { type: 'triangle', f0: 880, f1: 1100, d: 0.07, v: 0.05 }),
    nope: (o) => tone(o, { type: 'square', f0: 130, d: 0.14, v: 0.06 }),
    ui: (o) => tone(o, { type: 'triangle', f0: 1200, d: 0.04, v: 0.06 }),
    equip: (o) => { noise(o, { d: 0.08, v: 0.2, f0: 1600, q: 2 }); tone(o, { type: 'triangle', f0: 900, d: 0.1, v: 0.06 }); },
    toss: (o) => noise(o, { d: 0.12, v: 0.15, type: 'lowpass', f0: 1200, f1: 300 }),
    buy: (o) => SFX.gold(o), trade: (o) => SFX.gold(o),
    shop: (o) => [1568, 2093].forEach((f, i) => tone(o, { type: 'triangle', f0: f, t: now() + i * 0.14, d: 0.5, v: 0.07 })),
  };
  // events heard everywhere on the floor (not attenuated by distance)
  const GLOBAL = new Set(['lvl', 'unlock', 'die', 'floor', 'roar', 'bless', 'teleport', 'shop', 'buy', 'trade', 'nope', 'ui', 'equip', 'toss', 'drink', 'pickup', 'shard', 'shield']);
  const LIMIT = { step: 0.08, hit: 0.03, gold: 0.05, alert: 0.15, kill: 0.04, scorch: 0.12, pop: 0.05, spike: 0.1 };

  function play(e, S) {
    const f = SFX[e.k]; if (!f) return;
    const gap = LIMIT[e.k] ?? 0.02, tn = now(); if (recent[e.k] && tn - recent[e.k] < gap) return; recent[e.k] = tn;
    let pan = 0, vol = 1;
    const R = S.run; if (R && R.cam && e.x !== undefined && !GLOBAL.has(e.k)) { const dx = e.x - (R.cam[0] + W / 2), dy = e.y - (R.cam[1] + H / 2);
      pan = dx / (W * 0.6); vol = Math.max(0, 1 - Math.max(0, Math.hypot(dx, dy * 1.4) - 500) / 900); if (vol < 0.03) return; }
    f(out(pan * 0.8, vol, e.k === 'step' ? 0.05 : 0.35), e); played++;
  }

  // ---- ambience: a drone and air per biome, plus sparse one-shots ----
  const BED = { dungeon: { f: 55, air: 500, one: 'drip' }, cave: { f: 50, air: 700, one: 'drip' }, crypt: { f: 49, air: 380, one: 'drip' }, lava: { f: 41, air: 260, one: 'ember' }, arcane: { f: 62, air: 900, one: 'chime' } };
  // a source is heard within its reach: a cave's fall roars further and lower than a fountain or a spring (TASKS 304)
  const SRC_SOUND = { waterfall: { reach: 460, f: 800, v: 0.24, gap: [0.08, 0.3] } }, SRC_PLAIN = { reach: 280, f: 1250, v: 0.16, gap: [0.16, 0.65] };
  function waterAmbience(S, on) {
    const R = S.run, h = R?.hero;
    const sources = on ? (R.map.waterFeatures || []).filter((q) => R.seen[Math.floor(q.y / DATA.TILE) * R.map.W + Math.floor(q.x / DATA.TILE)]) : [];
    let source = null, near = 1;
    for (const q of sources) { const d = Math.hypot(q.x - h.x, q.y - h.y) / (SRC_SOUND[q.kind] || SRC_PLAIN).reach; if (d < near) { source = q; near = d; } }
    const K = (source && SRC_SOUND[source.kind]) || SRC_PLAIN;
    if (!waterAmb && source) {
      const g = ctx.createGain(), pan = ctx.createStereoPanner(), filter = ctx.createBiquadFilter(), n = ctx.createBufferSource();
      g.gain.value = 0; filter.type = 'bandpass'; filter.frequency.value = 1250; filter.Q.value = 0.45;
      n.buffer = noiseBuf; n.loop = true; n.connect(filter); filter.connect(g); g.connect(pan); pan.connect(dry); pan.connect(wet); n.start();
      waterAmb = { g, pan, filter, next: 0 };
    }
    if (!waterAmb) return;
    const amount = source ? (1 - near) ** 2 : 0;
    waterAmb.g.gain.setTargetAtTime(amount * K.v, now(), 0.25);
    if (source) waterAmb.filter.frequency.setTargetAtTime(K.f, now(), 0.4);
    waterAmb.pan.pan.setTargetAtTime(source ? Math.max(-0.8, Math.min(0.8, (source.x - h.x) / 250)) : 0, now(), 0.2);
    if (source && now() > waterAmb.next) {
      waterAmb.next = now() + rr(...K.gap);
      tone(out((source.x - h.x) / 350, amount * 0.45, 0.55), { f0: rr(680, 1250), f1: rr(240, 420), d: rr(0.06, 0.13), v: 0.08 });
    }
  }
  function ambience(S) {
    const R = S.run, on = !!R && ['play', 'inv', 'shop', 'pause'].includes(S.screen), biome = on ? R.map.biome : null;
    waterAmbience(S, on && S.screen === 'play');
    if (amb && amb.biome !== biome) { const a = amb; a.g.gain.setTargetAtTime(0.0001, now(), 0.6); setTimeout(() => a.nodes.forEach((n) => { try { n.stop(); } catch (e) {} }), 3000); amb = null; }
    if (!amb && biome) { const B = BED[biome] || BED.dungeon, g = ctx.createGain(); g.gain.value = 0.0001; g.connect(dry); const sw = ctx.createGain(); sw.gain.value = 0.5; g.connect(sw); sw.connect(wet);
      const nodes = [], lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; lp.connect(g);
      for (const [m, det] of [[1, -6], [1.5, 5], [2, 0]]) { const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = B.f * m; o.detune.value = det; og.gain.value = m === 1 ? 0.08 : 0.03; o.connect(og); og.connect(lp); o.start(); nodes.push(o); }
      const n = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(); n.buffer = noiseBuf; n.loop = true;
      nf.type = 'bandpass'; nf.frequency.value = B.air; nf.Q.value = 0.7; ng.gain.value = 0.05; lfo.frequency.value = 0.07; lg.gain.value = B.air * 0.4; lfo.connect(lg); lg.connect(nf.frequency);
      n.connect(nf); nf.connect(ng); ng.connect(g); n.start(); lfo.start(); nodes.push(n, lfo);
      g.gain.setTargetAtTime(0.5, now(), 1.2); amb = { biome, g, nodes, next: now() + 2, one: B.one }; }
    if (amb && now() > amb.next) { amb.next = now() + rr(1.5, 5); const o = out(rr(-0.8, 0.8), rr(0.3, 0.7), 0.8);
      if (amb.one === 'drip') tone(o, { f0: rr(1100, 1700), f1: rr(500, 800), d: 0.08, v: 0.06 });
      if (amb.one === 'ember') { for (let i = 0; i < 5; i++) noise(o, { t: now() + i * rr(0.02, 0.09), d: 0.02, v: 0.06, f0: rr(2000, 5000), q: 4 }); noise(o, { a: 0.3, d: 1.2, v: 0.08, type: 'lowpass', f0: 200 }); }
      if (amb.one === 'chime') tone(o, { f0: [1047, 1319, 1568, 1976][Math.floor(rr(0, 4))], a: 0.02, d: 1.2, v: 0.03 }); }
    // a heartbeat while the hero is low on health
    if (on && S.screen === 'play' && R.hero.deadT < 0) { const st = window.SIM && SIM.stats ? SIM.stats(R.hero, S.meta) : null, f = st ? R.hero.hp / st.maxHp : 1;
      if (f < 0.3 && now() > beatT) { beatT = now() + 0.55 + 0.6 * f / 0.3; const o = out(0, 0.8, 0.1); tone(o, { f0: 62, f1: 40, d: 0.12, v: 0.5 }); tone(o, { f0: 55, f1: 36, t: now() + 0.16, d: 0.14, v: 0.4 }); } }
  }

  function update(S) {
    if (!ctx || !S || S.demo) { if (S) lastT = S.t; return; }
    if (S.run !== lastRun && S.run && lastRun && S.t < lastT) lastT = -1;
    if (S.t < lastT) lastT = S.t;
    lastRun = S.run;
    for (const e of S.ev) if (e.t > lastT) play(e, S);
    lastT = S.t;
    ambience(S);
  }

  window.AUDIO = { update, get muted() { return muted; }, get played() { return played; }, get state() { return ctx ? ctx.state : 'none'; } };
})();
