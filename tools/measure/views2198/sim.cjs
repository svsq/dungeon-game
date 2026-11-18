// the sim's view flag (h.back) after an input sequence: walk a way, then walk sideways; prints the back flag per phase
const SIM = require('../../../live/sim.js'), X = SIM.X || globalThis.SIMX;
const { spawn, newRun, TILE } = X;
const seqs = { 'up then left': [['up', 30], ['left', 60]], 'up then right': [['up', 30], ['right', 60]], 'down then left': [['down', 30], ['left', 60]], 'left only': [['left', 60]], 'up-left then left': [['up+left', 30], ['left', 60]] };
for (const cls of ['warrior', 'mage', 'archer']) for (const [nm, seq] of Object.entries(seqs)) {
  const S = spawn(0, {}), R = newRun(S, 'campaign', 91, { cls }); S.run = R; S.screen = 'play'; S.t = R.t = 10; R.en = [];
  const h = R.hero, m = R.map, cx = m.W >> 1, cy = m.H >> 1; for (let y = cy - 7; y <= cy + 7; y++) for (let x = cx - 9; x <= cx + 9; x++) m.cells[y * m.W + x] = 1; h.x = cx * TILE + 16; h.y = cy * TILE + 18;
  const res = [];
  for (const [k, n] of seq) { const inp = { px: 480, py: 270 }; for (const d of k.split('+')) inp[d] = 1; for (let i = 0; i < n; i++) SIM.step(S, inp); res.push(`${k}: back ${h.back} face ${h.face}`); }
  console.log(cls.padEnd(8), nm.padEnd(18), res.join(' | '));
}
