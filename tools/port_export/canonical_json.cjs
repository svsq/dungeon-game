// The canonical text of a dump: keys in the order JS itself gives integer keys (ascending numbers first) and then the
// rest by code unit, fields that are undefined left out, numbers as JS prints them (the shortest form that reads back
// the same double). Anything JSON would silently change (NaN, Infinity, a function, a Set, a hole) stops the dump.
// A fingerprint is a short hash of any value the generator holds, Sets, Maps, typed arrays and functions included.
const crypto = require('crypto');

const INTEGER_KEY = /^(0|[1-9][0-9]*)$/;
const HASH_LENGTH = 12;

function keyOrder(a, b) {
  const aInteger = INTEGER_KEY.test(a), bInteger = INTEGER_KEY.test(b);
  if (aInteger && bInteger) return Number(a) - Number(b);
  if (aInteger !== bInteger) return aInteger ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function canonical(value, place = '') {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`canonical_json: ${place} is ${value}, which JSON cannot hold`);
    return value;
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((item, index) => {
    if (item === undefined) throw new Error(`canonical_json: ${place}[${index}] is undefined`);
    return canonical(item, `${place}[${index}]`);
  });
  if (Object.prototype.toString.call(value) !== '[object Object]') throw new Error(`canonical_json: ${place} is a ${Object.prototype.toString.call(value)}, not plain JSON`);
  const out = {};
  for (const key of Object.keys(value).sort(keyOrder)) if (value[key] !== undefined) out[key] = canonical(value[key], `${place}.${key}`);
  return out;
}

// Objects down to `objectDepth` and arrays of objects or strings down to `arrayDepth` take a line per entry; anything
// deeper is one line, so a changed room, enemy or row of cells is one changed line.
const LAYOUT = { objectDepth: 3, arrayDepth: 4, indent: '  ' };

function isListOfLines(array) {
  return array.some((item) => item !== null && (typeof item === 'object' || typeof item === 'string'));
}

function layoutText(value, depth = 0) {
  const pad = LAYOUT.indent.repeat(depth + 1), close = LAYOUT.indent.repeat(depth);
  if (Array.isArray(value) && value.length && depth <= LAYOUT.arrayDepth && (depth <= 1 || isListOfLines(value)))
    return '[\n' + value.map((item) => pad + layoutText(item, depth + 1)).join(',\n') + '\n' + close + ']';
  if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length && depth <= LAYOUT.objectDepth)
    return '{\n' + Object.keys(value).map((key) => `${pad}${JSON.stringify(key)}: ${layoutText(value[key], depth + 1)}`).join(',\n') + '\n' + close + '}';
  return JSON.stringify(value);
}

function documentText(value) {
  return layoutText(canonical(value)) + '\n';
}

function hashOf(text) {
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, HASH_LENGTH);
}

function looseText(value, open = []) {
  if (typeof value === 'function') return '"function"';
  if (value === undefined) return '"undefined"';
  if (value === null || typeof value !== 'object') return typeof value === 'number' && !Number.isFinite(value) ? `"${value}"` : JSON.stringify(value);
  if (open.includes(value)) return '"cycle"';
  open.push(value);
  let text;
  if (value instanceof Set) text = '{"set":[' + [...value].map((item) => looseText(item, open)).join(',') + ']}';
  else if (value instanceof Map) text = '{"map":[' + [...value].map(([key, item]) => `[${looseText(key, open)},${looseText(item, open)}]`).join(',') + ']}';
  else if (Array.isArray(value) || ArrayBuffer.isView(value)) text = '[' + Array.from(value, (item) => looseText(item, open)).join(',') + ']';
  else text = '{' + Object.keys(value).sort(keyOrder).map((key) => `${JSON.stringify(key)}:${looseText(value[key], open)}`).join(',') + '}';
  open.pop();
  return text;
}

function sizeOf(value) {
  if (value instanceof Set || value instanceof Map) return value.size;
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return value.length;
  return Object.keys(value).length;
}

// A number, string, boolean or null stands as itself; a container as "<hash>/<length or key count>".
function fingerprint(value) {
  if (value === undefined || typeof value === 'function') return undefined;
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
  if (value === null || typeof value !== 'object') return value;
  return `${hashOf(looseText(value))}/${sizeOf(value)}`;
}

module.exports = { canonical, documentText, hashOf, fingerprint, keyOrder };
