// node tools/export_data.cjs --out <data folder> --report <report folder> [--check]
// Writes DATA, as the game builds it, into JSON files by domain for the Godot port, and a report: where every table
// went or why it did not, every function with its place and kind, every value JSON could not hold as it was, and the
// text keys behind the shown strings. Both folders must be empty (a `version.json` the port keeps in the data folder
// is left alone). With --check nothing is written: a fresh export is compared byte for byte with both folders and any
// difference fails with exit code 2, which is how a second run proves the export repeats.
const path = require('path');
const { loadGameData } = require('./port_export/game_data.cjs');
const { DataExport } = require('./port_export/data_export.cjs');
const { writeOrCheck } = require('./port_export/file_tree.cjs');
const { optionsOf, runTool } = require('./port_export/options.cjs');

const TOOL = 'export_data';
const PORT_OWNED = ['version.json'];

runTool(TOOL, () => {
  const options = optionsOf(process.argv.slice(2), ['out', 'report'], ['check']);
  const { dataFiles, reportFiles } = new DataExport(loadGameData()).build();
  writeOrCheck(TOOL, [
    { files: dataFiles, folder: path.resolve(options.out), keep: PORT_OWNED },
    { files: reportFiles, folder: path.resolve(options.report) },
  ], options.check);
});
