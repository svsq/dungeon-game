// Runs the game's floor generator under watch. Every random stream it opens is counted (rolls and the last value), and
// the generator's own audit hook (DGX.audit) sees each stage of each try: what the stage laid or changed in the shared
// bag of the try, as fingerprints, and which streams it rolled. Nothing the generator computes is changed: a counted
// stream hands back exactly what the stream gives, and the hook hands each stage the bag itself.
const path = require('path');
const { loadGameData } = require('./game_data.cjs');
const { fingerprint } = require('./canonical_json.cjs');

const LIVE = path.join(__dirname, '..', '..', 'live');
const FIRST_STAGE = 'rooms', FILL_STAGE = 'fill', AFTER_FILL = 'after-fill', EVENTS_STAGE = 'events';

class StreamLedger {
  constructor() {
    this.opened = [];
  }

  counting(open) {
    return (seed) => {
      const next = open(seed), stream = { seed, rolls: 0, last: null };
      stream.roll = () => { const value = next(); stream.rolls++; stream.last = value; return value; };
      this.opened.push(stream);
      return stream.roll;
    };
  }
}

const fieldsOf = (bag) => {
  const fields = {};
  for (const key of Object.keys(bag)) { const print = fingerprint(bag[key]); if (print !== undefined) fields[key] = print; }
  return fields;
};
const changedFields = (before, after) => Object.fromEntries(Object.entries(after).filter(([key, print]) => before[key] !== print));
const rollsOf = (streams) => streams.map((stream) => stream.rolls);

class FloorTry {
  constructor(attempt, bag, opened) {
    this.attempt = attempt;
    this.seed = bag.seed;
    this.opened = opened;
    this.firstStream = opened.findIndex((stream) => stream.roll === bag.R);
    if (this.firstStream < 0) throw new Error('generator_probe: the try\'s main stream was not opened through DATA.mul32');
    this.main = opened[this.firstStream];
    this.stages = [];
    this.refusedAt = null;
    this.map = null;
  }

  get streams() {
    return this.opened.slice(this.firstStream);
  }

  begin(bag) {
    this.before = { fields: fieldsOf(bag), rolls: rollsOf(this.streams) };
  }

  end(stage, bag) {
    const record = { stage, mainStream: { rolls: this.main.rolls, last: this.main.last }, streams: this.rolledSince(this.before.rolls), fields: changedFields(this.before.fields, fieldsOf(bag)) };
    this.stages.push(record);
    return record;
  }

  rolledSince(rolls) {
    return this.streams.filter((stream, index) => stream !== this.main && stream.rolls !== (rolls[index] || 0)).map((stream) => [stream.seed, stream.rolls, stream.last]);
  }

  keepMap(map, record) {
    this.map = map;
    this.mapFields = fieldsOf(map);
    this.rollsAtFill = rollsOf(this.streams);
    record.mapFields = this.mapFields;
  }

  endEvents(map) {
    this.before = { fields: this.mapFields, rolls: this.rollsAtFill };
    this.end(EVENTS_STAGE, map);
  }
}

class GeneratorProbe {
  constructor() {
    const { data } = loadGameData();
    this.ledger = new StreamLedger();
    data.mul32 = this.ledger.counting(data.mul32);
    this.data = data;
    this.dungeon = require(path.join(LIVE, 'dungeon.js'));
    this.dungeonParts = globalThis.DGX;
    this.dungeonParts.audit = { view: (stage, bag) => this.view(stage, bag), after: (stage, bag, map) => this.after(stage, bag, map), reroll: (stage) => { this.current.refusedAt = stage; } };
  }

  view(stage, bag) {
    if (stage === FIRST_STAGE) this.tries.push(this.current = new FloorTry(this.tries.length, bag, this.ledger.opened));
    this.current.begin(bag);
    return bag;
  }

  after(stage, bag, map) {
    const record = this.current.end(stage, bag);
    if (stage === FILL_STAGE && map) this.current.keepMap(map, record);
  }

  generate(floorSeed, floor, options) {
    this.tries = [];
    this.ledger.opened = [];
    const map = this.dungeon.genFloor(floorSeed, floor, options);
    const accepted = this.tries[this.tries.length - 1];
    if (!accepted || accepted.map !== map) throw new Error(`generator_probe: floor ${floor} of seed ${floorSeed} came from no try the audit saw`);
    accepted.endEvents(map);
    const refused = this.tries.slice(0, -1).map((floorTry) => floorTry.refusedAt
      ? { attempt: floorTry.attempt, stage: floorTry.refusedAt }
      : { attempt: floorTry.attempt, stage: AFTER_FILL, secretRooms: floorTry.map.secrets.length });
    return { map, attempts: { accepted: accepted.attempt, seed: accepted.seed, refused }, stages: accepted.stages };
  }
}

module.exports = { GeneratorProbe };
