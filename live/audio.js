// live/audio.js: sound synthesised in WebAudio, driven by the sim event bus (S.ev). No sound files: every effect is built from
// oscillators and filtered noise, panned and attenuated by where it happens on screen, through one shared dungeon reverb.
// The ambience is a per-biome bed (a low drone, air, drips / embers / shimmer) and a heartbeat on low health.
// AUDIO.update(S) runs once a frame from the live loop; the volume and M's mute are the sim's (S.meta.vol, S.meta.mute). Sound starts on the first key or click,
// as browsers require (the context is made ahead, suspended), and stays silent in the attract demo.
(function () {
  const W = 1920, H = 1080;
  let played = 0, ctx = null, master, dry, wet, noiseBuf, lastT = -1, lastRun = null, muted = false, gainNow = 0, amb = null, beatT = 0;
  const recent = {};
  let waterAmb = null, lavaAmb = null, echo = null, dripT = -1;

  // The graph is built ahead, suspended, when the browser is idle after the live loop's first frame (TASKS 1874): built on the first
  // key, the context and the reverb's two seconds of noise took 150–370 ms on the Steam Deck, and that frame swallowed the key's
  // own answer (a pad's press opening the journal fell into it). The first key or click only resumes it; until then nothing plays
  let live = false, asked = false;
  function init() { live = true; if (!ctx) prepare(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
  function prepare() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = 0; master.connect(comp);
    dry = ctx.createGain(); dry.connect(master);
    // a stone hall: two seconds of decaying noise, darker at the tail
    const conv = ctx.createConvolver(), n = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { const k = i / n; lp += ((Math.random() * 2 - 1) - lp) * (0.6 - 0.45 * k); d[i] = lp * Math.pow(1 - k, 2.6); } }
    conv.buffer = ir; wet = ctx.createGain(); wet.gain.value = 0.35; wet.connect(conv); conv.connect(master);
    // a cave answers (TASKS 305): every sound sent to the hall also comes back off the far rock, twice, darker each time; the send
    // opens only in the caves
    echo = ctx.createGain(); echo.gain.value = 0;
    for (const [d, pan] of [[0.29, -0.5], [0.43, 0.5]]) { const dl = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter(), p = ctx.createStereoPanner(), g = ctx.createGain();
      dl.delayTime.value = d; fb.gain.value = 0.32; lp.type = 'lowpass'; lp.frequency.value = 1700; p.pan.value = pan; g.gain.value = 0.5;
      echo.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(p); p.connect(g); g.connect(master); }
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }
  addEventListener('keydown', () => init());
  addEventListener('pointerdown', init);

  // ---- building blocks: every voice ends in a panner and a send to the reverb ----
  const now = () => ctx.currentTime;
  function out(pan = 0, vol = 1, rev = 0.3) { const g = ctx.createGain(); g.gain.value = vol; const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p); p.connect(dry); if (rev > 0) { const s = ctx.createGain(); s.gain.value = rev; p.connect(s); s.connect(wet); s.connect(echo); } return g; }
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
    swing: (o, e) => { if (!e.shot) noise(o, { d: 0.16, v: 0.35, f0: 2400, f1: 500, q: 1.4 }); },
    whirl: (o) => { noise(o, { a: 0.05, d: 0.38, v: 0.4, f0: 600, f1: 2600, q: 2 }); noise(o, { t: now() + 0.12, d: 0.25, v: 0.25, f0: 2200, f1: 700, q: 2 }); },
    eswing: (o) => noise(o, { d: 0.14, v: 0.22, f0: 1500, f1: 400, q: 1.2 }),
    dash: (o) => noise(o, { a: 0.02, d: 0.22, v: 0.3, type: 'lowpass', f0: 2500, f1: 400 }),
    step: (o, e) => e.mat === 'wood' ? (tone(o, { f0: 160, f1: 95, d: 0.08, v: 0.09 }), noise(o, { d: 0.07, v: 0.06, f0: 900, f1: 400, q: 3 })) : e.wet ? SFX.splash(o) : noise(o, { d: 0.05, v: 0.06, type: 'lowpass', f0: rr(500, 800) }),
    splash: (o) => { noise(o, { d: 0.14, v: 0.12, f0: 1400, f1: 450, q: 0.7 }); tone(o, { f0: 440, f1: 180, d: 0.08, v: 0.04 }); },
    // the cave's monsters (TASKS 307, 308): the drowned bursting out of the water, its grab's wet slap and the haul, a slime's squelch
    rise: (o) => { noise(o, { a: 0.01, d: 0.5, v: 0.4, f0: 1100, f1: 300, q: 0.6 }); tone(o, { f0: 300, f1: 90, d: 0.25, v: 0.1 });
      for (let i = 0; i < 6; i++) noise(o, { t: now() + 0.15 + i * rr(0.04, 0.09), d: 0.05, v: 0.08, f0: rr(1500, 3200), q: 4 });
      tone(o, { type: 'sawtooth', f0: 82, f1: 62, t: now() + 0.2, a: 0.08, d: 0.6, v: 0.06, det: 10 }); },
    grab: (o) => noise(o, { d: 0.12, v: 0.2, f0: 1300, f1: 500, q: 1 }),
    // the eel (TASKS 310): the water boils where it will come up (a run of low bubbles, rising), the snap of its jaws, the jet's
    // gargle and hiss, the slap and gulp of its dive
    stir: (o) => { for (let i = 0; i < 9; i++) { const t = now() + i * rr(0.06, 0.1); tone(o, { f0: rr(180, 320) * (1 + i * 0.06), f1: rr(420, 700), t, a: 0.004, d: 0.05, v: 0.07 }); }
      noise(o, { a: 0.25, d: 0.5, v: 0.07, type: 'lowpass', f0: 380, f1: 600 }); },
    bite: (o) => { noise(o, { d: 0.03, v: 0.4, type: 'highpass', f0: 2200 }); tone(o, { type: 'square', f0: 260, f1: 120, d: 0.05, v: 0.08 }); noise(o, { t: now() + 0.02, d: 0.12, v: 0.15, type: 'lowpass', f0: 900, f1: 300 }); },
    spit: (o) => { noise(o, { a: 0.02, d: 0.12, v: 0.15, f0: 500, f1: 900, q: 3 }); noise(o, { t: now() + 0.08, a: 0.01, d: 0.3, v: 0.22, type: 'highpass', f0: 2500, f1: 1400 }); },
    dive: (o) => { SFX.splash(o); noise(o, { t: now() + 0.05, a: 0.02, d: 0.35, v: 0.25, f0: 700, f1: 160, q: 0.8 }); tone(o, { t: now() + 0.15, f0: 160, f1: 70, d: 0.2, v: 0.08 }); },
    wave: (o) => { noise(o, { a: 0.06, d: 0.55, v: 0.35, type: 'lowpass', f0: 1600, f1: 350 }); tone(o, { f0: 90, f1: 45, d: 0.45, v: 0.12 }); },
    tail: (o) => { SFX.splash(o); noise(o, { d: 0.25, v: 0.35, f0: 1600, f1: 300 }); },
    floodwarn: (o) => noise(o, { a: 0.3, d: 1, v: 0.22, type: 'lowpass', f0: 180, f1: 600 }),
    flood: (o) => { SFX.splash(o); tone(o, { f0: 70, f1: 35, a: 0.1, d: 0.7, v: 0.16 }); },
    grabbed: (o) => { noise(o, { d: 0.08, v: 0.3, type: 'lowpass', f0: 1600, f1: 400 }); noise(o, { t: now() + 0.05, a: 0.03, d: 0.22, v: 0.18, f0: 600, f1: 250, q: 1.5 }); },
    squelch: (o, e) => { const k = e.big === false ? 1.5 : 1; noise(o, { d: 0.18, v: 0.3, f0: 700 * k, f1: 220 * k, q: 3 }); tone(o, { f0: 220 * k, f1: 90 * k, d: 0.14, v: 0.12 }); },
    land: (o, e) => SFX.squelch(o, { big: e.type === 'slime' }),
    split: (o) => { SFX.squelch(o, {}); SFX.squelch(o, { big: false }); },
    goo: (o) => noise(o, { a: 0.02, d: 0.2, v: 0.14, f0: 520, f1: 260, q: 4 }),
    douse: (o) => noise(o, { a: 0.02, d: 0.58, v: 0.28, type: 'highpass', f0: 4000, f1: 1200 }),
    snuff: (o) => noise(o, { d: 0.18, v: 0.1, type: 'highpass', f0: 3200, f1: 1500 }),
    merchantHit: (o) => { tone(o, { type: 'triangle', f0: 170, f1: 250, d: 0.12, v: 0.18 }); noise(o, { d: 0.09, v: 0.12, type: 'lowpass', f0: 700 }); },
    // a blow off the crab's armour (TASKS 309) rings like struck iron, with no thud of flesh under it: the player hears it is wasted
    clang: (o, e) => { noise(o, { d: 0.03, v: 0.35, type: 'highpass', f0: 3500 }); for (const [f, v, d] of [[1180, 0.13, 0.5], [1730, 0.09, 0.38], [2610, 0.06, 0.3], [3390, 0.04, 0.22]]) tone(o, { type: 'triangle', f0: f * (e.crit ? 1.06 : 1), f1: f * 0.985, a: 0.003, d, v });
      tone(o, { f0: 260, f1: 180, d: 0.08, v: 0.12 }); },
    pinch: (o) => { noise(o, { d: 0.04, v: 0.3, type: 'highpass', f0: 2600 }); tone(o, { type: 'square', f0: 900, f1: 500, d: 0.035, v: 0.05 }); noise(o, { t: now() + 0.02, d: 0.06, v: 0.15, f0: 1400, q: 5 }); },
    rush: (o) => { for (let i = 0; i < 9; i++) noise(o, { t: now() + i * rr(0.035, 0.05), d: 0.025, v: 0.13, f0: rr(1800, 3200), q: 5 }); noise(o, { a: 0.02, d: 0.35, v: 0.12, type: 'lowpass', f0: 600, f1: 250 }); },
    hit: (o, e) => { if (e.arm) return SFX.clang(o, e); tone(o, { f0: e.crit ? 180 : 150, f1: 55, d: 0.12, v: 0.5 }); noise(o, { d: 0.06, v: 0.3, type: 'highpass', f0: 1800 });
      if (e.crit) tone(o, { type: 'triangle', f0: 1900, d: 0.25, v: 0.12 }); if (e.fire) noise(o, { d: 0.25, v: 0.2, type: 'highpass', f0: 3000 }); },
    kill: (o, e) => { tone(o, { f0: 110, f1: 40, d: 0.25, v: 0.45 });
      if (e.type === 'skeleton' || e.type === 'skel_archer' || e.type === 'skel_mage' || e.type === 'skel_ember' || e.type === 'brute') for (let i = 0; i < 6; i++) noise(o, { t: now() + 0.04 + i * rr(0.03, 0.06), d: 0.03, v: 0.18, f0: rr(1800, 3500), q: 6 });
      else if (e.type === 'ghost') tone(o, { type: 'triangle', f0: 700, f1: 180, a: 0.05, d: 0.6, v: 0.15 });
      else if (e.type === 'slime' || e.type === 'slime_s') SFX.squelch(o, { big: e.type === 'slime' });
      else if (e.type === 'golem') { for (let i = 0; i < 9; i++) noise(o, { t: now() + i * rr(0.04, 0.09), d: 0.06, v: 0.3 - i * 0.02, type: 'lowpass', f0: rr(600, 1200), f1: 200 }); tone(o, { f0: 55, f1: 30, d: 0.8, v: 0.5 }); }
      else if (e.type === 'imp') { tone(o, { type: 'square', f0: 900, f1: 300, a: 0.01, d: 0.22, v: 0.05 }); noise(o, { d: 0.1, v: 0.15, type: 'lowpass', f0: 1200 }); }
      else if (e.type === 'crab') { for (let i = 0; i < 4; i++) noise(o, { t: now() + i * rr(0.03, 0.06), d: 0.04, v: 0.22, f0: rr(900, 1600), q: 4 }); noise(o, { t: now() + 0.12, d: 0.3, v: 0.15, type: 'lowpass', f0: 500, f1: 120 }); }
      else if (e.type === 'eel') { SFX.dive(o); tone(o, { type: 'sawtooth', f0: 140, f1: 55, a: 0.02, d: 0.5, v: 0.06, det: 15 }); }
      else if (e.type === 'drowned') { SFX.splash(o); noise(o, { t: now() + 0.25, d: 0.35, v: 0.22, type: 'lowpass', f0: 700, f1: 150 }); }
      else noise(o, { d: 0.18, v: 0.2, type: 'lowpass', f0: 900, f1: 200 }); },
    hurt: (o) => { tone(o, { f0: 120, f1: 50, d: 0.16, v: 0.55 }); tone(o, { type: 'sawtooth', f0: 210, f1: 150, a: 0.01, d: 0.14, v: 0.06 }); noise(o, { d: 0.08, v: 0.2, f0: 700, q: 2 }); },
    die: (o) => { tone(o, { f0: 90, f1: 28, a: 0.02, d: 1.4, v: 0.6 }); tone(o, { type: 'triangle', f0: 440, f1: 110, a: 0.3, d: 1.4, v: 0.12 }); noise(o, { a: 0.2, d: 1.2, v: 0.15, type: 'lowpass', f0: 800, f1: 100 }); },
    // the staff's bolt (TASKS 1110): a short glassy zip; the ice wave: a cold hiss under three high crystal notes falling
    bolt: (o) => { noise(o, { d: 0.12, v: 0.18, type: 'bandpass', f0: 3200, f1: 1400, q: 4 }); tone(o, { type: 'triangle', f0: 1400, f1: 700, d: 0.12, v: 0.05 }); },
    frost: (o) => { noise(o, { a: 0.02, d: 0.55, v: 0.35, type: 'highpass', f0: 5000, f1: 1800 }); [2637, 2093, 1568].forEach((f, i) => tone(o, { type: 'triangle', f0: f, t: now() + 0.04 + i * 0.06, d: 0.4, v: 0.04 })); },
    // the warrior (TASKS 1130): the charge's rush of air, its heavy blow, the war cry — a low brass shout under a rising roar
    charge: (o) => noise(o, { a: 0.01, d: 0.25, v: 0.35, f0: 300, f1: 1400, q: 1.2 }),
    chargehit: (o) => { noise(o, { d: 0.18, v: 0.45, type: 'lowpass', f0: 900, f1: 120 }); tone(o, { f0: 90, f1: 45, d: 0.25, v: 0.35 }); },
    cry: (o) => { tone(o, { type: 'sawtooth', f0: 110, f1: 165, a: 0.05, d: 0.6, v: 0.12 }); tone(o, { type: 'sawtooth', f0: 165, f1: 247, a: 0.08, d: 0.55, v: 0.06 }); noise(o, { a: 0.1, d: 0.5, v: 0.12, type: 'bandpass', f0: 400, f1: 900, q: 1 }); },
    // the archer (TASKS 1120): a bowstring's twang; a volley's quick ripple of them; a trap set (a click); its jaws snapping; the leap's rush
    hloose: (o) => { tone(o, { type: 'triangle', f0: 220, f1: 150, d: 0.12, v: 0.08 }); noise(o, { d: 0.06, v: 0.12, type: 'highpass', f0: 3000 }); },
    volley: (o) => { [0, 0.03, 0.06, 0.09, 0.12].forEach((dt, i) => tone(o, { type: 'triangle', f0: 260 - i * 12, f1: 150, t: now() + dt, d: 0.1, v: 0.1 })); noise(o, { d: 0.2, v: 0.12, type: 'highpass', f0: 2600 }); },
    hush: (o) => { tone(o, { type: 'square', f0: 700, f1: 320, t: now() + 0.03, d: 0.07, v: 0.1 }); },
    trapset: (o) => { tone(o, { type: 'square', f0: 1400, d: 0.03, v: 0.03 }); tone(o, { type: 'square', f0: 900, t: now() + 0.05, d: 0.03, v: 0.03 }); },
    trapsnap: (o) => { noise(o, { d: 0.08, v: 0.3, type: 'bandpass', f0: 2600, f1: 900, q: 2 }); tone(o, { type: 'square', f0: 500, f1: 180, d: 0.08, v: 0.06 }); },
    hleap: (o) => noise(o, { a: 0.02, d: 0.22, v: 0.25, f0: 500, f1: 2200, q: 1.5 }),
    hland: (o) => noise(o, { d: 0.05, v: 0.14, type: 'lowpass', f0: 900, f1: 300 }),
    shield_break: (o) => { tone(o, { type: 'triangle', f0: 1800, f1: 500, d: 0.14, v: 0.14 }); noise(o, { d: 0.12, v: 0.16, f0: 4000, f1: 1500, q: 1 }); },
    cast: (o) => { noise(o, { a: 0.02, d: 0.3, v: 0.3, type: 'bandpass', f0: 500, f1: 1800, q: 1 }); tone(o, { type: 'sawtooth', f0: 160, f1: 320, d: 0.2, v: 0.05 }); },
    // a fuse (an explosive corpse, a smouldering skeleton, TASKS 411): a hiss rising to the burst, sputtering ever faster
    fuse: (o, e) => { noise(o, { a: 0.05, d: e.d, v: 0.18, type: 'highpass', f0: 1400, f1: 4200 });
      for (let i = 0, n = Math.round(e.d * 14); i < n; i++) noise(o, { t: now() + e.d * Math.sqrt(i / n), d: 0.02, v: 0.1 + 0.12 * i / n, f0: rr(2000, 4000), q: 5 }); },
    // the fire priest (TASKS 410): its ring hums up under the hero, the pillar roars out of it; lighting the weapons, a whoosh
    pyre: (o, e) => { tone(o, { f0: 70, f1: 140, a: e.d * 0.8, d: 0.2, v: 0.25 }); noise(o, { a: e.d * 0.8, d: 0.2, v: 0.16, type: 'bandpass', f0: 300, f1: 1200, q: 2 }); },
    pillar: (o) => { noise(o, { a: 0.01, d: 0.6, v: 0.5, type: 'lowpass', f0: 2600, f1: 300 }); tone(o, { f0: 90, f1: 45, a: 0.01, d: 0.5, v: 0.4 }); for (let i = 0; i < 6; i++) noise(o, { t: now() + 0.05 + i * rr(0.04, 0.08), d: 0.03, v: 0.15, f0: rr(2000, 4000), q: 5 }); },
    kindle: (o) => { noise(o, { a: 0.03, d: 0.4, v: 0.3, type: 'bandpass', f0: 400, f1: 1800, q: 1.2 }); noise(o, { t: now() + 0.1, a: 0.02, d: 0.3, v: 0.15, type: 'highpass', f0: 2500, f1: 1500 }); },
    boom: (o) => { noise(o, { a: 0.005, d: 0.8, v: 0.6, type: 'lowpass', f0: 1600, f1: 90 }); tone(o, { f0: 75, f1: 30, d: 0.6, v: 0.6 }); },
    // the imp (TASKS 407): a scrabble of claws and a little cackle as it springs, a light patter landing; the spark thrown, a crackle
    leap: (o) => { for (let i = 0; i < 3; i++) noise(o, { t: now() + i * 0.025, d: 0.02, v: 0.12, f0: rr(2200, 3400), q: 6 }); tone(o, { type: 'square', f0: rr(620, 720), f1: 980, t: now() + 0.04, d: 0.07, v: 0.035 }); },
    land: (o) => { noise(o, { d: 0.05, v: 0.14, type: 'lowpass', f0: 900, f1: 300 }); noise(o, { t: now() + 0.03, d: 0.02, v: 0.08, f0: 2600, q: 6 }); },
    flick: (o) => { noise(o, { a: 0.005, d: 0.18, v: 0.16, type: 'highpass', f0: 3000, f1: 1800 }); for (let i = 0; i < 4; i++) noise(o, { t: now() + 0.03 + i * rr(0.02, 0.04), d: 0.015, v: 0.1, f0: rr(3000, 5000), q: 6 }); },
    // the salamander (TASKS 408): a low hiss through the wind-up's glow, then a roar of fire; a snap of jaws; the lava gulping as it
    // goes under and spitting as it comes out
    breath: (o) => { noise(o, { a: 0.03, d: 0.7, v: 0.42, type: 'bandpass', f0: 900, f1: 380, q: 0.8 }); tone(o, { type: 'sawtooth', f0: 95, f1: 70, a: 0.03, d: 0.6, v: 0.07, det: 12 }); },
    snap: (o) => { noise(o, { d: 0.05, v: 0.3, type: 'lowpass', f0: 1400, f1: 500 }); tone(o, { f0: 220, f1: 110, d: 0.06, v: 0.2 }); },
    submerge: (o) => { tone(o, { f0: 120, f1: 50, a: 0.02, d: 0.4, v: 0.3 }); noise(o, { a: 0.02, d: 0.5, v: 0.18, type: 'highpass', f0: 1800, f1: 800 }); },
    emerge: (o) => { noise(o, { d: 0.35, v: 0.25, type: 'bandpass', f0: 600, f1: 1600, q: 1 }); for (let i = 0; i < 4; i++) noise(o, { t: now() + 0.05 + i * 0.06, d: 0.04, v: 0.12, type: 'highpass', f0: 2600 }); },
    flee: (o) => tone(o, { type: 'sawtooth', f0: 260, f1: 150, a: 0.02, d: 0.25, v: 0.06, det: 20 }),
    // the magma golem (TASKS 409): a plate of crust grinding back into place; dead, its stones tumble and its core spills hissing
    regrow: (o) => { noise(o, { a: 0.05, d: 0.3, v: 0.2, type: 'lowpass', f0: 700, f1: 300 }); tone(o, { f0: 80, f1: 95, a: 0.05, d: 0.25, v: 0.15 }); },
    pool: (o) => { for (let i = 0; i < 6; i++) noise(o, { t: now() + i * rr(0.05, 0.09), d: 0.06, v: 0.22, type: 'lowpass', f0: rr(500, 900) }); noise(o, { t: now() + 0.2, a: 0.05, d: 1.0, v: 0.2, type: 'highpass', f0: 2000, f1: 900 }); },
    slam: (o, e) => { noise(o, { d: e.big ? 1.0 : 0.5, v: 0.6, type: 'lowpass', f0: 900, f1: 60 }); tone(o, { f0: 60, f1: 25, d: e.big ? 0.9 : 0.45, v: 0.7 }); },
    // the skeleton archer and mage (TASKS 311): the bow's twang and the arrow's hiss, a dull thunk where it breaks on rock; the mage's
    // gulp of water thrown, its splash, and the cold slap on a hero it soaks
    loose: (o) => { tone(o, { type: 'triangle', f0: 190, f1: 120, a: 0.003, d: 0.18, v: 0.16 }); tone(o, { type: 'sine', f0: 380, f1: 300, a: 0.003, d: 0.1, v: 0.06 }); noise(o, { t: now() + 0.02, a: 0.01, d: 0.16, v: 0.14, type: 'highpass', f0: 3800, f1: 2200 }); },
    orb: (o) => { tone(o, { f0: 220, f1: 520, a: 0.02, d: 0.16, v: 0.1 }); noise(o, { a: 0.03, d: 0.25, v: 0.16, f0: 600, f1: 1300, q: 2.5 }); for (let i = 0; i < 4; i++) tone(o, { t: now() + 0.05 + i * rr(0.03, 0.06), f0: rr(500, 900), f1: rr(900, 1400), a: 0.003, d: 0.04, v: 0.05 }); },
    soak: (o) => { SFX.splash(o); noise(o, { t: now() + 0.03, a: 0.01, d: 0.4, v: 0.18, type: 'highpass', f0: 3000, f1: 1600 }); },
    eshoot: (o) => tone(o, { type: 'triangle', f0: 500, f1: 900, a: 0.02, d: 0.2, v: 0.12 }),
    pop: (o, e) => { if (e.c === 'bolt') { tone(o, { type: 'triangle', f0: 900, f1: 500, d: 0.08, v: e.hit ? 0.06 : 0.03 }); return; } if (e.c === 'arrow') { if (!e.hero && !e.hit) { noise(o, { d: 0.05, v: 0.25, type: 'lowpass', f0: 1400, f1: 400 }); tone(o, { f0: 240, f1: 160, d: 0.05, v: 0.08 }); } return; }
      if (e.c === 'orb') { SFX.splash(o); noise(o, { d: 0.2, v: 0.2, f0: 1200, f1: 500, q: 0.8 }); return; }
      if (e.c === 'jet') { SFX.splash(o); if (e.hero) noise(o, { d: 0.2, v: 0.25, f0: 1800, f1: 600, q: 0.7 }); return; } if (e.c === 'hex') tone(o, { type: 'square', f0: 900, f1: 300, d: 0.12, v: e.hero ? 0.12 : 0.05 }); noise(o, { d: e.hero ? 0.3 : 0.15, v: e.hero ? 0.35 : 0.15, type: 'lowpass', f0: 1800, f1: 200 }); },
    spike: (o) => { noise(o, { d: 0.12, v: 0.3, type: 'highpass', f0: 3500 }); tone(o, { type: 'triangle', f0: 1650, d: 0.3, v: 0.08 }); tone(o, { type: 'triangle', f0: 2470, d: 0.22, v: 0.05 }); },
    scorch: (o) => noise(o, { a: 0.01, d: 0.3, v: 0.18, type: 'highpass', f0: 2400 }),
    // the magma caves' crust (TASKS 401): a dry crack and a low groan as it gives, a hiss and a gulp as it melts, a tick as it sets;
    // a monster knocked off a plateau: a sizzling plunge into the lava, a fading cry into the chasm
    crack: (o) => { noise(o, { d: 0.09, v: 0.35, type: 'highpass', f0: 1800 }); noise(o, { t: now() + 0.07, d: 0.06, v: 0.25, type: 'highpass', f0: 2600 }); tone(o, { f0: 70, f1: 45, a: 0.02, d: 0.5, v: 0.25 }); },
    melt: (o) => { noise(o, { a: 0.02, d: 0.6, v: 0.2, type: 'highpass', f0: 2000, f1: 900 }); tone(o, { f0: 110, f1: 60, a: 0.03, d: 0.35, v: 0.3 }); },
    set: (o) => noise(o, { d: 0.05, v: 0.12, type: 'highpass', f0: 3200 }),
    // the magma caves' hazards (TASKS 406): a vent's warning is a low boil rising to its burst, a roar of fire and a spatter; a rock
    // about to fall is grit trickling and a creak, then the thud of its fall and stone breaking
    hazwarn: (o, e) => { if (e.h === 'vent') { tone(o, { f0: 55, f1: 110, a: 1.0, d: 0.25, v: 0.35 }); noise(o, { a: 1.0, d: 0.2, v: 0.22, type: 'bandpass', f0: 300, f1: 900, q: 2 });
        for (let i = 0; i < 6; i++) tone(o, { f0: rr(140, 220), f1: rr(260, 380), t: now() + 0.15 + i * 0.17, d: 0.06, v: 0.06 + i * 0.015 }); }
      else { noise(o, { a: 0.5, d: 0.3, v: 0.16, type: 'highpass', f0: 2500, f1: 1200 }); tone(o, { type: 'triangle', f0: 120, f1: 95, a: 0.3, d: 0.4, v: 0.1 }); } },
    erupt: (o) => { noise(o, { a: 0.02, d: 0.8, v: 0.45, type: 'lowpass', f0: 1800, f1: 200 }); tone(o, { f0: 70, f1: 38, a: 0.01, d: 0.7, v: 0.55 });
      for (let i = 0; i < 5; i++) noise(o, { t: now() + 0.15 + i * 0.09, d: 0.08, v: 0.14, type: 'highpass', f0: 2600 }); },
    // the colossus (TASKS 413): a crack tearing the floor open, a boulder's heave and its fall, rocks of the eruption, the edge giving
    // way, the lake giving it up, the fists stuck in the floor grinding loose
    colcrack: (o) => { noise(o, { a: 0.01, d: 0.7, v: 0.45, type: 'bandpass', f0: 2200, f1: 300, q: 1.2 }); tone(o, { f0: 55, f1: 30, a: 0.01, d: 0.6, v: 0.5 }); },
    throw: (o) => { noise(o, { a: 0.05, d: 0.35, v: 0.25, type: 'bandpass', f0: 400, f1: 1400, q: 1.5 }); },
    boulder: (o) => { tone(o, { f0: 70, f1: 28, a: 0.005, d: 0.7, v: 0.7 }); noise(o, { a: 0.005, d: 0.6, v: 0.5, type: 'lowpass', f0: 1600, f1: 150 }); },
    rock: (o) => { tone(o, { f0: rr(110, 140), f1: 50, a: 0.005, d: 0.25, v: 0.35 }); noise(o, { a: 0.005, d: 0.25, v: 0.25, type: 'lowpass', f0: 1800, f1: 300 }); },
    shatter: (o) => { for (let i = 0; i < 5; i++) noise(o, { t: now() + i * rr(0.05, 0.12), d: 0.15, v: 0.3, type: 'highpass', f0: rr(1500, 3000) }); tone(o, { f0: 50, f1: 28, a: 0.05, d: 1.4, v: 0.5 }); },
    colerupt: (o) => { noise(o, { a: 0.1, d: 1.6, v: 0.5, type: 'lowpass', f0: 1200, f1: 120 }); tone(o, { f0: 45, f1: 26, a: 0.1, d: 1.5, v: 0.6 }); },
    colrise: (o) => { noise(o, { a: 0.3, d: 1.2, v: 0.35, type: 'lowpass', f0: 600, f1: 1400 }); for (let i = 0; i < 6; i++) noise(o, { t: now() + i * rr(0.1, 0.2), d: 0.08, v: 0.2, type: 'lowpass', f0: rr(400, 800) }); },
    colstep: (o) => { tone(o, { f0: 62, f1: 28, a: 0.005, d: 0.32, v: 0.4 }); noise(o, { a: 0.005, d: 0.2, v: 0.22, type: 'lowpass', f0: 700, f1: 170 }); },
    stuck: (o) => { noise(o, { t: now() + 0.6, a: 0.2, d: 0.6, v: 0.2, type: 'bandpass', f0: 300, f1: 700, q: 2 }); },
    rockfall: (o) => { tone(o, { f0: 90, f1: 40, a: 0.005, d: 0.35, v: 0.6 }); noise(o, { a: 0.005, d: 0.4, v: 0.4, type: 'lowpass', f0: 1400, f1: 250 });
      for (let i = 0; i < 4; i++) noise(o, { t: now() + 0.06 + i * 0.07, d: 0.05, v: 0.15, type: 'bandpass', f0: rr(1500, 3000), q: 3 }); },
    // (placeholders until the real audio, TASKS 1646: the magma's actions that had no sound)
    lavafall: (o) => { noise(o, { d: 0.25, v: 0.35, type: 'lowpass', f0: 1000, f1: 160 }); tone(o, { f0: 130, f1: 50, d: 0.3, v: 0.3 }); },
    ignite: (o) => noise(o, { a: 0.01, d: 0.28, v: 0.2, type: 'highpass', f0: 2000, f1: 900 }),
    surge: (o) => { noise(o, { a: 0.05, d: 0.5, v: 0.3, type: 'lowpass', f0: 800, f1: 240 }); tone(o, { f0: 75, f1: 45, d: 0.45, v: 0.28 }); },
    bossphase: (o) => tone(o, { f0: 60, f1: 30, a: 0.02, d: 0.7, v: 0.4 }),
    sink: (o) => { noise(o, { a: 0.01, d: 1.2, v: 0.28, type: 'highpass', f0: 1800, f1: 700 }); tone(o, { f0: 140, f1: 55, a: 0.02, d: 0.6, v: 0.3 }); },
    fall: (o) => { tone(o, { type: 'triangle', f0: 420, f1: 120, a: 0.02, d: 0.8, v: 0.08 }); noise(o, { a: 0.05, d: 0.7, v: 0.12, type: 'lowpass', f0: 900, f1: 200 }); },
    gold: (o) => { for (let i = 0; i < 4; i++) tone(o, { type: 'triangle', f0: rr(2200, 3600), t: now() + i * rr(0.03, 0.07), d: 0.18, v: 0.08 }); },
    pickup: (o, e) => { tone(o, { type: 'triangle', f0: 660, f1: 990, d: 0.12, v: 0.12 }); if ((e.rar || 0) >= 2) tone(o, { f0: 1320, t: now() + 0.08, d: 0.4, v: 0.1 }); },
    shard: (o) => { tone(o, { f0: 1245, d: 0.7, v: 0.12 }); tone(o, { f0: 1865, t: now() + 0.06, d: 0.6, v: 0.08 }); },
    mimicwake: (o) => { noise(o, { d: 0.2, v: 0.3, type: 'lowpass', f0: 900 }); tone(o, { type: 'sawtooth', f0: 70, f1: 240, d: 0.3, v: 0.12 }); },
    trapfuse: (o) => { noise(o, { d: 0.5, v: 0.12, type: 'highpass', f0: 3000 }); tone(o, { type: 'square', f0: 1100, d: 0.05, v: 0.08 }); },
    trapbang: (o) => { noise(o, { d: 0.3, v: 0.45, type: 'lowpass', f0: 1600, f1: 300 }); tone(o, { f0: 90, f1: 40, d: 0.25, v: 0.5 }); },
    chest: (o) => { tone(o, { type: 'sawtooth', f0: 85, f1: 120, a: 0.05, d: 0.3, v: 0.05 }); noise(o, { d: 0.12, v: 0.25, type: 'lowpass', f0: 600 }); SFX.gold(o); },
    break: (o, e) => { if (e.kind === 'pot' || e.kind.startsWith('vase')) { noise(o, { d: 0.25, v: 0.35, f0: 2200, q: 1.5 }); for (let i = 0; i < 4; i++) noise(o, { t: now() + 0.05 + i * 0.04, d: 0.03, v: 0.12, f0: rr(2500, 4500), q: 5 }); }
      else if (e.kind === 'gold' || e.kind === 'goldpile') SFX.gold(o); else { noise(o, { d: 0.2, v: 0.35, type: 'lowpass', f0: 900, f1: 250 }); tone(o, { f0: 140, f1: 70, d: 0.12, v: 0.3 }); } },
    // a knocked prop: a wooden thunk, a dull stone crack, a metal clang with a ringing tail, a glassy chime, a muffled thump
    prop: (o, e) => { const m = e.mat;
      if (m === 'wood') { tone(o, { f0: 180, f1: 110, d: 0.12, v: 0.35 }); noise(o, { d: 0.12, v: 0.3, f0: 700, q: 3 }); }
      else if (m === 'stone') { tone(o, { f0: 95, f1: 60, d: 0.15, v: 0.4 }); noise(o, { d: 0.18, v: 0.3, type: 'lowpass', f0: 1400, f1: 300 }); noise(o, { d: 0.05, v: 0.15, type: 'highpass', f0: 3000 }); }
      else if (m === 'metal') { noise(o, { d: 0.06, v: 0.3, type: 'highpass', f0: 2500 }); [520, 1370, 2210].forEach((f, i) => tone(o, { type: 'triangle', f0: f * rr(0.97, 1.03), d: 0.7 - i * 0.15, v: 0.09 - i * 0.02 })); }
      else if (m === 'crystal') [1568, 2349, 3136].forEach((f, i) => tone(o, { f0: f * rr(0.99, 1.01), t: now() + i * 0.03, d: 1.0, v: 0.07 }));
      else if (m === 'fungus') { noise(o, { d: 0.15, v: e.touch ? 0.03 : 0.09, f0: 1800, f1: 500 }); tone(o, { f0: 420, f1: 250, d: 0.14, v: 0.025 }); }
      else if (m === 'bone') for (let i = 0; i < 4; i++) noise(o, { t: now() + i * 0.035, d: 0.035, v: 0.12, f0: rr(1600, 2800), q: 5 });
      else if (m === 'fire') noise(o, { a: 0.01, d: 0.35, v: 0.2, type: 'highpass', f0: 2600, f1: 900 });
      else if (m === 'ember') noise(o, { a: 0.01, d: e.touch ? 0.25 : 0.4, v: e.touch ? 0.07 : 0.18, type: 'highpass', f0: 3200, f1: 1200 });
      else if (m === 'chain') for (let i = 0; i < 3; i++) tone(o, { type: 'triangle', t: now() + i * 0.06, f0: rr(1900, 2600), d: 0.18, v: e.touch ? 0.025 : 0.06 });
      else if (m === 'wax') return;
      else noise(o, { d: 0.18, v: 0.35, type: 'lowpass', f0: 500, f1: 150 });
      if (e.n === 'brazier') noise(o, { t: now() + 0.03, a: 0.02, d: 0.4, v: 0.15, type: 'highpass', f0: 2400 });
      if (e.n === 'shop_gold') SFX.gold(o); },
    // a mechanism catches: a click, then the grind of stone starting to move
    click: (o) => { tone(o, { f0: 700, f1: 420, d: 0.06, v: 0.3 }); noise(o, { d: 0.05, v: 0.25, type: 'highpass', f0: 1800 }); tone(o, { f0: 90, f1: 60, a: 0.12, d: 0.5, v: 0.25 }); },
    // a cache opening: a rumble, falling stones and a chime
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
    unseal: (o) => { tone(o, { type: 'square', f0: 110, f1: 70, d: 0.14, v: 0.16 }); noise(o, { t: now() + 0.05, d: 0.18, v: 0.2, type: 'lowpass', f0: 1400, f1: 400 }); [660, 988].forEach((f, i) => tone(o, { type: 'triangle', f0: f, t: now() + 0.18 + i * 0.1, d: 0.9, v: 0.1 })); },
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
    ui: (o) => tone(o, { type: 'triangle', f0: 1200, d: 0.04, v: 0.06 }), ask: (o) => SFX.ui(o),
    equip: (o) => { noise(o, { d: 0.08, v: 0.2, f0: 1600, q: 2 }); tone(o, { type: 'triangle', f0: 900, d: 0.1, v: 0.06 }); },
    toss: (o) => noise(o, { d: 0.12, v: 0.15, type: 'lowpass', f0: 1200, f1: 300 }),
    buy: (o) => SFX.gold(o), trade: (o) => SFX.gold(o),
    // the townsfolk (TASKS 1015): the anvil rings on the smith's blow; a few soft murmured syllables when someone speaks up
    // a scroll read aloud (TASKS 1007): a rising airy shimmer under the teleport's own sound
    // a quest (TASKS 1017): a short horn when taken, a rising fanfare when done, the coins' chime when turned in
    quest: (o, e) => { if (e.s === 'turn') SFX.gold(o); else (e.s === 'done' ? [523, 659, 784, 1047] : [392, 523]).forEach((f, i) => tone(o, { type: 'triangle', f0: f, t: now() + i * 0.1, d: 0.35, v: 0.06 })); },
    // a quest's keepsake picked up (TASKS 1020): three bright notes up
    qitem: (o) => [659, 880, 1175].forEach((f, i) => tone(o, { type: 'triangle', f0: f, t: now() + i * 0.07, d: 0.4, v: 0.06 })),
    // a workshop's work (TASKS 1013): the anvil rings for a reforge; an enchantment chimes up, or falls apart in a hiss
    craft: (o, e) => { if (e.kind === 'forge') SFX.anvil(o); else if (e.ok) [660, 990, 1320].forEach((f, i) => tone(o, { type: 'triangle', f0: f, t: now() + i * 0.08, d: 0.5, v: 0.05 })); else { noise(o, { d: 0.5, v: 0.18, type: 'bandpass', f0: 2400, f1: 500, q: 2 }); tone(o, { f0: 400, f1: 120, d: 0.5, v: 0.06 }); } },
    // a waystone wakes (TASKS 1009): a low stone hum under a bright rising chime
    waystone: (o) => { tone(o, { f0: 110, f1: 165, a: 0.05, d: 1.1, v: 0.08 }); [880, 1320, 1760].forEach((f, i) => tone(o, { type: 'triangle', f0: f, t: now() + i * 0.1, d: 0.7, v: 0.05 })); },
    read: (o) => { noise(o, { a: 0.6, d: 1.0, v: 0.08, type: 'bandpass', f0: 600, f1: 3200, q: 3 }); tone(o, { f0: 330, f1: 660, a: 0.8, d: 0.8, v: 0.05 }); },
    anvil: (o) => { noise(o, { d: 0.03, v: 0.25, type: 'highpass', f0: 2500 }); [1180, 1630, 2470].forEach((f, i) => tone(o, { type: 'triangle', f0: f, d: 0.5 - i * 0.1, v: 0.05 - i * 0.012 })); },
    say: (o, e) => { const b = e.role === 'child' ? 330 : e.role === 'sweeper' || e.role === 'enchanter' ? 250 : 150; for (let i = 0; i < 3; i++) tone(o, { type: 'triangle', f0: b * rr(0.9, 1.15), f1: b * rr(0.8, 1), t: now() + i * 0.09, d: 0.08, v: 0.035 }); },
    shop: (o) => [1568, 2093].forEach((f, i) => tone(o, { type: 'triangle', f0: f, t: now() + i * 0.14, d: 0.5, v: 0.07 })),
    // a hen startled by a blow (TASKS 1033): two quick rising squawks
    power: (o) => { tone(o, { f0: 330, f1: 520, d: 0.16, v: 0.05 }); },
    hen: (o) => [0, 0.11].forEach((dt, i) => tone(o, { type: 'square', f0: 700 + 120 * i, f1: 1100 + 160 * i, t: now() + dt, d: 0.07, v: 0.03 })),
  };
  // events heard everywhere on the floor (not attenuated by distance)
  const GLOBAL = new Set(['colerupt', 'shatter', 'lvl', 'unlock', 'unseal', 'die', 'floor', 'roar', 'bless', 'teleport', 'shop', 'buy', 'trade', 'nope', 'ui', 'equip', 'toss', 'drink', 'pickup', 'shard', 'shield', 'craft', 'quest', 'qitem']);
  const LIMIT = { rock: 0.07, step: 0.08, hit: 0.03, gold: 0.05, alert: 0.15, kill: 0.04, scorch: 0.12, pop: 0.05, spike: 0.1 };

  function play(e, S) {
    const f = SFX[e.k]; if (!f || ((e.k === 'bossphase' || e.k === 'ignite') && !S.run?.map?.cliff)) return;
    const gap = LIMIT[e.k] ?? 0.02, tn = now(); if (recent[e.k] && tn - recent[e.k] < gap) return; recent[e.k] = tn;
    let pan = 0, vol = 1;
    const R = S.run; if (R && R.cam && e.x !== undefined && !GLOBAL.has(e.k)) { const dx = e.x - (R.cam[0] + W / 2), dy = e.y - (R.cam[1] + H / 2);
      pan = dx / (W * 0.6); vol = Math.max(0, 1 - Math.max(0, Math.hypot(dx, dy * 1.4) - 500) / 900); if (vol < 0.03) return; }
    f(out(pan * 0.8, vol, e.k === 'step' ? 0.05 : 0.35), e); played++;
  }

  // ---- ambience: a drone and air per biome, plus sparse one-shots ----
  const BED = { dungeon: { f: 55, air: 500, one: 'drip' }, cave: { f: 50, air: 700, one: 'drip' }, crypt: { f: 49, air: 380, one: 'drip' }, lava: { f: 41, air: 260, one: 'ember' }, magma: { f: 38, air: 240, one: 'magma' }, arcane: { f: 62, air: 900, one: 'chime' } };
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
  // the magma caves' lava (TASKS 403): its sources rumble low and bubble, the nearest one heard, panned to its side and fading with
  // distance as the cave's fall does (304): a fall roars widest, a vent heaves and spits, a breach gurgles
  const LAVA_SOUND = { fall: { reach: 520, f: 170, v: 0.3, gap: [0.12, 0.45] }, vent: { reach: 360, f: 120, v: 0.22, gap: [0.3, 1.1] }, breach: { reach: 400, f: 150, v: 0.24, gap: [0.2, 0.7] } };
  function lavaAmbience(S, on) {
    const R = S.run, h = R?.hero;
    const sources = on ? (R.map.lavaFeatures || []).filter((q) => R.seen[Math.floor(q.y / DATA.TILE) * R.map.W + Math.floor(q.x / DATA.TILE)]) : [];
    let source = null, near = 1;
    for (const q of sources) { const d = Math.hypot(q.x - h.x, q.y - h.y) / LAVA_SOUND[q.kind].reach; if (d < near) { source = q; near = d; } }
    if (!lavaAmb && source) {
      const g = ctx.createGain(), pan = ctx.createStereoPanner(), filter = ctx.createBiquadFilter(), n = ctx.createBufferSource();
      g.gain.value = 0; filter.type = 'lowpass'; filter.frequency.value = 160; filter.Q.value = 0.9;
      n.buffer = noiseBuf; n.loop = true; n.connect(filter); filter.connect(g); g.connect(pan); pan.connect(dry); pan.connect(wet); n.start();
      lavaAmb = { g, pan, filter, next: 0 };
    }
    if (!lavaAmb) return;
    const K = source ? LAVA_SOUND[source.kind] : LAVA_SOUND.vent, amount = source ? (1 - near) ** 2 : 0;
    lavaAmb.g.gain.setTargetAtTime(amount * K.v * 4, now(), 0.3);
    if (source) lavaAmb.filter.frequency.setTargetAtTime(K.f, now(), 0.4);
    lavaAmb.pan.pan.setTargetAtTime(source ? Math.max(-0.8, Math.min(0.8, (source.x - h.x) / 250)) : 0, now(), 0.2);
    if (source && now() > lavaAmb.next) {
      lavaAmb.next = now() + rr(...K.gap);
      const o = out((source.x - h.x) / 350, amount * 0.6, 0.45), f = rr(90, 170);
      tone(o, { f0: f, f1: f * rr(1.8, 2.6), a: 0.01, d: rr(0.08, 0.16), v: 0.16 });
      if (source.kind !== 'breach' && Math.random() < 0.4) noise(o, { t: now() + 0.1, d: 0.05, v: 0.05, f0: rr(1500, 3000), q: 3 });
    }
  }
  // the roof's drops land as the scene draws them (m.drips, scene.js DRIP_FALL): a high tick on stone, a lower plop with a bubble
  // in the water, each drop its own pitch, panned and faded by where it falls on screen
  function drips(S, on) {
    const R = S.run, last = dripT; dripT = S.t; if (!on || last < 0 || S.t - last > 0.5 || S.t <= last) return;
    for (const q of R.map.drips || []) { if (Math.floor((S.t - q.ph) / q.p) === Math.floor((last - q.ph) / q.p)) continue;
      const dx = q.x - (R.cam[0] + W / 2), dy = q.y - (R.cam[1] + H / 2), vol = 1 - Math.hypot(dx, dy * 1.4) / 1100; if (vol <= 0 || !R.seen[Math.floor(q.y / DATA.TILE) * R.map.W + Math.floor(q.x / DATA.TILE)]) continue;
      const o = out(dx / (W * 0.6), vol * vol, 0.7), f = 900 + (q.x * 7 + q.y * 3) % 900;
      if (q.wet) { tone(o, { f0: f * 0.75, f1: f * 1.6, a: 0.004, d: 0.07, v: 0.07 }); tone(o, { t: now() + 0.05, f0: f * 1.1, f1: f * 1.9, d: 0.05, v: 0.03 }); }
      else { tone(o, { f0: f * 1.5, f1: f * 0.9, d: 0.035, v: 0.05 }); noise(o, { d: 0.03, v: 0.03, type: 'highpass', f0: 4000 }); } }
  }
  function ambience(S) {
    const R = S.run, on = !!R && ['play', 'inv', 'shop', 'pause'].includes(S.screen), biome = on ? R.map.biome : null;
    waterAmbience(S, on && S.screen === 'play'); lavaAmbience(S, on && S.screen === 'play'); drips(S, on && S.screen === 'play');
    echo.gain.setTargetAtTime(biome === 'cave' || biome === 'magma' ? 0.6 : 0, now(), 0.5);
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
      // the magma caves (TASKS 404): the rock creaks and cracks in the heat, a dull knock and a dry split, now and then embers
      if (amb.one === 'magma') { if (Math.random() < 0.6) { tone(o, { f0: rr(70, 95), f1: rr(38, 50), d: rr(0.12, 0.22), v: 0.14 }); noise(o, { t: now() + rr(0, 0.04), d: rr(0.02, 0.05), v: 0.07, type: 'highpass', f0: rr(1800, 3200) });
          if (Math.random() < 0.5) noise(o, { t: now() + rr(0.08, 0.2), d: 0.03, v: 0.04, type: 'highpass', f0: rr(2500, 4000) }); }
        else { for (let i = 0; i < 5; i++) noise(o, { t: now() + i * rr(0.02, 0.09), d: 0.02, v: 0.06, f0: rr(2000, 5000), q: 4 }); noise(o, { a: 0.3, d: 1.2, v: 0.08, type: 'lowpass', f0: 200 }); } }
      if (amb.one === 'chime') tone(o, { f0: [1047, 1319, 1568, 1976][Math.floor(rr(0, 4))], a: 0.02, d: 1.2, v: 0.03 }); }
    // a heartbeat while the hero is low on health
    if (on && S.screen === 'play' && R.hero.deadT < 0) { const st = window.SIM && SIM.Q.stats ? SIM.Q.stats(R.hero, S.meta) : null, f = st ? R.hero.hp / st.maxHp : 1;
      if (f < 0.3 && now() > beatT) { beatT = now() + 0.55 + 0.6 * f / 0.3; const o = out(0, 0.8, 0.1); tone(o, { f0: 62, f1: 40, d: 0.12, v: 0.5 }); tone(o, { f0: 55, f1: 36, t: now() + 0.16, d: 0.14, v: 0.4 }); } }
  }

  function update(S) {
    // (re-review of PR 62) idle time may never come at 60 fps on the Deck: built within a second anyway; and nothing is played
    // until the context runs: sounds queued on a suspended one all went off at once when it resumed
    if (!ctx && !asked) { asked = true; if (window.requestIdleCallback) requestIdleCallback(prepare, { timeout: 1000 }); else setTimeout(prepare, 0); }
    if (!ctx || !live || ctx.state !== 'running' || !S || S.demo) { if (S) lastT = S.t; return; }
    const M = S.meta || {}, g = M.mute ? 0 : 0.7 * (M.vol ?? 1); muted = !!M.mute;
    if (g !== gainNow) { master.gain.setTargetAtTime(g, ctx.currentTime, 0.05); gainNow = g; }
    if (S.run !== lastRun && S.run && lastRun && S.t < lastT) lastT = -1;
    if (S.t < lastT) lastT = S.t;
    lastRun = S.run;
    for (const e of S.ev) if (e.t > lastT) play(e, S);
    lastT = S.t;
    ambience(S);
  }

  window.AUDIO = { update, start: init, get live() { return live; }, get muted() { return muted; }, get played() { return played; }, get state() { return ctx ? ctx.state : 'none'; } };
})();
