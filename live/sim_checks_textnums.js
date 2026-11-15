// live/sim_checks_textnums.js — selfCheck's part for the numbers in texts (TASKS 2072). Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, { D } = SIMX, TXT = root.TXT, fs = require('fs'), path = require('path');
  const GOLDEN = path.join(__dirname, '..', 'tests', 'golden', 'numtext.json');
  // the file holds the texts as they were written with their digits by hand; a number now comes from the data, and the text it makes must be the same.
  // Change a line there only when a text is changed on purpose
  function goldenCheck(out) {
    for (const [key, want] of Object.entries(JSON.parse(fs.readFileSync(GOLDEN, 'utf8')))) {
      const got = TXT(key);
      if (got !== want) out.push(`textnums: ${key} reads «${got}», the golden text is «${want}»`);
    }
  }
  // a number moved in the data must move in its text, or the binding is a copy and not a link
  const FOLLOW = [
    { key: 'POWERS.whirl_ring.desc', src: () => D.POWERS.whirl_ring, field: 't', to: 5, says: '5 секунд' },
    { key: 'POWERS.blow_echo.desc', src: () => D.POWERS.blow_echo, field: 'k', to: 0.55, says: '55 %' },
    { key: 'hud.tooltip.10', src: () => D.CONSUMABLES.hp_potion, field: 'heal', to: 0.25, says: '25%' },
    { key: 'sim_hero.sanctum.msg', src: () => D.GIFTS.find((G) => G.id === 'bless'), field: 'v', to: 35, says: '+35%' },
    { key: 'sim_town.donate.s', src: () => D.DONATE, field: 'max', to: 7, says: '7 раз' },
  ];
  function followCheck(out) {
    for (const c of FOLLOW) {
      const src = c.src(), was = src[c.field];
      src[c.field] = c.to;
      try { if (!TXT(c.key).includes(c.says)) out.push(`textnums: ${c.key} does not follow ${c.field} (set to ${c.to}, reads «${TXT(c.key)}»)`); } finally { src[c.field] = was; }
    }
  }
  SIMX.checks.add('textNumsGoldenCheck', goldenCheck);
  SIMX.checks.add('textNumsFollowCheck', followCheck);
})(typeof window !== 'undefined' ? window : globalThis);
