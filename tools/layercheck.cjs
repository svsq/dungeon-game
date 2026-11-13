// node tools/layercheck.cjs — the layers' borders (ARCHITECTURE.md §8, TASKS 504). Exit 2 on failure.
//   logic (data*, text*, dungeon*, sim*, modules): no page, render or clock at all — it runs in Node and replays exactly (a
//     call into the engine, G, fails there at once, so it is not looked for: the logic has a local G of its own);
//     the one `window` allowed is the IIFE's `typeof window !== 'undefined' ? window : globalThis`
//   render (scene*, hud, monsters, lib): no page but the global registry (window.ASSETS / SIZES / RIGS / …), no raw WebGL (G.gl),
//     no clock or randomness; from the sim only SIM.Q (reads) and its constants. scene_qa.js builds its states by running the sim
//     and may call it; it is held to the rest
//   platform (index.html, gl.js, audio.js) is not checked: it is what another engine replaces
const fs = require('fs'), path = require('path'), { code } = require('./jsscan.cjs');
const LIVE = path.join(__dirname, '..', 'live'), fails = [];
const files = fs.readdirSync(LIVE).filter((f) => f.endsWith('.js'));
const LOGIC = files.filter((f) => /^(data|text|dungeon|sim)(_\w+)?\.js$/.test(f) || f === 'modules.js');
const RENDER = files.filter((f) => /^scene(_\w+)?\.js$/.test(f) || ['hud.js', 'monsters.js', 'lib.js'].includes(f));
const PAGE = /(?<![.\w$])(document|localStorage|sessionStorage|navigator|location|performance|Date)\b(?!\s*:)|(?<![.\w$])(addEventListener|requestAnimationFrame|fetch|setTimeout|setInterval)\s*\(|Math\.random/;
const REGISTRY = new Set(['ASSETS', 'SIZES', 'RIGS', 'HUD', 'SCENE', 'LIB', 'MONSTERS', 'SCX', '__UI', '__ANCHORS', 'PAD']);   // PAD: the gamepad's state for the hints and its drawn pointer (pad.js), read only
const SIM_CONST = /^[A-Z][A-Z0-9_]*$/;
const scan = (f, each) => code(fs.readFileSync(path.join(LIVE, f), 'utf8'), true).split('\n').forEach((l, i) => each(l, `${f}:${i + 1}`));
for (const f of LOGIC) scan(f, (l, at) => {
  const s = l.replace(/typeof window !== '' \? window : globalThis/g, '');
  if (PAGE.test(s) || /\bwindow\b/.test(s)) fails.push(`${at}: the logic reaches the page: ${l.trim().slice(0, 90)}`);
  if (/(?<![.\w$])(LIB|SCENE|SCX|HUD|AUDIO|MONSTERS)\.\w/.test(s)) fails.push(`${at}: the logic reaches the render or the engine: ${l.trim().slice(0, 90)}`);
});
for (const f of RENDER) scan(f, (l, at) => {
  if (PAGE.test(l)) fails.push(`${at}: the render reaches the page: ${l.trim().slice(0, 90)}`);
  for (const m of l.matchAll(/\bwindow\.(\w+)/g)) if (!REGISTRY.has(m[1])) fails.push(`${at}: window.${m[1]} is not in the global registry`);
  if (/\bG\.gl\b/.test(l)) fails.push(`${at}: raw WebGL in the render: ${l.trim().slice(0, 90)}`);
  if (f !== 'scene_qa.js') for (const m of l.matchAll(/\bSIM\.(\w+)/g)) if (m[1] !== 'Q' && !SIM_CONST.test(m[1])) fails.push(`${at}: SIM.${m[1]} — the render asks the sim through SIM.Q`);
});
for (const f of fails) console.log('FAIL', f);
console.log(`layercheck: ${LOGIC.length} logic files, ${RENDER.length} render files, ${fails.length ? fails.length + ' failure(s)' : 'ok'}`);
process.exitCode = fails.length ? 2 : 0;
