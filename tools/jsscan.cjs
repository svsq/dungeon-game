// tools/jsscan.cjs — a small JS scanner for the checks that read the game's code as text (textcheck.cjs, layercheck.cjs): code(src)
// is the source with its comments cut out; code(src, true) also empties strings, templates' text and regexes, leaving only code.
// the comments cut out; strings, templates and regexes kept (a regex is told from a division by what stands before it)
function code(src, blank = false) {
  let out = '', i = 0; const n = src.length, stack = [];
  const regexOk = () => { const t = out.replace(/\s+$/, ''); const c = t[t.length - 1]; return !c || /[(,=:[!&|?{};+\-*%<>~^]/.test(c) || /\b(return|typeof|case|in|of|new|delete|void|throw)$/.test(t); };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i = src.indexOf('*/', i + 2) + 2; continue; }
    if (c === "'" || c === '"') { let j = i + 1; while (src[j] !== c) j += src[j] === '\\' ? 2 : 1; out += blank ? c + c : src.slice(i, j + 1); i = j + 1; continue; }
    if (c === '`') { stack.push('`'); out += c; i++; while (i < n) { if (src[i] === '\\') { out += src.slice(i, i + 2); i += 2; continue; } if (src[i] === '`') { out += '`'; i++; stack.pop(); break; }
      if (src[i] === '$' && src[i + 1] === '{') { out += '${'; i += 2; let depth = 1, j = i; while (depth) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; if (depth) j++; } out += code(src.slice(i, j), blank) + '}'; i = j + 1; continue; }
      out += blank && src[i] !== '\n' ? ' ' : src[i]; i++; } continue; }
    if (c === '/' && regexOk()) { let j = i + 1, cls = false; while (j < n && (src[j] !== '/' || cls)) { if (src[j] === '\\') j++; else if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; j++; } out += blank ? '/ /' : src.slice(i, j + 1); i = j + 1; continue; }
    out += c; i++;
  }
  return out;
}
module.exports = { code };
