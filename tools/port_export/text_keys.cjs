// Data tables hold text already looked up by key (the shown Russian string, not the key). This maps each such string in
// the exported files back to the text keys whose Russian value it is, so the port can put keys back in their place.
// Strings no key yields (notes, talk and names come from generated text tables) are counted by file.
const SHOWN_TEXT = /[А-Яа-яЁё]/;

function keysByValue(text) {
  const byValue = new Map();
  for (const [key, value] of Object.entries(text.ru)) {
    if (typeof value !== 'string') continue;
    if (!byValue.has(value)) byValue.set(value, []);
    byValue.get(value).push(key);
  }
  return byValue;
}

function eachString(value, place, visit) {
  if (typeof value === 'string') return visit(value, place);
  if (value && typeof value === 'object') for (const key of Object.keys(value)) eachString(value[key], place + '/' + key, visit);
}

function textKeysOf(dataFiles, text) {
  const byValue = keysByValue(text), keys = {}, withoutKey = {};
  for (const [file, content] of dataFiles) {
    eachString(JSON.parse(content), file, (value, place) => {
      if (!SHOWN_TEXT.test(value)) return;
      const found = byValue.get(value);
      if (found) keys[place] = found;
      else withoutKey[file] = (withoutKey[file] || 0) + 1;
    });
  }
  return { keys, stringsWithoutKey: withoutKey };
}

module.exports = { textKeysOf };
