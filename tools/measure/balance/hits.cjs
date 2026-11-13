// the hero's hits per kill of a plain monster and the damage over its health, per floor (TASKS 1195): ROOTDIR=$PWD HITS=out.jsonl
// NODE_OPTIONS="--require tools/measure/balance/hits.cjs" node tools/difficulty.cjs ... --no-cache; one json line per bot process
if (!process.env.HITS) return;
const SIM = require(process.env.ROOTDIR + '/live/sim.js'), fs = require('fs'), step0 = SIM.step, acc = {};
SIM.step = function (S, inp) { const r = step0.apply(this, arguments); const R = S.run; if (!R || R.town || !R.en) return r;
  for (const e of S.ev) { if (e.t !== S.t) continue;
    if (e.k === 'hit') { const m = R.en.find((o) => o.id === e.id); if (!m || m.elite || require(process.env.ROOTDIR + '/live/data.js').BOSSES[m.type]) continue; m._h = (m._h || 0) + 1; m._d = (m._d || 0) + e.n; }
    if (e.k === 'kill') { const m = R.en.find((o) => o.id === e.id); if (!m || m.elite || !m._h) continue; const a = acc[R.floor] || (acc[R.floor] = { k: 0, h: 0, over: 0 }); a.k++; a.h += m._h; a.over += m._d / m.max; } }
  return r; };
process.on('exit', () => fs.appendFileSync(process.env.HITS, JSON.stringify(acc) + '\n'));
