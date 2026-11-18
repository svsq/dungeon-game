// the menu's arch, the HUD and the hero window for each class and each worn set: frames of the canvas (render=1, like qashot)
//   node tools/measure/chars_menu/percls.mjs [--out frames/critic_chars_r1_menu/percls]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(ROOT);
const { openGame } = await import(path.join(ROOT, 'tools/gamepage.mjs'));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'frames/critic_chars_r1_menu/percls'));
fs.mkdirSync(OUT, { recursive: true });
// [name, screen, class, {slot: base}]
const SETS = [
  ['warrior_plate', 'menu', 'warrior', { helm: 'knight_helm', armor: 'plate_armor', offhand: 'shield', weapon: 'longsword' }],
  ['warrior_leather', 'menu', 'warrior', { helm: 'leather_helm', armor: 'leather_armor', weapon: 'axe', offhand: 'tower_shield' }],
  ['warrior_cloak', 'menu', 'warrior', { armor: 'cloak', weapon: 'hammer' }],
  ['mage_circlet_orb', 'menu', 'mage', { helm: 'circlet', armor: 'robe', weapon: 'wand', offhand: 'orb' }],
  ['mage_leather', 'menu', 'mage', { helm: 'leather_helm', armor: 'leather_armor' }],
  ['mage_cloak', 'menu', 'mage', { armor: 'cloak' }],
  ['archer_hood', 'menu', 'archer', { armor: 'cloak', weapon: 'longbow' }],
  ['archer_leather', 'menu', 'archer', { helm: 'leather_helm', armor: 'leather_armor', weapon: 'crossbow' }],
  ['mage_leather_orb', 'menu', 'mage', { helm: 'leather_helm', armor: 'robe', weapon: 'staff', offhand: 'orb' }],
  ['mage_robe_orb', 'menu', 'mage', { armor: 'robe', weapon: 'staff', offhand: 'orb' }],
  ['warrior_cloak_sword', 'menu', 'warrior', { armor: 'cloak', weapon: 'sword' }],
  ['archer_leather_bow', 'menu', 'archer', { armor: 'leather_armor', weapon: 'shortbow' }],
  ['play_mage_orb', 'play', 'mage', { weapon: 'staff', offhand: 'orb' }],
  ['play_warrior', 'play', 'warrior', {}], ['play_mage', 'play', 'mage', {}], ['play_archer', 'play', 'archer', {}],
  ['inv_mage', 'inv', 'mage', {}], ['inv_archer', 'inv', 'archer', {}],
];
const G = await openGame();
const report = [];
for (const [name, screen, cls, eq] of SETS) {
  const url = await G.page.evaluate(([screen, cls, eq]) => {
    const S = SIM.spawn(0, {}); S.meta.shards = 9999;
    if (screen === 'menu') { S.saved = SIM.newRun(S, 'campaign', 5, { cls }); const R = S.saved;
      for (const [slot, b] of Object.entries(eq)) R.hero.eq[slot] = Object.assign(SIM.rollItem(R, 1, 0, slot), { b, id: R.nextId++ }); }
    else { SIM.step(S, { keys: [] }); S.run = SIM.newRun(S, 'campaign', 1234, { cls }); S.screen = 'play';
      for (const [slot, b] of Object.entries(eq)) S.run.hero.eq[slot] = Object.assign(SIM.rollItem(S.run, 1, 0, slot), { b, id: S.run.nextId++ }); for (let i = 0; i < 30; i++) SIM.step(S, { px: 960, py: 540, keys: [] }); S.screen = screen; }
    SCENE.state = S; SCENE.render(S.t + 0.01); return document.getElementById('c').toDataURL('image/png');
  }, [screen, cls, eq]);
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  report.push(name);
}
console.log('frames:', report.join(' '), '| errors:', G.errors.length ? G.errors.join(' | ') : 'none');
await G.close();
