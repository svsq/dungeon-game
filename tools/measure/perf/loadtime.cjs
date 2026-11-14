// node tools/measure/perf/loadtime.cjs
// Task 2040: what `require('live/sim.js')` costs a Node consumer (bot.cjs, playtest, difficulty workers, tune.cjs), per file:
// sim.js pulls in sim_checks*.js at its end (C3 of study/refactor2/sim.md). Times are cold, one process.
const Module = require('module'), path = require('path'), fs = require('fs');
const root = process.env.ROOT || path.resolve(__dirname, '../../..'), rows = [], orig = Module._extensions['.js'];
Module._extensions['.js'] = function (m, f) { const t = process.hrtime.bigint(); orig(m, f); rows.push([path.basename(f), Number(process.hrtime.bigint() - t) / 1e6, fs.statSync(f).size]); };
const t0 = process.hrtime.bigint(), h0 = process.memoryUsage().heapUsed;
require(path.join(root, 'live/sim.js'));
const total = Number(process.hrtime.bigint() - t0) / 1e6, heap = (process.memoryUsage().heapUsed - h0) / 1048576;
const checks = rows.filter(([n]) => /^sim_checks/.test(n)), other = rows.filter(([n]) => !/^sim_checks/.test(n));
const sum = (a, i) => a.reduce((s, r) => s + r[i], 0);
console.log(`require sim.js: ${total.toFixed(0)} ms, +${heap.toFixed(1)} MB heap (nested times below include their own children)`);
for (const [n, ms, b] of checks) console.log(`  ${n.padEnd(24)} ${ms.toFixed(0).padStart(5)} ms  ${(b / 1024).toFixed(0).padStart(5)} KB`);
console.log(`checks files: ${(sum(checks, 2) / 1024).toFixed(0)} KB of ${((sum(checks, 2) + sum(other, 2)) / 1024).toFixed(0)} KB loaded; self time of sim_checks.js module body is the number above`);
