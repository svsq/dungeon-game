// live/sim_checks_links.js — selfCheck's part for the links between a map's records: a sconce's secret holds its torch, a vent prop its hazard, by `id` and never by place in a list (TASKS 2063). Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, { DG } = SIMX, DGX = root.DGX, { samecheckFloors } = SIMX.checks.kit, MAX_FAILS = 20, EXTRA_SEEDS = 30, EXTRA_FLOORS = 4;
  // the floors samecheck takes, and more magma ones: the arch's brazier cut (dungeon_fill.js) is where a torch's place moved
  function* floors() {
    for (const f of samecheckFloors()) yield f;
    for (let sd = 1; sd <= EXTRA_SEEDS; sd++) for (let f = 1; f <= EXTRA_FLOORS; f++) yield [`magma x${sd}/${f}`, sd * 131 + f * 1013, f, { mode: 'magma', runSeed: sd }];
  }
  const unique = (list) => { const ids = list.filter((o) => o.id !== undefined).map((o) => o.id); return new Set(ids).size === ids.length && ids.every(Number.isInteger); };
  function linkIssues(m) {
    const out = [], torches = m.torches, hazards = m.hazards || [];
    if (!unique(torches)) out.push('torch ids repeat');
    if (!unique(hazards)) out.push('hazard ids repeat');
    m.secrets.forEach((q, i) => { if (!q.trig || q.trig.k !== 'sconce') return; const t = DG.byId(torches, q.trig.t);
      if (!t) out.push(`secret ${i}: its sconce ${q.trig.t} is no torch`); else if (t.lever !== i) out.push(`secret ${i}: its sconce is a torch lit for secret ${t.lever}`); });
    m.decor.forEach((d, j) => { if (d.haz === undefined) return; const z = DG.byId(hazards, d.haz);
      if (!z) out.push(`decor ${j} (${d.n}): its hazard ${d.haz} is none`); else if (z.k !== 'vent' || z.x !== d.x || z.y !== d.y) out.push(`decor ${j} (${d.n}): its hazard ${d.haz} is a ${z.k} elsewhere`); });
    return out;
  }
  function linksCheck(out) {
    let sconces = 0, vents = 0;
    for (const [label, seed, f, opts] of floors()) {
      const m = DG.genFloor(seed, f, opts); sconces += m.secrets.filter((q) => q.trig && q.trig.k === 'sconce').length; vents += m.decor.filter((d) => d.haz !== undefined).length;
      for (const e of linkIssues(m)) out.push(`links: ${label}: ${e}`);
      if (out.length > MAX_FAILS) return; }
    if (!sconces || !vents) out.push(`links: the floors checked hold ${sconces} sconces and ${vents} vent props, so the links were not looked at`);
  }
  // the list cuts the generator makes after a link (and the QA's, which filter the lists): a link still finds its record, where the place it was laid at finds another
  function cutCheck(out) {
    const rows = [[{ id: 1 }, { id: 2 }, { id: 3 }], [{ x: 0 }, { x: 1 }, { x: 2 }]];
    for (const list of rows) { const last = list[list.length - 1], id = DGX.linkId(list, last), place = list.indexOf(last);
      if (DGX.linkId(list, last) !== id || !DG.byId(list, id)) out.push('links: linkId does not hold its id');
      list.splice(0, 1); if (DG.byId(list, id) !== last || list[place] === last) out.push('links: a link does not follow its record past a cut of the list'); }
    for (const [label, seed, f, opts] of floors()) { const m = DG.genFloor(seed, f, opts), i = m.secrets.findIndex((q) => q.trig && q.trig.k === 'sconce'); if (i < 0) continue;
      const t = DG.byId(m.torches, m.secrets[i].trig.t), at = m.torches.indexOf(t); if (at < 1) continue; m.torches.splice(0, Math.min(at, 3));
      if (DG.byId(m.torches, m.secrets[i].trig.t) !== t) out.push(`links: ${label}: the sconce of secret ${i} is lost when the torches before it are cut`); return; }
    out.push('links: no floor with a sconce secret to cut the torches of');
  }
  // a floor in play saved before the torches had ids holds its sconce by place in the list: loading it takes the torch carrying the secret's number
  function migrateCheck(out) {
    for (const [label, seed, f, opts] of floors()) { const m = DG.genFloor(seed, f, opts), i = m.secrets.findIndex((q) => q.trig && q.trig.k === 'sconce'); if (i < 0) continue;
      const old = JSON.parse(JSON.stringify(m)), t = old.torches.find((o) => o.lever === i), place = old.torches.indexOf(t);
      for (const o of old.torches) delete o.id; old.secrets[i].trig.t = Math.max(0, place - 1);
      SIMX.migrateSecrets({ map: old }); const got = DG.byId(old.torches, old.secrets[i].trig.t);
      if (got !== t) out.push(`links: ${label}: a saved floor's sconce of secret ${i} is not found again by its lever number`);
      SIMX.migrateSecrets({ map: old }); if (DG.byId(old.torches, old.secrets[i].trig.t) !== got) out.push(`links: ${label}: loading a floor twice moves its sconce`);
      return; }
    out.push('links: no floor with a sconce secret to load as an old save');
  }
  SIMX.checks.add('linksCheck', linksCheck, { slow: true });
  SIMX.checks.add('linkCutCheck', cutCheck, { slow: true });
  SIMX.checks.add('linkMigrateCheck', migrateCheck, { slow: true });
})(typeof window !== 'undefined' ? window : globalThis);
