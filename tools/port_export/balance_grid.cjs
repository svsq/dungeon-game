// Calls every function the data export left as code or as a marker on its grid of inputs and writes one file per
// function, plus a coverage list: each function is either on the grid or named with the reason it is not. The function
// list comes from the data export itself, so a function added to DATA without a grid entry or a reason stops the run.
const { DataExport } = require('./data_export.cjs');
const { gridRanges } = require('./grid_ranges.cjs');
const { formulaGrid } = require('./grid_formulas.cjs');
const { ruleGrid } = require('./grid_rules.cjs');
const { planGrid } = require('./grid_plans.cjs');
const { UNCOVERED_KINDS } = require('./grid_uncovered.cjs');
const { GridValues } = require('./grid_values.cjs');
const { jsonText } = require('./file_tree.cjs');

const COVERAGE_FILE = 'coverage.json';

function functionsOfExport(game) {
  const exporter = new DataExport(game);
  exporter.build();
  return [...exporter.topFunctions, ...exporter.converter.functions.filter((entry) => entry.exported === 'marker')];
}

function functionAt(D, place) {
  return place.split('.').reduce((value, key) => value[key], D);
}

function gridFileText(header, cases) {
  const lines = Object.entries(header).map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`);
  return ['{', ...lines, '  "cases": [', cases.map((entry) => '    ' + JSON.stringify(entry)).join(',\n'), '  ]', '}', ''].join('\n');
}

function dataSnapshot(D) {
  return JSON.stringify(D, (key, value) => (typeof value === 'function' ? value.toString() : value));
}

class BalanceGrid {
  constructor(game) {
    this.D = game.data;
    this.listed = functionsOfExport(game);
    const ranges = gridRanges(this.D);
    this.plan = { ...formulaGrid(this.D, ranges), ...ruleGrid(this.D, ranges), ...planGrid(this.D, ranges) };
    this.values = new GridValues(this.D);
  }

  build() {
    const places = new Set(this.listed.map((entry) => entry.place));
    const stale = Object.keys(this.plan).filter((place) => !places.has(place));
    if (stale.length) throw new Error('balance_grid: on the grid but not in the export list: ' + stale.join(', '));
    const before = dataSnapshot(this.D), files = new Map(), coverage = [];
    for (const entry of [...this.listed].sort((a, b) => (a.place < b.place ? -1 : 1))) {
      coverage.push(this.coverFunction(entry, files));
    }
    if (dataSnapshot(this.D) !== before) throw new Error('balance_grid: a grid call changed DATA');
    files.set(COVERAGE_FILE, jsonText(coverage));
    return new Map([...files].sort(([a], [b]) => (a < b ? -1 : 1)));
  }

  coverFunction(entry, files) {
    const { place, kind, source } = entry, spec = this.plan[place];
    if (!spec) {
      const reason = UNCOVERED_KINDS[kind];
      if (!reason) throw new Error(`balance_grid: ${place} (${kind}) has neither a grid nor a reason`);
      return { place, kind, source, reason };
    }
    const { cases, call, inputs } = Array.isArray(spec) ? { cases: spec } : spec;
    const fn = functionAt(this.D, place), file = place + '.json';
    const results = cases.map((args) => this.runCase(fn, args, call));
    files.set(file, gridFileText({ function: place, source, kind, parameters: entry.parameters, inputs: inputs || entry.parameters }, results));
    return { place, kind, source, grid: file, cases: results.length };
  }

  runCase(fn, args, call) {
    const input = this.values.plain(args), result = {};
    try {
      result.result = this.values.plain(call ? call(fn, ...args) : fn(...args));
    } catch (error) {
      result.throws = error.message;
    }
    const after = this.values.plain(args);
    return { input, ...result, ...(JSON.stringify(after) !== JSON.stringify(input) ? { inputAfter: after } : {}) };
  }
}

module.exports = { BalanceGrid };
