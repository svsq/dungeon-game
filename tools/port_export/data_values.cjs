// Turns a DATA value into plain JSON. Every step that is not a straight copy is logged: functions (sampled into data
// or left as a named marker), values JSON cannot hold, dropped fields and objects shared between two places.
const { fieldRuleOf, parametersOf, SAMPLE_BY_FLOOR, SAMPLE_BY_RANK, SAMPLE_CONSTANT } = require('./data_functions.cjs');

const SPECIAL = {
  'RUNS.endless.floors': { reason: 'Infinity: the endless descent has no last floor; written as null', convert: () => null },
  NAME_CHAR: { reason: 'RegExp of the letters a hero name may use; written as its pattern and flags', convert: (re) => ({ pattern: re.source, flags: re.flags }) },
  'NOTES.byId': { reason: 'index of NOTES.list by id, the same objects again; rebuilt on load', drop: true },
};

const FIRST_FLOOR = 1, FIRST_RANK = 0;

function sampleRange(from, to, fn) {
  const values = [];
  for (let input = from; input <= to; input++) values.push(fn(input) ?? null);
  return values;
}

function lastFloorOf(run) {
  const last = run.chapter || run.floors;
  if (!Number.isFinite(last)) throw new Error('data_values: a run without a finite floor count has a floor function');
  return last;
}

const SAMPLERS = {
  [SAMPLE_BY_FLOOR]: (fn, owner) => ({ sampledOver: 'floor', from: FIRST_FLOOR, values: sampleRange(FIRST_FLOOR, lastFloorOf(owner), fn) }),
  [SAMPLE_BY_RANK]: (fn, owner) => ({ sampledOver: 'rank', from: FIRST_RANK, values: sampleRange(FIRST_RANK, owner.max, fn) }),
  [SAMPLE_CONSTANT]: (fn) => ({ constant: fn() ?? null }),
};

class ValueConverter {
  constructor(sourceOf) {
    this.sourceOf = sourceOf;
    this.functions = [];
    this.conversions = [];
    this.firstPlaceOf = new Map();
    this.copyDepth = 0;
  }

  convert(value, place, owner) {
    const special = SPECIAL[place];
    if (special) {
      this.conversions.push({ place, what: special.reason });
      if (special.drop) return undefined;
      value = special.convert(value);
    }
    if (typeof value === 'function') return this.convertFunction(value, place, owner);
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`data_values: ${place} is ${value}, which JSON cannot hold`);
    if (value === null || typeof value !== 'object') return value;
    return this.convertObject(value, place);
  }

  convertObject(value, place) {
    const kind = Object.prototype.toString.call(value);
    if (kind !== '[object Object]' && kind !== '[object Array]') throw new Error(`data_values: ${place} is a ${kind}, which JSON cannot hold`);
    const shared = this.firstPlaceOf.has(value);
    if (!shared) this.firstPlaceOf.set(value, place);
    else if (!this.copyDepth) this.conversions.push({ place, what: 'the same object as ' + this.firstPlaceOf.get(value) + '; written as a copy' });
    this.copyDepth += shared ? 1 : 0;
    const out = this.convertChildren(value, place);
    this.copyDepth -= shared ? 1 : 0;
    return out;
  }

  convertChildren(value, place) {
    if (Array.isArray(value)) return value.map((item, index) => this.convertItem(item, place + '.' + index, value));
    const out = {};
    for (const key of Object.keys(value)) {
      const converted = this.convert(value[key], place + '.' + key, value);
      if (converted === undefined) this.noteDropped(value[key], place + '.' + key);
      else out[key] = converted;
    }
    return out;
  }

  convertItem(item, place, owner) {
    const converted = this.convert(item, place, owner);
    if (converted === undefined) throw new Error(`data_values: ${place} is undefined inside a list`);
    return converted;
  }

  noteDropped(original, place) {
    if (original === undefined) this.conversions.push({ place, what: 'undefined; the field is left out' });
  }

  convertFunction(fn, place, owner) {
    const rule = fieldRuleOf(place);
    if (!rule) throw new Error(`data_values: ${place} is a function without a rule in data_functions.cjs`);
    const parameters = parametersOf(fn), way = sampleWayOf(rule, parameters);
    this.functions.push({
      place, table: place.split('.')[0], source: this.sourceOf[place.split('.')[0]], kind: rule.kind, parameters,
      exported: way || 'marker', body: fn.toString(),
    });
    return way ? SAMPLERS[way](fn, owner) : { function: place };
  }
}

function sampleWayOf(rule, parameters) {
  if (!rule.sample) return null;
  if (parameters.length === 0) return SAMPLE_CONSTANT;
  return rule.sample === SAMPLE_CONSTANT ? null : rule.sample;
}

module.exports = { ValueConverter };
