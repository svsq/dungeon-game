// node tools/export_balance_grid.cjs --out <grid folder> [--check]
// Calls every function the data export (tools/export_data.cjs) leaves as code or as a marker over the game's range of
// inputs (levels, floors 0 to past the end of the deep curve, ranks, tiers, classes, enemy types, bases, modes, seeds)
// and writes one JSON file per function (input, result, the input after the call when the call changed it) and
// `coverage.json`, where each function is either on the grid or named with the reason it is not. The folder must be
// empty. With --check nothing is written: a fresh run is compared byte for byte and a difference exits with code 2.
const path = require('path');
const { loadGameData } = require('./port_export/game_data.cjs');
const { BalanceGrid } = require('./port_export/balance_grid.cjs');
const { writeOrCheck } = require('./port_export/file_tree.cjs');
const { optionsOf, runTool } = require('./port_export/options.cjs');

const TOOL = 'export_balance_grid';

runTool(TOOL, () => {
  const options = optionsOf(process.argv.slice(2), ['out'], ['check']);
  const files = new BalanceGrid(loadGameData()).build();
  writeOrCheck(TOOL, [{ files, folder: path.resolve(options.out) }], options.check);
});
