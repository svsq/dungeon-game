// Writes grid inputs and results as JSON. A table or record of DATA is written as a reference to its place
// (`{ "dataRef": "RUNS.cave" }`, `{ "dataRef": "GIFTS[bless]" }`), not copied; values JSON cannot hold are written as
// `{ "special": "undefined" | "NaN" | "Infinity" | "-Infinity" | "function" }`. Fields that are undefined are left out.
const SPECIAL_NUMBERS = new Map([[Infinity, 'Infinity'], [-Infinity, '-Infinity']]);

function placesOfData(D) {
  const places = new Map();
  const remember = (value, place) => { if (value && typeof value === 'object' && !places.has(value)) places.set(value, place); };
  for (const name of Object.keys(D)) {
    const table = D[name];
    if (!table || typeof table !== 'object') continue;
    remember(table, name);
    if (Array.isArray(table)) table.forEach((entry, index) => remember(entry, `${name}[${(entry && entry.id) || index}]`));
    else for (const key of Object.keys(table)) remember(table[key], name + '.' + key);
  }
  D.NOTES.list.forEach((entry) => remember(entry, `NOTES.list[${entry.id}]`));
  return places;
}

class GridValues {
  constructor(D) {
    this.places = placesOfData(D);
  }

  plain(value) {
    if (value === undefined) return { special: 'undefined' };
    if (typeof value === 'function') return { special: 'function' };
    if (typeof value === 'number') return Number.isNaN(value) ? { special: 'NaN' } : SPECIAL_NUMBERS.has(value) ? { special: SPECIAL_NUMBERS.get(value) } : value;
    if (value === null || typeof value !== 'object') return value;
    if (this.places.has(value)) return { dataRef: this.places.get(value) };
    if (Array.isArray(value)) return value.map((item) => this.plain(item));
    if (Object.prototype.toString.call(value) !== '[object Object]') throw new Error('grid_values: cannot write a ' + Object.prototype.toString.call(value));
    const out = {};
    for (const key of Object.keys(value)) if (value[key] !== undefined) out[key] = this.plain(value[key]);
    return out;
  }
}

module.exports = { GridValues };
