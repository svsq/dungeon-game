// live/pad.js — the gamepad and the Steam Deck (R-08; TASKS 247–252 redone on the current menus). A page-side layer, like
// audio.js: the pad speaks through the same virtual input as the keyboard and the mouse (one-shot key codes, the pointer, its
// press and clicks), so the sim, the bot and the checks never see it. index.html makes it with PADIN.create(io) and polls it
// every frame; the HUD reads window.PAD (pad mode on, the drawn cursor, the button names) and nothing else.
//
// In play: left stick walks (8 ways, like the keys), the right stick aims around the hero, R2 strikes (held), L2 is the class's
// right-click power, A acts (E), B dashes, Y R1 L1 the abilities 1 2 3, X is left free (the player's choice, TASKS 252), the
// dpad: ↑ health potion, ↓ mana potion, ← the scroll home, → the journal; View the hero, Menu the pause, L3 the sound.
// In the menus: the screens the keyboard already walks (FOCUS below) get arrows, Enter and Escape; on the others the dpad or
// the left stick jumps the pointer to the next button the screen hit-tests (DATA.hitUI, recorded while the sim steps), A
// clicks and holds it (a drag in the bag), B is Escape, Y the right click, the right stick moves the pointer freely.
(function (root) {
  // W3C 'standard' order: 0 A 1 B 2 X 3 Y 4 L1 5 R1 6 L2 7 R2 8 View 9 Menu 10 L3 11 R3 12–15 dpad ↑↓←→
  const B = { A: 0, B: 1, X: 2, Y: 3, L1: 4, R1: 5, L2: 6, R2: 7, VIEW: 8, MENU: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
  // the screens whose own keyboard focus handles ↑↓←→, Enter and Escape (sim_ui.js): the pad sends those, the pointer stays put
  const FOCUS = new Set(['menu', 'classes', 'stats', 'load', 'settings', 'news']);
  // a screen's first button for the pointer when it opens: these ids first, then the screen's own focus, then the first button
  const FIRST = ['next', 'act', 'resume', 'go', 'continue', 'menu', 'stay'];
  const AIM = 260, DEAD = 0.25, REPEAT0 = 0.38, REPEAT = 0.14;

  // a pad seen through one view: 'standard' as is; without it (Firefox on Linux, raw evdev order) the xpad layout: buttons
  // A B X Y L1 R1 View Menu Guide L3 R3, axes LX LY L2 RX RY R2 hatX hatY, the triggers resting at −1 (or 0 until touched)
  const view = (gp) => {
    const bt = gp.buttons || [], ax = gp.axes || [], bp = (i) => !!(bt[i] && (bt[i].pressed || bt[i].value > 0.5));
    if (gp.mapping === 'standard' || ax.length < 6) return { std: gp.mapping === 'standard', ax: [ax[0] || 0, ax[1] || 0, ax[2] || 0, ax[3] || 0], press: bp };
    const XP = [0, 1, 2, 3, 4, 5, -1, -1, 6, 7, 9, 10], hx = ax[6] || 0, hy = ax[7] || 0;
    return { std: false, ax: [ax[0] || 0, ax[1] || 0, ax[3] || 0, ax[4] || 0],
      press: (i) => (i === 6 ? (ax[2] || 0) > 0.3 : i === 7 ? (ax[5] || 0) > 0.3 : i === 12 ? hy < -0.5 : i === 13 ? hy > 0.5 : i === 14 ? hx < -0.5 : i === 15 ? hx > 0.5 : XP[i] >= 0 && bp(XP[i])) };
  };
  const busy = (v) => { for (let i = 0; i < 4; i++) if (Math.abs(v.ax[i]) > 0.3) return true; for (let i = 0; i < 16; i++) if (v.press(i)) return true; return false; };   // (no arrays a frame, review of PR 62)
  const stick = (x, y) => { const m = Math.hypot(x, y); return m < DEAD ? [0, 0, 0] : [x / m, y / m, Math.min(1, (m - DEAD) / (1 - DEAD))]; };

  // io: { keys, ptr, pend, VW, VH, play(), start(), dev() } — index.html's own input state, written the way its listeners write it
  function create(io) {
    const P = { active: 0, at: -99, n: 0, px: io.VW / 2, py: io.VH / 2, mode: 'kbm', screen: '', raw: null }; root.PAD = P;
    Object.defineProperty(P, 'raw', { get: () => { const gp = P.gp; return gp ? { id: (gp.id || '').slice(0, 40), ax: (gp.axes || []).map((v) => +v.toFixed(2)), b: (gp.buttons || []).map((b, i) => (b.pressed ? i : null)).filter((v) => v !== null) } : null; } });
    const { keys, ptr, pend } = io, kb = {};   // kb: the keyboard's own arrows, so an idle stick never lets go of a held key
    addEventListener('keydown', (e) => { if (e.isTrusted) kb[e.code] = 1; }, true); addEventListener('keyup', (e) => { kb[e.code] = 0; }, true);
    let idx = -1, on = 0, clock = 0, prev = [], held = new Set(), moveK = {}, nav = { k: '', t: 0, n: 0 }, last = '', aim = [1, 0, 0.6], aimT = -99, ptrDown = 0;
    // the buttons the screen hit-tests this step: DATA.hitUI is called by every screen with its whole list (sim_ui.js), so the
    // list is read off that call instead of copying each screen's layout here
    let rects = [], rectsNow = [], rectsOf = '', got = 0;   // rectsOf: the screen they were read on
    const hit0 = root.DATA.hitUI;
    root.DATA.hitUI = (rs, x, y) => { if (P.cap) { got = 1; for (const b of rs) rectsNow.push(b); } return hit0(rs, x, y); };
    // called round every sim step (review of PR 62): the buttons are the last step's, not every step's of a frame, so a window
    // opened in the frame never keeps the screen before it in its list (play's debug buttons, the menu's)
    // the screen is the one the step began on (re-review of PR 62: read after the step, a click that opened the codex filed the
    // pause's buttons under the codex)
    let capOf = '';
    const stepBegin = () => { P.cap = 1; rectsNow = []; got = 0; const S = io.play(); capOf = S ? S.screen : ''; };
    const stepEnd = () => { P.cap = 0; if (got) { rects = rectsNow; rectsOf = capOf; } };

    const down = (c) => { keys[c] = 1; pend.keys.push(c); held.add(c); };
    const up = (c) => { if (held.has(c)) { keys[c] = 0; held.delete(c); } };
    const tap = (c) => pend.keys.push(c);
    const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    const walk = (dx, dy) => { const want = { ArrowLeft: dx < 0, ArrowRight: dx > 0, ArrowUp: dy < 0, ArrowDown: dy > 0 };
      for (const c of ARROWS) { if (want[c]) { keys[c] = 1; moveK[c] = 1; } else if (moveK[c]) { if (!kb[c]) keys[c] = 0; moveK[c] = 0; } } };
    const clear = () => { if (!on) return; on = 0; idx = -1; for (const c of held) keys[c] = 0; held.clear(); walk(0, 0); prev = [];
      if (ptrDown) { ptr.down = 0; ptrDown = 0; } P.active = 0; P.mode = 'kbm'; };
    // Steam can show the page two pads (its virtual pad and the Deck's own): the one last touched leads
    const pick = (pads) => {
      const cur = pads.find((p) => p.index === idx);
      if (cur && busy(view(cur))) return cur;
      const b = pads.find((p) => busy(view(p)));
      if (b) { if (cur) clear(); idx = b.index; return b; }
      if (cur) return cur;
      const d = pads.find((p) => p.mapping === 'standard') || pads[0]; idx = d.index; return d;
    };
    const heroAt = (S) => { const R = S.run, h = R && R.hero; if (!h || !R.cam || !root.SIMX) return null; const p = root.SIMX.toPx(R, h.x, h.y - 40); return [p.px, p.py]; };
    const onBtns = () => (rectsOf === last ? rects : []).filter((b) => b.on !== false && b.w > 0 && b.h > 0);
    // the view may be taller than 1080 (16:10, PR 57): a window's buttons are hit-tested in its frame, uiDy px above where the page
    // shows them, and the pointer moves in the page's view (moved: the sim takes the hover from it, as from the mouse)
    const VW = () => (root.SIM && SIM.VIEW ? SIM.VIEW.W : io.VW), VH = () => (root.SIM && SIM.VIEW ? SIM.VIEW.H : io.VH);
    const dyNow = () => (root.DATA && DATA.uiDy && root.SIM && SIM.VIEW ? DATA.uiDy(last, SIM.VIEW.H) : 0);
    const centre = (b) => [b.x + b.w / 2, b.y + b.h / 2];
    const goTo = (b) => { if (!b) return; const [x, y] = centre(b); ptr.x = x; ptr.y = y + dyNow(); ptr.moved = 1; };
    // the nearest button along the direction, the one straight ahead first
    const snap = (dx, dy) => {
      const bs = onBtns(), S = io.play(); if (!bs.length) return;
      const hv = bs.find((b) => b.id && b.id === (S && S.hover)), [cx, cy] = hv ? centre(hv) : [ptr.x, ptr.y - dyNow()];
      let best = null, q0 = Infinity;
      for (const b of bs) { if (b === hv) continue; const [bx, by] = centre(b), rx = bx - cx, ry = by - cy, along = rx * dx + ry * dy;
        if (along < 6) continue; const q = along + Math.abs(rx * dy - ry * dx) * 2.5; if (q < q0) { q0 = q; best = b; } }
      goTo(best);
    };
    const firstBtn = (S) => { const bs = onBtns(); return FIRST.map((id) => bs.find((b) => b.id === id)).find(Boolean) || bs.find((b) => b.id && b.id === S.focus) || bs[0]; };

    // its own clock in real seconds (review of PR 62): on the sim's, the dev pause (P) froze the dpad's repeat in the menus
    function poll(dt, simT) {
      clock += dt;
      const pads = Array.from((navigator.getGamepads && navigator.getGamepads()) || []).filter((p) => p && p.connected !== false);
      P.n = pads.length;
      if (!pads.length) { clear(); return; }
      const gp = pick(pads), V = view(gp), pr = V.press, ax = V.ax, S = io.play(); on = 1;
      const was = (i) => !!prev[i], edge = (i) => pr(i) && !was(i), rel = (i) => !pr(i) && was(i);
      if (busy(V)) { P.at = clock; P.mode = 'pad'; }
      P.active = P.mode === 'pad' ? 1 : 0;
      P.map = (gp.mapping || '—') + (V.std ? '' : ' (xpad)');
      P.gp = gp;   // (P.raw, the dev line's view of it, is built only when read)
      // (TASKS 1867) a pad press starts the sound as a key or a click does: with the pad alone it never started. Asked again on
      // every press until it runs (review of PR 62: a browser that does not take a pad's press for a gesture keeps it suspended)
      if (root.AUDIO && AUDIO.start && AUDIO.state !== 'running') for (let i = 0; i < 16; i++) if (edge(i)) { AUDIO.start(); break; }
      if (!S) { if (edge(0) || edge(1) || edge(2) || edge(3) || edge(7) || edge(9)) io.start(); for (let i = 0; i < 16; i++) prev[i] = pr(i); return; }
      const scr = S.screen || 'play', play = scr === 'play' && S.run, focus = FOCUS.has(scr);
      // a screen entered anew waits for its own buttons: the last visit's (another talk's) stay behind (re-review of PR 62)
      if (scr !== last) { last = scr; rects = []; rectsOf = ''; nav.k = ''; for (const c of held) keys[c] = 0; held.clear(); walk(0, 0); if (ptrDown) { ptr.down = 0; ptrDown = 0; }
        if (P.active && !play && !focus) { P.pendSnap = 1; } }
      if (P.pendSnap && rectsOf === scr && rects.length) { P.pendSnap = 0; goTo(firstBtn(S)); }
      const [lx, ly, lm] = stick(ax[0], ax[1]), [rx, ry, rm] = stick(ax[2], ax[3]);
      if (pr(B.R3) && !was(B.R3)) io.dev();
      if (edge(B.L3)) tap('KeyM');   // the sim's mute (PR 57), a one-shot key as the others: no DOM event and no key left held
      if (edge(B.MENU)) tap('Escape');
      if (play) {
        // walking: the stick's angle in eight sectors, as the keys give (the sim's run is 8-way)
        if (lm > 0) { const a = Math.round(Math.atan2(ly, lx) / (Math.PI / 4)) * (Math.PI / 4), dx = Math.round(Math.cos(a)), dy = Math.round(Math.sin(a)); walk(dx, dy); }
        else walk(0, 0);
        // aiming: the right stick points the pointer around the hero; let go, the aim stays where it was, and with no right stick
        // for a while it follows the walk, so a pad player who only walks strikes ahead of himself
        if (rm > 0) { aim = [rx, ry, 0.45 + 0.55 * rm]; aimT = clock; } else if (lm > 0 && clock - aimT > 1.2) aim = [lx, ly, 0.6];
        const at = heroAt(S); if (at && (rm > 0 || lm > 0 || P.active)) { ptr.x = Math.max(0, Math.min(VW(), at[0] + aim[0] * AIM * aim[2])); ptr.y = Math.max(0, Math.min(VH(), at[1] + aim[1] * AIM * aim[2])); ptr.moved = 1; }
        if (edge(B.R2)) { ptr.down = 1; ptr.click = 1; ptrDown = 1; } else if (rel(B.R2) && ptrDown) { ptr.down = 0; ptrDown = 0; }
        if (edge(B.L2)) ptr.rclick = 1;
        if (edge(B.A)) down('KeyE'); else if (rel(B.A)) up('KeyE');
        if (edge(B.B)) down('Space'); else if (rel(B.B)) up('Space');
        if (edge(B.Y)) pend.slot = 1; if (edge(B.R1)) pend.slot = 2; if (edge(B.L1)) pend.slot = 3;
        if (edge(B.UP)) tap('KeyQ'); if (edge(B.DOWN)) tap('KeyR'); if (edge(B.LEFT)) tap('KeyT'); if (edge(B.RIGHT)) tap('KeyJ');
        if (edge(B.VIEW)) tap('KeyI');
      } else {
        walk(0, 0);
        // menus: the dpad, or the left stick pushed well over, steps with a repeat while held
        const dx = (pr(B.RIGHT) ? 1 : 0) - (pr(B.LEFT) ? 1 : 0) || (Math.abs(ax[0]) > 0.6 && Math.abs(ax[0]) > Math.abs(ax[1]) ? Math.sign(ax[0]) : 0);
        const dy = (pr(B.DOWN) ? 1 : 0) - (pr(B.UP) ? 1 : 0) || (Math.abs(ax[1]) > 0.6 && Math.abs(ax[1]) >= Math.abs(ax[0]) ? Math.sign(ax[1]) : 0);
        const k = dx || dy ? dx + ',' + dy : '';
        let fire = false;
        if (k !== nav.k) { nav.k = k; nav.t = clock; nav.n = 0; fire = !!k; } else if (k && clock - nav.t > (nav.n ? REPEAT : REPEAT0)) { nav.t = clock; nav.n++; fire = true; }
        if (fire) { if (focus) tap(dy > 0 ? 'ArrowDown' : dy < 0 ? 'ArrowUp' : dx > 0 ? 'ArrowRight' : 'ArrowLeft'); else snap(dx, dy); }
        if (rm > 0) { ptr.x = Math.max(0, Math.min(VW(), ptr.x + rx * rm * rm * 1300 * dt)); ptr.y = Math.max(0, Math.min(VH(), ptr.y + ry * rm * rm * 1300 * dt)); ptr.moved = 1; }
        if (focus) { if (edge(B.A)) tap('Enter'); if (edge(B.Y) && scr === 'load') tap('Delete'); if (edge(B.R2)) { ptr.down = 1; ptr.click = 1; ptrDown = 1; } else if (rel(B.R2) && ptrDown) { ptr.down = 0; ptrDown = 0; } }
        else { if (edge(B.A) || edge(B.R2)) { ptr.down = 1; ptr.click = 1; ptrDown = 1; } else if (ptrDown && !pr(B.A) && !pr(B.R2)) { ptr.down = 0; ptrDown = 0; }
          if (edge(B.Y) || edge(B.L2)) ptr.rclick = 1; }
        if (edge(B.B)) tap('Escape');
        if (edge(B.VIEW) && (scr === 'inv' || scr === 'journal')) tap('Escape');
        if (edge(B.L1)) pend.wheel = -1; if (edge(B.R1)) pend.wheel = 1;
      }
      for (let i = 0; i < 16; i++) prev[i] = pr(i);
      P.px = ptr.x; P.py = ptr.y; P.screen = scr; P.focusScreen = focus;
    }
    // a real key or mouse hands the hints back to them; a pad press takes them again
    const kbm = () => { P.mode = 'kbm'; P.active = 0; };
    addEventListener('keydown', (e) => { if (e.isTrusted) kbm(); }, true);
    addEventListener('mousedown', kbm, true);
    let mx = -1, my = -1; addEventListener('mousemove', (e) => { if (mx >= 0 && Math.hypot(e.clientX - mx, e.clientY - my) > 12) kbm(); mx = e.clientX; my = e.clientY; }, true);
    return { poll, stepBegin, stepEnd, state: P };
  }
  // pad names for the hint lines (hud.js): one table, the Steam Deck's own button names
  const NAMES = { A: 'A', B: 'B', X: 'X', Y: 'Y', L1: 'L1', R1: 'R1', L2: 'L2', R2: 'R2', VIEW: 'View', MENU: 'Menu', L3: 'L3', UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→' };
  root.PADIN = { create, B, NAMES, FOCUS };
})(window);
