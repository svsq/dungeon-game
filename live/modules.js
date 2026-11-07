// live/modules.js — the page's scripts in load order (ARCHITECTURE.md §4). index.html loads and watches `page`; a layer's
// Node entry point (data.js) requires its `parts` from here, so a new file is listed once.
(function (root) {
  const parts = { data: ['data_core.js', 'data_balance.js', 'data_world.js', 'data_enemies.js', 'data_items.js', 'data_runs.js', 'data_hero.js', 'data_town.js', 'data_ui.js'] };
  const page = ['assets.js', 'sizes.js', 'rigs.js', 'gl.js', 'lib.js', ...parts.data, 'data.js', 'dungeon.js', 'sim.js', 'monsters.js', 'scene.js', 'hud.js', 'audio.js'];
  root.MODULES = { parts, page };
  if (typeof module !== 'undefined') module.exports = root.MODULES;
})(typeof window !== 'undefined' ? window : globalThis);
