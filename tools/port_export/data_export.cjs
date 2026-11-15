// Builds the port's data files and the export report from the loaded DATA. Pure: the same DATA gives the same files,
// key order is the game's own (the order entries are listed and iterated in), numbers are written as JavaScript prints them.
const { RECORDS, NOT_EXPORTED, tablePlan } = require('./data_tables.cjs');
const { topLevelKinds, parametersOf } = require('./data_functions.cjs');
const { ValueConverter } = require('./data_values.cjs');
const { jsonText } = require('./file_tree.cjs');
const { textKeysOf } = require('./text_keys.cjs');

const ID_SPELLING = /^[a-z0-9_.-]+$/;
const RECORD_ORDER_FILE = 'record_order.json';

function wrapTable(value) {
  if (Array.isArray(value)) return { items: value };
  return value !== null && typeof value === 'object' ? value : { value };
}

function entriesOf(table, name) {
  if (Array.isArray(table)) return table.map((entry) => [entry.id, entry]);
  if (table && typeof table === 'object') return Object.entries(table);
  throw new Error(`data_export: ${name} is not a table of records`);
}

class DataExport {
  constructor({ data, text, sourceOf }) {
    this.data = data;
    this.sourceOf = sourceOf;
    this.plan = tablePlan();
    this.kinds = topLevelKinds();
    this.converter = new ValueConverter(sourceOf);
    this.dataFiles = new Map();
    this.recordOrder = {};
    this.tables = [];
    this.topFunctions = [];
    this.findings = [];
    this.text = text;
  }

  build() {
    this.checkRegistriesAgainstData();
    for (const name of Object.keys(this.data).sort()) this.exportName(name);
    this.dataFiles.set(RECORD_ORDER_FILE, jsonText(this.recordOrder));
    return { dataFiles: new Map([...this.dataFiles].sort(([a], [b]) => (a < b ? -1 : 1))), reportFiles: this.reportFiles() };
  }

  checkRegistriesAgainstData() {
    const listed = [...Object.keys(this.plan), ...Object.keys(this.kinds), ...Object.keys(NOT_EXPORTED)];
    const stale = listed.filter((name) => !(name in this.data));
    if (stale.length) throw new Error('data_export: listed but not in DATA: ' + stale.join(', '));
  }

  exportName(name) {
    const value = this.data[name], source = this.sourceOf[name];
    if (typeof value === 'function') return this.noteTopFunction(name, value, source);
    if (NOT_EXPORTED[name]) return this.tables.push({ name, source, status: 'not exported', reason: NOT_EXPORTED[name] });
    const plan = this.plan[name];
    if (!plan) throw new Error(`data_export: ${name} (${source}) has no place in data_tables.cjs`);
    const converted = this.converter.convert(value, name);
    if (plan.layout === RECORDS) this.writeRecords(name, converted, plan.file);
    else this.writeTable(name, converted, plan);
  }

  noteTopFunction(name, fn, source) {
    const kind = this.kinds[name];
    if (!kind) throw new Error(`data_export: function ${name} (${source}) has no kind in data_functions.cjs`);
    this.topFunctions.push({ place: name, table: null, source, kind, parameters: parametersOf(fn), exported: 'code', body: fn.toString() });
  }

  writeTable(name, converted, plan) {
    const table = { ...wrapTable(converted) };
    const entry = { name, source: this.sourceOf[name], status: 'table', path: plan.file + '.json' };
    if (plan.recordsField) {
      this.writeRecords(name + '.' + plan.recordsField, table[plan.recordsField], plan.file);
      delete table[plan.recordsField];
      entry.records = plan.file + '/';
    }
    this.dataFiles.set(entry.path, jsonText(table));
    this.tables.push(entry);
  }

  writeRecords(name, converted, folder) {
    const ids = [];
    for (const [key, entry] of entriesOf(converted, name)) {
      const id = String(key);
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`data_export: ${name}.${id} is not a record`);
      if (entry.id !== undefined && entry.id !== id) throw new Error(`data_export: ${name}.${id} carries id ${entry.id}`);
      if (ids.includes(id)) throw new Error(`data_export: ${name} has id ${id} twice`);
      if (!ID_SPELLING.test(id)) this.findings.push({ place: name + '.' + id, what: 'id does not fit the port id spelling' });
      ids.push(id);
      this.dataFiles.set(`${folder}/${id}.json`, jsonText({ id, ...entry }));
    }
    this.recordOrder[folder] = ids;
    if (!name.includes('.')) this.tables.push({ name, source: this.sourceOf[name], status: 'records', path: folder + '/', count: ids.length });
  }

  reportFiles() {
    const functions = [...this.topFunctions, ...this.converter.functions].sort((a, b) => (a.place < b.place ? -1 : 1));
    return new Map([
      ['tables.json', jsonText(this.tables)],
      ['functions.json', jsonText(functions)],
      ['conversions.json', jsonText(this.converter.conversions)],
      ['findings.json', jsonText(this.findings)],
      ['text_keys.json', jsonText(textKeysOf(this.dataFiles, this.text))],
    ]);
  }
}

module.exports = { DataExport, RECORD_ORDER_FILE };
