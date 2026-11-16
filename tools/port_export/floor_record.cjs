// A generated floor as the dump writes it. The map keeps every field genFloor returns except the deprecated ones the
// port does not take (each is checked to still hold nothing); its cells are rows of digits, one cell kind a digit. The
// summary is what structure and statistics are compared by, and every floor has one, with or without its map.
const { canonical, documentText, hashOf } = require('./canonical_json.cjs');

const DEPRECATED_EMPTY_LISTS = ['rugs', 'ambush'];
const DEPRECATED_NULLS = ['way'];
const DEPRECATED_TRY_MARKS = ['loose'];
const POINTS = ['start', 'exitRoom', 'exit', 'spawn', 'sanct', 'up', 'down'];
const PLAN = ['biome', 'arch', 'lay', 'ftype', 'ftype2', 'mod', 'bossType', 'wander', 'secretsWanted'];
const MEASURES = ['walk', 'lava', 'deep'];

function cellRows(map) {
  if (map.cells.some((cell) => !Number.isInteger(cell) || cell < 0 || cell > 9)) throw new Error('floor_record: a cell kind is not one digit');
  return Array.from({ length: map.H }, (_, row) => map.cells.slice(row * map.W, (row + 1) * map.W).join(''));
}

function dumpedMap(map, place) {
  for (const field of DEPRECATED_EMPTY_LISTS) if (map[field].length) throw new Error(`floor_record: ${place}: the deprecated ${field} is not empty`);
  for (const field of DEPRECATED_NULLS) if (map[field] !== null) throw new Error(`floor_record: ${place}: the deprecated ${field} is not null`);
  const out = { ...map, cells: cellRows(map) };
  for (const field of [...DEPRECATED_EMPTY_LISTS, ...DEPRECATED_NULLS, ...DEPRECATED_TRY_MARKS]) delete out[field];
  return canonical(out, place);
}

function countBy(list, keyOf) {
  const counts = {};
  for (const item of list) { const key = String(keyOf(item)); counts[key] = (counts[key] || 0) + 1; }
  return counts;
}

const pick = (map, fields) => Object.fromEntries(fields.map((field) => [field, map[field] === undefined ? null : map[field]]));

function summaryOf(map) {
  const lists = Object.fromEntries(Object.keys(map).filter((field) => Array.isArray(map[field]) && field !== 'cells').map((field) => [field, map[field].length]));
  return {
    size: [map.W, map.H],
    plan: pick(map, PLAN),
    measures: pick(map, MEASURES),
    cells: countBy(map.cells, (cell) => cell),
    rooms: { count: map.rooms.length, byType: countBy(map.rooms, (room) => room.type) },
    enemies: { byType: countBy(map.enemies, (enemy) => enemy.type), elites: map.enemies.filter((enemy) => enemy.elite).length, guards: map.enemies.filter((enemy) => enemy.guard).length },
    chests: countBy(map.chests, (chest) => chest.tier),
    events: (map.events || []).map((event) => event.id),
    lists,
    points: pick(map, POINTS),
  };
}

function floorRecord({ floor, floorSeed, options, probe, keepMap, place }) {
  const map = dumpedMap(probe.map, place);
  const record = { floor, floorSeed, options, attempts: probe.attempts, stages: probe.stages, summary: summaryOf(probe.map), mapHash: hashOf(documentText(map)) };
  if (keepMap) record.map = map;
  return record;
}

module.exports = { floorRecord };
