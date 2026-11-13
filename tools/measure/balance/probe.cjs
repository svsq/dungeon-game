// balance probes without touching the game (TASKS 1195): NODE_OPTIONS="--require tools/measure/balance/probe.cjs" ROOTDIR=$PWD PROBE=json
// node tools/difficulty.cjs ... --no-cache. Keys: hpLate/hpFrom (extra health a floor), hpTab/hpPow (a factor per floor), dmgK/dmgFrom,
// bossHp, bossDmg, spd (plain monsters)
const o = JSON.parse(process.env.PROBE || '{}'); if (!Object.keys(o).length) return;
const D = require(process.env.ROOTDIR + '/live/data.js');
const hp0 = D.hpAt, dm0 = D.dmgAt, camp = D.RUNS.campaign.floors;
const extra = (d, k, from) => (o[k] || 0) * Math.max(0, Math.min(d, camp) - (o[from] || 3) + 1);
D.hpAt = (d) => hp0(d) * (1 + extra(d, 'hpLate', 'hpFrom') / (1 + 0.5 * (Math.min(d, camp) - 1)));
D.dmgAt = (d, boss) => dm0(d, boss) * (1 + (o.dmgK || 0) * Math.max(0, Math.min(d, camp) - (o.dmgFrom || 3) + 1));
for (const t in D.BOSSES) if (D.ENEMIES[t]) { D.ENEMIES[t].hp *= o.bossHp || 1; D.ENEMIES[t].dmg *= o.bossDmg || 1; }
if (o.spd) for (const t in D.ENEMIES) if (!D.BOSSES[t] && D.ENEMIES[t].spd) D.ENEMIES[t].spd *= o.spd;
if (o.hpTab) { const h1 = D.hpAt; D.hpAt = (d) => h1(d) * Math.pow(o.hpTab[Math.min(d, o.hpTab.length) - 1] || 1, o.hpPow || 1); }
