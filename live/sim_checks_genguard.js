// live/sim_checks_genguard.js — selfCheck's parts for what the floor generator takes for granted (TASKS 2069): rock on the rim after every stage, each stage reading only what an earlier one laid, the fields of ST, a map that shares no object with the data. Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, { D, DG } = SIMX, DGX = root.DGX, fs = require('fs'), path = require('path');
  const MODES = ['campaign', 'cave', 'magma', 'endless'], WALKED = [1, 5], MAX_FAILS = 20;
  // the floors tools/samecheck.mjs takes for `gen`: its seeds, so a floor the reference holds is a floor checked here
  function* samecheckFloors() {
    for (const mode of MODES) for (const runSeed of [1, 7, 23]) for (let f = 1; f <= Math.min(D.RUNS[mode].floors, 16); f++) yield [`${mode} ${runSeed}/${f}`, runSeed * 131 + f * 1013, f, { mode, runSeed }];
    for (const mode of MODES) for (let runSeed = 1; runSeed <= 8; runSeed++) for (let f = 1, n = mode === 'campaign' ? 16 : mode === 'endless' ? 12 : 4; f <= n; f++) yield [`${mode} wide ${runSeed}/${f}`, (runSeed * 7919 + f * 104729) >>> 0, f, { mode, runSeed, from: 1, town: 0 }];
  }
  // a stage that reads a name nothing before it laid gets a throw instead of an undefined that rooms, links or terrain would carry on with
  const strictView = (stage, GF) => new Proxy(GF, { get(t, k) { if (typeof k === 'string' && !(k in t)) throw new Error(`the ${stage} stage reads GF.${k}, which no stage before it has laid`); return t[k]; } });
  function stageCheck(out) {
    let at = '';
    const rim = (stage, GF, map) => { const { cells, W, H } = map || GF;
      for (let k = 0; k < cells.length; k++) if (WALKED.includes(cells[k]) && DGX.onRim(k % W, Math.floor(k / W), W, H)) { out.push(`gen rim: after the ${stage} stage floor stands on the rim at ${k % W}, ${Math.floor(k / W)} (${at})`); return; } };
    DGX.audit = { view: strictView, after: rim };
    try { for (const [label, seed, f, opts] of samecheckFloors()) { at = label;
      try { DG.genFloor(seed, f, opts); } catch (e) { out.push(`gen stages: ${at}: ${e.message}`); }
      if (out.length > MAX_FAILS) break; } }
    finally { DGX.audit = null; }
  }
  // the fields of ST (data_runs.js stageOf, over by opts.stage), the one list of them: `always` is in every floor's stage, `sometimes`
  // only in some (a rooms floor's size and room count, the descent's own, a chapter's layout), and QA's stage may put altar or cap
  const ST_FIELDS = {
    always: ['N', 'lf', 'n', 'mod', 'depth', 'last', 'fin', 'biome', 'boss', 'arch', 'guard', 'exit', 'pop', 'early', 'elite', 'mob'],
    sometimes: ['lay', 'size', 'rooms', 'secretK', 'altar', 'cap', 'cd', 'pair', 'bossK'] };
  function stFieldsCheck(out) {
    const known = new Set([...ST_FIELDS.always, ...ST_FIELDS.sometimes]);
    for (const mode of MODES) for (let f = 1, n = mode === 'endless' ? 24 : Math.min(D.RUNS[mode].floors, 16); f <= n; f++) { const st = D.stageOf(mode, f, 1, 1);
      for (const k of Object.keys(st)) if (!known.has(k)) out.push(`ST: stageOf(${mode}, ${f}) has ${k}, which ST_FIELDS (sim_checks_genguard.js) does not list`);
      for (const k of ST_FIELDS.always) if (!(k in st)) out.push(`ST: stageOf(${mode}, ${f}) lacks ${k}`); }
    for (const f of ['dungeon.js', ...require('./modules.js').parts.dungeon]) for (const [, k] of fs.readFileSync(path.join(__dirname, f), 'utf8').matchAll(/\bST\.([A-Za-z_]\w*)/g))
      if (!known.has(k)) out.push(`ST: ${f} reads ST.${k}, which ST_FIELDS does not list`);
  }
  // a map is copied out of the generator (genKept) only by the sim: its own consumers, samecheck and QA among them, get what tryGen made,
  // and a table of the data laid into it as it stands would be changed with it (a frozen one cannot be)
  function sharedCheck(out) {
    const objects = (v) => (v && typeof v === 'object' && !ArrayBuffer.isView(v) ? Object.keys(v).map((k) => [k, v[k]]) : []);
    const held = new Set(), done = new Set(), walk = [D, DG, DGX];
    while (walk.length) { const o = walk.pop(); if (!o || typeof o !== 'object' || done.has(o) || ArrayBuffer.isView(o)) continue; done.add(o); if (!Object.isFrozen(o)) held.add(o); for (const [, v] of objects(o)) walk.push(v); }
    const maps = [...MODES.flatMap((mode) => Array.from({ length: Math.min(D.RUNS[mode].floors, 4) }, (_, i) => [`${mode} floor ${i + 1}`, DG.genFloor((7 * 131 + (i + 1) * 1013) >>> 0, i + 1, { mode, runSeed: 7 })])),
      ...[1, 2, 3].map((s) => [`town ${s}`, DG.genTown(s)])];
    for (const [label, m] of maps) { const seen = new Set(), queue = [[m, 'map']];
      while (queue.length) { const [o, p] = queue.pop(); if (!o || typeof o !== 'object' || seen.has(o)) continue; seen.add(o);
        if (held.has(o)) { out.push(`gen shared: ${label}: ${p} is an object of the data, not a copy`); continue; }
        for (const [k, v] of objects(o)) queue.push([v, p + '.' + k]); }
      if (out.length > MAX_FAILS) break; }
  }
  Object.assign(SIMX.checks.kit, { samecheckFloors });
  SIMX.checks.add('genStageCheck', stageCheck, { slow: true });
  SIMX.checks.add('stFieldsCheck', stFieldsCheck);
  SIMX.checks.add('genSharedCheck', sharedCheck);
})(typeof window !== 'undefined' ? window : globalThis);
