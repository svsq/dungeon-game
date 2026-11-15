// node tools/export_data.cjs --out <data folder> --report <report folder> [--check]
// Writes DATA, as the game builds it, into JSON files by domain for the Godot port, and a report: where every table
// went or why it did not, every function with its place and kind, every value JSON could not hold as it was, and the
// text keys behind the shown strings. Both folders must be empty (a `version.json` the port keeps in the data folder
// is left alone). With --check nothing is written: a fresh export is compared byte for byte with both folders and any
// difference fails with exit code 2, which is how a second run proves the export repeats.
const path = require('path');
const { loadGameData } = require('./port_export/game_data.cjs');
const { DataExport } = require('./port_export/data_export.cjs');
const { writeTree, compareTree } = require('./port_export/file_tree.cjs');
const { optionsOf } = require('./port_export/options.cjs');

const PORT_OWNED = ['version.json'];
const EXIT_FAILED = 1, EXIT_DIFFERS = 2;

function main() {
  const options = optionsOf(process.argv.slice(2), ['out', 'report'], ['check']);
  const outFolder = path.resolve(options.out), reportFolder = path.resolve(options.report);
  const { dataFiles, reportFiles } = new DataExport(loadGameData()).build();
  if (options.check) {
    const problems = [...compareTree(dataFiles, outFolder, PORT_OWNED), ...compareTree(reportFiles, reportFolder)];
    if (problems.length) {
      console.error('export_data: the export differs:\n  ' + problems.slice(0, 40).join('\n  '));
      process.exit(EXIT_DIFFERS);
    }
    console.log(`export_data: ${dataFiles.size} data files and ${reportFiles.size} report files match`);
    return;
  }
  writeTree(dataFiles, outFolder, PORT_OWNED);
  writeTree(reportFiles, reportFolder);
  console.log(`export_data: ${dataFiles.size} data files in ${outFolder}, ${reportFiles.size} report files in ${reportFolder}`);
}

try {
  main();
} catch (error) {
  console.error('export_data: ' + error.message);
  process.exit(EXIT_FAILED);
}
