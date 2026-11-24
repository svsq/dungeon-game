// live/sim_checks_data.js — selfCheck's parts for the content tables the data files add to one another. Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, { D } = SIMX;
  // data_powers.js and data_forks.js push into tables of data_hero.js with no test of the id: a repeat would sit beside the first in
  // GIFTS or overwrite it in POWERS. A gift of a power (`power: 1`) shares the power's id by design; any other gift must not
  function idsCheck(out) {
    const seen = new Set();
    for (const G of D.GIFTS) {
      if (seen.has(G.id)) out.push(`data: GIFTS holds the id ${G.id} twice`);
      seen.add(G.id);
      if (!!G.power !== !!D.POWERS[G.id]) out.push(`data: the gift ${G.id} ${G.power ? 'claims a power that POWERS lacks' : 'shares its id with a power but is not that power\'s gift'}`);
    }
    for (const [k, P] of Object.entries(D.POWERS)) if (P.id !== k) out.push(`data: POWERS.${k} carries the id ${P.id}`);
    for (const [ab, ranks] of Object.entries(D.FORKS)) for (const [rank, ids] of Object.entries(ranks)) for (const id of ids) if (!D.POWERS[id]) out.push(`data: the fork ${ab} ${rank} names ${id}, which POWERS lacks`);
  }
  // one name for two effects makes the player mix them up (2071); a gift of a power carries the power's name by design and is left out, any other gift's name is its own
  function namesCheck(out) {
    const owner = new Map();
    const take = (table, id, name) => {
      if (name === undefined) return;
      if (owner.has(name)) out.push(`data: the name "${name}" is held by both ${owner.get(name)} and ${table}.${id}`);
      else owner.set(name, `${table}.${id}`);
    };
    for (const P of Object.values(D.POWERS)) take('POWERS', P.id, P.name);
    for (const M of D.META) take('META', M.id, M.name);
    for (const G of D.GIFTS) if (!G.power) take('GIFTS', G.id, G.name);
  }
  // the death screen's count to the next discovery: the cheapest one still for sale, nothing once it is affordable or all are open
  function unlockShortfallCheck(out) {
    const forSale = D.UNLOCKS.filter((U) => U.cost), cheapest = forSale.reduce((a, U) => (U.cost < a.cost ? U : a)), allOpen = Object.fromEntries(D.UNLOCKS.map((U) => [U.id, 1]));
    const cases = [[{ shards: 0 }, cheapest.cost], [{ shards: cheapest.cost - 1 }, 1], [{ shards: cheapest.cost }, 0], [{ shards: 0, open: allOpen }, 0],
      [{ shards: 0, open: { [cheapest.id]: 1 } }, Math.min(...forSale.filter((U) => U.id !== cheapest.id).map((U) => U.cost))]];
    for (const [meta, want] of cases) { const got = D.nextUnlockShortfall(meta); if (got !== want) out.push(`data: nextUnlockShortfall(${JSON.stringify(meta)}) is ${got}, not ${want}`); }
  }
  SIMX.checks.add('dataIdsCheck', idsCheck);
  SIMX.checks.add('dataNamesCheck', namesCheck);
  SIMX.checks.add('unlockShortfallCheck', unlockShortfallCheck);
})(typeof window !== 'undefined' ? window : globalThis);
