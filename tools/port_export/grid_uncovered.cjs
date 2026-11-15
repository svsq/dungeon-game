// Why a function kind stays out of the balance grid. Every function of such a kind is listed one by one in the coverage
// file with this reason.
const UNCOVERED_KINDS = {
  text: 'builds the shown text; the port makes it from translation templates with named parameters and checks it in text tests',
  ui: 'screen layout and screen logic; screens are Godot scenes in the port and this table is not exported',
  view: 'serves drawing only (rails, cart pose, the town folk start); the port draws in Godot and takes the town layout from its own export',
  load: 'bakes text once while the data loads; the port keeps numbers as text parameters instead',
};

module.exports = { UNCOVERED_KINDS };
