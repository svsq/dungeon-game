// evalq.mjs body (TASKS 1964): the cells of magma_fog_walk round the dark patches in its lava — m.cells codes, the crust, lavaUnder, seen,
// and every map list that names one of them
const PTS = [[515, 300], [605, 330], [685, 425]], T = DATA.TILE;
const S = (SCENE.QA().states.find((q) => q[0] === 'magma_fog_walk') || [])[1], R = S.run, m = R.map, cam = R.cam, out = { cam, seed: R.seed, floor: R.floor, mode: R.mode, pts: [] };
const crust = new Set(m.crust || []), under = new Set(m.lavaUnder || []);
const lists = Object.keys(m).filter((k) => Array.isArray(m[k]) && m[k].length && m[k].length < m.W * m.H / 2);
for (const [px, py] of PTS) { const wx = px + cam[0], wy = py + cam[1], cx = Math.floor(wx / T), cy = Math.floor(wy / T), grid = [];
  for (let y = cy - 2; y <= cy + 2; y++) { let s = ''; for (let x = cx - 3; x <= cx + 3; x++) { const k = y * m.W + x; s += (x === cx && y === cy ? '[' : ' ') + m.cells[k] + (crust.has(k) ? 'c' : under.has(k) ? 'u' : '.') + (R.seen[k] ? 's' : '-'); } grid.push(s); }
  const k = cy * m.W + cx, named = lists.filter((n) => m[n].some((v) => v === k || (v && typeof v === 'object' && (v.cell === k || (v.cells && v.cells.includes && v.cells.includes(k)) || (v.x !== undefined && Math.floor(v.x / T) === cx && Math.floor(v.y / T) === cy)))));
  out.pts.push({ px, py, world: [wx, wy], cell: [cx, cy], inCell: [wx - cx * T, wy - cy * T], grid, named }); }
return out;
