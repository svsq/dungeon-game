// live/modules.js — the page's scripts in load order (ARCHITECTURE.md §4). index.html loads and watches `page`; a layer's
// Node entry point (data.js) requires its `parts` from here, so a new file is listed once.
(function (root) {
  const parts = { data: ['text_ru.js', 'text.js', 'data_core.js', 'data_balance.js', 'data_world.js', 'data_enemies.js', 'data_items.js', 'data_runs.js', 'data_hero.js', 'data_powers.js', 'data_forks.js', 'data_town.js', 'data_changes.js', 'data_ui.js'],
    sim: ['sim_core.js', 'sim_items.js', 'sim_floor.js', 'sim_enemies.js', 'sim_hero.js', 'sim_world.js', 'sim_powers.js', 'sim_unlocks.js', 'sim_bosses.js', 'sim_town.js', 'sim_ui.js'],
    dungeon: ['dungeon_rooms.js', 'dungeon_links.js', 'dungeon_terrain.js', 'dungeon_fill.js'],
    scene: ['scene_core.js', 'scene_map.js', 'scene_folk.js', 'scene_hero.js', 'scene_actors.js'] };
  const page = ['assets.js', 'sizes.js', 'rigs.js', 'gl.js', 'font_data.js', 'lib.js', ...parts.data, 'data.js', 'dungeon.js', ...parts.dungeon, ...parts.sim, 'sim.js', 'monsters.js', ...parts.scene, 'scene.js', 'scene_world.js', 'scene_light.js', 'scene_fx.js', 'scene_qa.js', 'hud.js', 'audio.js'];
  root.MODULES = { parts, page };
  if (typeof module !== 'undefined') module.exports = root.MODULES;
})(typeof window !== 'undefined' ? window : globalThis);
