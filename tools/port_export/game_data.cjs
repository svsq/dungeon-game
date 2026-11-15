// Loads DATA the way the game builds it (every data file in load order, spreads and pushes done) and notes which file
// put each name into DATA, so a report can say where a table or a function lives.
const path = require('path');

const LIVE = path.join(__dirname, '..', '..', 'live');

function loadGameData() {
  const modules = require(path.join(LIVE, 'modules.js'));
  const sourceOf = {};
  for (const file of modules.parts.data) {
    require(path.join(LIVE, file));
    for (const name of Object.keys(globalThis.DATA || {})) if (!(name in sourceOf)) sourceOf[name] = 'live/' + file;
  }
  const data = require(path.join(LIVE, 'data.js'));
  return { data, text: globalThis.TEXT, sourceOf };
}

module.exports = { loadGameData };
