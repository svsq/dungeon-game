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
  SIMX.checks.add('dataIdsCheck', idsCheck);
})(typeof window !== 'undefined' ? window : globalThis);
