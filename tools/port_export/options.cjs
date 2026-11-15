// `--name value` options and `--flag` switches; an unknown or missing option stops the tool with its usage.
function optionsOf(args, required, switches = []) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const name = args[i].replace(/^--/, '');
    if (switches.includes(name)) options[name] = true;
    else if (required.includes(name) && i + 1 < args.length) options[name] = args[++i];
    else throw new Error(`unknown option ${args[i]}; usage: ${required.map((r) => `--${r} <folder>`).join(' ')} ${switches.map((s) => `[--${s}]`).join(' ')}`);
  }
  const missing = required.filter((name) => !options[name]);
  if (missing.length) throw new Error('missing option: --' + missing.join(', --'));
  return options;
}

module.exports = { optionsOf };
