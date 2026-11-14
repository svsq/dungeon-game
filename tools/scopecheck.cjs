// node tools/scopecheck.cjs — the load order of the layers (ARCHITECTURE.md §4, TASKS 2060). Exit 2 on failure.
// A file of live/ takes names out of a shared table as it loads (`const { a, b } = SIMX | D | DGX`, at the IIFE's top level). A name
// the files before it have not put there is `undefined` with no error, and fails as a TypeError in the middle of a step, far from the cause.
// This loads the sim through Node's own require and, before each file of live/ runs, checks that every name it takes is already there;
// then it checks that every file the Node load reached is in modules.js's `page` (a file the page never loads would only fail in the browser).
const fs = require('fs'), path = require('path'), Module = require('module'), { code } = require('./jsscan.cjs');
const LIVE = path.join(__dirname, '..', 'live') + path.sep, fails = [], loaded = [];
const TABLE = { SIMX: () => globalThis.SIMX, D: () => globalThis.DATA, DGX: () => globalThis.DGX };
const TAKE = /^  const (?:[^\n{;]*?,\s*)?\{([^{}]*)\}\s*=\s*(SIMX|D|DGX)(?![.\w])/gm;
const names = (body) => body.split(',').map((s) => s.trim().replace(/^\.\.\./, '')).filter(Boolean).map((s) => s.split(':')[0].split('=')[0].trim());
const load = Module._load;
const verify = (rel, src) => {
  for (const m of src.matchAll(TAKE)) {
    const table = TABLE[m[2]]();
    for (const n of names(m[1])) if (!table || !(n in table)) fails.push(`${rel}: takes ${n} from ${m[2]}, which no file before it provides`);
  }
};
Module._load = function (request, parent, isMain) {
  const file = parent && request.startsWith('.') ? path.resolve(path.dirname(parent.filename), request) : '';
  const rel = file.startsWith(LIVE) ? path.relative(LIVE, file.endsWith('.js') ? file : file + '.js') : '';
  if (!rel || loaded.includes(rel)) return load.call(this, request, parent, isMain);
  loaded.push(rel);
  const raw = fs.readFileSync(path.join(LIVE, rel), 'utf8'), src = code(raw, true);
  // sim.js, data.js and dungeon.js load their parts first and take names after them: their own line is checked once the parts are in
  const parent_ = /require\('\.\/modules\.js'\)\.parts/.test(raw);
  if (!parent_) verify(rel, src);
  const got = load.call(this, request, parent, isMain);
  if (parent_) verify(rel, src);
  return got;
};
// the page's order: data (its parts first), the generator, the sim (its parts first)
for (const f of ['data.js', 'dungeon.js', 'sim.js']) require('../live/' + f);
Module._load = load;
const M = require('../live/modules.js'), PAGE = new Set(M.page);
for (const f of loaded) if (!PAGE.has(f) && f !== 'modules.js' && !/^sim_checks/.test(f) && !/^(text|ui)_files\.js$/.test(f)) fails.push(`${f}: loaded by Node but not in modules.js page`);
for (const f of fails) console.log('FAIL', f);
console.log(`scopecheck: ${loaded.length} files, ${fails.length ? fails.length + ' failure(s)' : 'ok'}`);
process.exitCode = fails.length ? 2 : 0;
