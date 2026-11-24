const D = require('../../live/data.js'), DG = require('../../live/dungeon.js');
const TILE = D.TILE || 32, W_HALF = D.PROP_W.bookshelf / 2;
const maxSeed = +(process.argv[2] || 200);
const stats = { libs: 0, free: 0, freeSolo: 0 };
const rows = [];
for (let sd = 1; sd <= maxSeed; sd++) for (let f = 1; f <= 6; f++) {
  const m = DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode: 'campaign', town: 1, runSeed: sd, events: ['library'] });
  const ev = (m.events || []).find((e) => e.id === 'library'); if (!ev) continue;
  const r = m.rooms[ev.room !== undefined ? ev.room : ev.r]; if (!r) continue;
  const shelves = m.decor.filter((d) => d.n === 'bookshelf' && d.lib && d.r === r.id);
  stats.libs++;
  const backY = r.y * TILE + 22;
  const free = shelves.filter((d) => Math.abs(d.y - backY) > 4);
  if (!free.length) continue;
  stats.free++;
  if (free.length === shelves.length && shelves.length === 1) stats.freeSolo++;
  for (const d of free) {
    const cx = Math.floor(d.x / TILE), cy = Math.floor(d.y / TILE);
    let gapL = 0, gapR = 0;
    for (let x = cx - 2; x >= r.x; x--) gapL++;
    for (let x = cx + 2; x < r.x + r.w; x++) gapR++;
    rows.push(`seed ${sd} floor ${f} room ${r.id} (${r.x},${r.y} ${r.w}x${r.h}) shelf cell ${cx},${cy} row ${cy - r.y} of top, gapL ${gapL} gapR ${gapR} shelves ${shelves.length}`);
  }
}
console.log(JSON.stringify(stats)); console.log(rows.slice(0, 40).join('\n'));
