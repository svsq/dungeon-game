// node tools/export_floor_dumps.cjs --out <floors folder> [--check]
// Lays every floor of each run (campaign through the town, caves, magma, the endless descent after the campaign) for
// run seeds 1 to 40 with the game's genFloor and writes canonical JSON for the Godot port: a file per run and seed with
// each floor's tries, the checkpoints after each generator stage, a summary and, for the first ten seeds, the whole map.
// The folder must be empty (a `README.md` the port keeps there is left alone). With --check nothing is written: a fresh
// run is compared byte for byte and a difference exits with code 2.
const path = require('path');
const { FloorDumps } = require('./port_export/floor_dumps.cjs');
const { writeOrCheck } = require('./port_export/file_tree.cjs');
const { optionsOf, runTool } = require('./port_export/options.cjs');

const TOOL = 'export_floor_dumps';
const PORT_OWNED = ['README.md'];

runTool(TOOL, () => {
  const options = optionsOf(process.argv.slice(2), ['out'], ['check']);
  const files = new FloorDumps((file) => process.stderr.write(`${TOOL}: ${file}\r`)).build();
  process.stderr.write('\n');
  writeOrCheck(TOOL, [{ files, folder: path.resolve(options.out), keep: PORT_OWNED }], options.check);
});
