// node tools/measure/game/sfx.cjs — event kinds the sim emits (`ev(S, { k: '…' })` in live/sim*.js) that no `case`/key in
// live/audio.js answers; sounds are placeholders, this only checks that an action has a sound hook at all
const fs = require('fs'), path = require('path'), ROOT = path.resolve(process.env.ROOT || path.join(__dirname, '../../..'));
const sim = fs.readdirSync(ROOT + '/live').filter((f) => /^sim.*\.js$/.test(f) && !/check/.test(f)).map((f) => fs.readFileSync(ROOT + '/live/' + f, 'utf8')).join('\n');
const audio = fs.readFileSync(ROOT + '/live/audio.js', 'utf8');
const kinds = new Set([...sim.matchAll(/ev\(S,\s*\{\s*k:\s*'([a-zA-Z_]+)'/g)].map((m) => m[1]));
const heard = (k) => new RegExp(`['"\`]${k}['"\`]|\\b${k}\\s*:`).test(audio);
const miss = [...kinds].filter((k) => !heard(k)).sort();
console.log(`event kinds ${kinds.size}, with a hook ${kinds.size - miss.length}, without ${miss.length}`); console.log('without:', miss.join(', '));
