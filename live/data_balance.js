// live/data_balance.js — the balance curves: monsters' strength over floors, difficulties.
// One of the DATA files (ARCHITECTURE.md §4.2): pure data and pure helpers, no state; data.js checks the set.
(function (root) {
  const D = root.DATA || (root.DATA = {});
  // half the monsters, each 2.5× as dangerous (hp × dmg ≈ 2.56: a straight 2.5 on both walled every bot run at floor 2); dmg 2.15,
  // not 1.85, once the hit-stop stopped dropping the hero's dashes and swings: the average bot won 69–71 % (TASKS 227);
  // a kill pays double so XP and loot per floor stay where they were
  // spike: share of max HP per stab, through armour; dmgUp: monsters' damage grows by this per floor (0.3 let the hero's HP and
  // armour outgrow it: a player's minimum HP on floors 5–8 sat at 55–76 % on hard, TASKS 154); earlyCd: the elites' attack
  // cooldown factor on floors 1–3, where they alone took a player down to 11 %
  // dodge: % chance to take no harm from a monster's blow, bolt or blast, per point of agility, its cap, and what a dash adds while it lasts
  // (a dash used to make the hero immune: an expert bot that dashed through blows won 98 % of runs; it adds nothing now: with +10
  // the expert, who dashes twice as often, still won 89–93 %, TASKS 227)
  // dmgLate: more growth per floor past the 5th, where gear bought from the merchant let a player's minimum HP sit at 44–76 %;
  // one curve for every floor, no per-floor patches (TASKS 227): from the 4th, the 5th (the plain demon's first floor) cost more
  // than the forge lord's 6th and a plain blow on the 7th took over 10 % of the health
  // startHpPot: the hero starts with three healing potions: with two, the early deaths came with an empty bag (TASKS 222)
  // cap: the most of the health one monster blow can take (the boss's more), so no stack of elite multipliers kills through a potion
  const BAL = { pop: 0.5, hp: 1.6, dmg: 2.15, reward: 2, startHpPot: 3, spike: 0.12, dmgUp: 0.4, dmgLate: 0.27, earlyCd: 0.85, early: 3, dodge: { agi: 0.25, cap: 40, dash: 0, t: 0.22 }, cap: { blow: 0.33, boss: 0.5 }, deep: { from: 12, hp: 1.1, dmg: 1.06 } };
  // past the campaign's last floor (the endless descent, TASKS 351) monsters grow on with no ceiling: health ×deep.hp and blows
  // ×deep.dmg a floor on top of the campaign's lines (R-05); a blow is still held to BAL.cap of the hero's health
  const deepK = (f, k) => Math.pow(BAL.deep[k], Math.max(0, f - BAL.deep.from));
  const dmgAt = (f, boss) => (1 + BAL.dmgUp * (f - 1) + (boss ? 0 : BAL.dmgLate * Math.max(0, f - 5))) * deepK(f, 'dmg');
  // a monster's health at depth f over its own (× BAL.hp and the difficulty's)
  const hpAt = (f) => (1 + 0.5 * (f - 1)) * deepK(f, 'hp');
  // difficulty presets, picked in the main menu for a new campaign: damage to the hero (monsters and traps), monster HP, experience
  // the balance is tuned on normal; easy and hard only scale the monsters' blows and health by one factor each (TASKS 154)
  const DIFF = { easy: { name: 'Лёгкая', dmg: 0.75, hp: 0.75, xp: 1 }, normal: { name: 'Нормальная', dmg: 1, hp: 1, xp: 1 }, hard: { name: 'Тяжёлая', dmg: 1.3, hp: 1.25, xp: 1 } };
  const DIFF_ORDER = ['easy', 'normal', 'hard'];

  Object.assign(D, { BAL, dmgAt, hpAt, DIFF, DIFF_ORDER });
})(typeof window !== 'undefined' ? window : globalThis);
