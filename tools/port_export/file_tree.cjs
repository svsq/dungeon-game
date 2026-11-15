// A set of output files kept in memory as { relative path → text }, written once or compared byte for byte with a
// folder written before. Writing never deletes: the target folder has to be empty, so a stale file cannot survive.
const fs = require('fs'), path = require('path');

const ENCODING = 'utf8';

function jsonText(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function filesUnder(folder) {
  if (!fs.existsSync(folder)) return [];
  const found = [];
  const visit = (relative) => {
    for (const entry of fs.readdirSync(path.join(folder, relative), { withFileTypes: true })) {
      const child = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isDirectory()) visit(child);
      else found.push(child);
    }
  };
  visit('');
  return found.sort();
}

function writeTree(files, folder, keep = []) {
  const present = filesUnder(folder).filter((file) => !keep.includes(file));
  if (present.length) throw new Error(`${folder} is not empty (${present.slice(0, 3).join(', ')}…); give an empty folder`);
  for (const [relative, text] of files) {
    const target = path.join(folder, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text, ENCODING);
  }
}

function compareTree(files, folder, keep = []) {
  const problems = [];
  const present = new Set(filesUnder(folder).filter((file) => !keep.includes(file)));
  for (const [relative, text] of files) {
    if (!present.has(relative)) problems.push('missing ' + relative);
    else if (fs.readFileSync(path.join(folder, relative), ENCODING) !== text) problems.push('differs ' + relative);
    present.delete(relative);
  }
  for (const extra of present) problems.push('extra ' + extra);
  return problems;
}

const EXIT_DIFFERS = 2, SHOWN_PROBLEMS = 40;

function writeOrCheck(tool, targets, check) {
  if (check) {
    const problems = targets.flatMap(({ files, folder, keep }) => compareTree(files, folder, keep));
    if (problems.length) {
      console.error(`${tool}: the output differs:\n  ` + problems.slice(0, SHOWN_PROBLEMS).join('\n  '));
      process.exit(EXIT_DIFFERS);
    }
  } else {
    for (const { files, folder, keep } of targets) writeTree(files, folder, keep);
  }
  const counts = targets.map(({ files, folder }) => `${files.size} files ${check ? 'match' : 'written'} in ${folder}`);
  console.log(`${tool}: ${counts.join('; ')}`);
}

module.exports = { jsonText, writeTree, compareTree, writeOrCheck };
