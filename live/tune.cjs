// node live/tune.cjs [path] — run the attract script headless and print its events (and optionally the path).
// Re-run after EVERY sim change: the demo must still reach its beats. Pass = SIM.demoCheck(S) if the sim defines it,
// else every pickup in S.got collected (no S.got: pass). Tune SCRIPT times here, not by eye.
// SIM.selfCheck() (optional) → [failure strings]: what the level data must satisfy after every placement pass (spawns in open
// space, every enemy able to reach the player, every pickup reachable…); any failure fails the run.
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
if (!isMainThread) return parentPort.postMessage(require('./sim.js').selfCheck(workerData));
const SIM = require('./sim.js');
// selfCheck's parts in workers, each with a sim of its own (TASKS 1697): no part leans on the state another left; at most 10 at
// once (TUNE_WORKERS), as more stalled the machine. --serial (or TUNE_SERIAL=1) runs them here one after another, as before
const SLOW = ['altarCheck', 'cacheGenCheck', 'floorTypeCheck', 'hazardCheck', 'genCheck', 'climbCheck', 'floorModCheck', 'chestCheck', 'secretRestCheck', 'playCheck', 'branchCheck'];
const serial = process.argv.includes('--serial') || !!process.env.TUNE_SERIAL || !SIM.selfChecks;
const parts = serial ? null : new Promise((done, fail) => { const names = SIM.selfChecks, res = [], rank = (n) => (SLOW.indexOf(n) + 1 || 99);
  const queue = names.map((_, i) => i).sort((a, b) => rank(names[a]) - rank(names[b])); let left = names.length;
  const go = () => { const i = queue.shift(); if (i === undefined) return;
    new Worker(__filename, { workerData: [names[i]] }).once('message', (m) => { res[i] = m; }).once('error', fail)
      .once('exit', (c) => { if (c || !res[i]) fail(new Error(`selfCheck ${names[i]}: its worker exited with ${c}`)); else if (!--left) done(res.flat()); else go(); }); };
  for (let k = +process.env.TUNE_WORKERS || Math.min(10, require('os').availableParallelism()); k > 0; k--) go(); });
const S = SIM.create(); const path = []; const n0 = (v) => (typeof v === 'number' ? v.toFixed(0) : '-');
while (S.t < SIM.L - 1e-6) { SIM.step(S, SIM.scriptInput(S.t, S)); if (S.steps % 6 === 0) path.push([S.t.toFixed(2), n0(S.x), n0(S.y), S.ground || '']); }
for (const e of (S.ev || []).filter((e) => e.k !== 'step' && e.k !== 'rustle')) console.log(e.k.padEnd(8), e.t.toFixed(2), n0(e.x), n0(e.y), e.v ? e.v.toFixed(0) : '');
const ok = SIM.demoCheck ? !!SIM.demoCheck(S) : (!S.got || S.got.every((g) => g >= 0));
const got = S.got ? `collected ${S.got.filter((g) => g >= 0).length}/${S.got.length}` : 'no pickups';
console.log(`${got}${S.hearts !== undefined ? '  hearts ' + S.hearts : ''}  end ${n0(S.x)},${n0(S.y)}${SIM.demoCheck ? '  demoCheck ' + (ok ? 'ok' : 'FAIL') : ''}`);
if (process.argv[2] === 'path') for (const p of path) console.log(p.join(' '));
// soft-bone weight maps are data, not art (TASKS 195): a colour pass that rescales them makes the cape and hair bend weaker
const fs = require('fs'), zlib = require('zlib'), pth = require('path'), dir = pth.join(__dirname, 'assets'), more = [];
const rgbaPng = (buf) => {
  let o = 8, w, h, idat = [];
  while (o < buf.length) { const n = buf.readUInt32BE(o), k = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + n);
    if (k === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); if (d[8] !== 8 || d[9] !== 6 || d[12]) return null; }
    if (k === 'IDAT') idat.push(d); o += 12 + n; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * 4), st = w * 4;
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)], r = y * (st + 1) + 1;
    for (let x = 0; x < st; x++) { const a = x >= 4 ? px[y * st + x - 4] : 0, b = y ? px[(y - 1) * st + x] : 0, c = x >= 4 && y ? px[(y - 1) * st + x - 4] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      px[y * st + x] = raw[r + x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]; } }
  return px;
};
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('_w.png'))) {
  const px = rgbaPng(fs.readFileSync(pth.join(dir, f))); if (!px) { more.push(`${f}: not 8-bit RGBA`); continue; }
  const mx = [0, 0, 0]; for (let i = 0; i < px.length; i += 4) for (let c = 0; c < 3; c++) mx[c] = Math.max(mx[c], px[i + c]);
  if (mx.some((m) => m !== 0 && m !== 255)) more.push(`${f}: weight channel max ${mx.join('/')}, must be 255 or 0`);
}
// the game's texts (TASKS 1141): no Cyrillic in code outside live/text_<lang>.js, every key in the table, none unused;
// and the layers' borders (TASKS 504): tools/layercheck.cjs
for (const t of ['textcheck.cjs', 'layercheck.cjs']) try { require('child_process').execFileSync('node', [pth.join(__dirname, '..', 'tools', t)], { stdio: 'pipe' }); }
catch (e) { more.push(t + ': ' + String(e.stdout).trim().split('\n').slice(-4).join(' | ')); }
Promise.resolve(parts || SIM.selfCheck()).then((got) => { const self = got.concat(more);
  for (const f of self) console.log('FAIL', f);
  if (SIM.selfCheck) console.log(`selfCheck ${self.length ? self.length + ' failure(s)' : 'ok'}`);
  process.exitCode = ok && !self.length ? 0 : 1; });
