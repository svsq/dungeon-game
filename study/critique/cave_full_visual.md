# Полная проверка пещер: визуал, ассеты и кадр

31.10.2026. Независимый рецензент, runtime не менял. Баланс исключён. Это расширение r2: в r2 были выборочные листы; здесь просмотрены все84 подготовленных именных состояния и196 кадров трёх новых сквозных маршрутов seeds3/7/12, четыре этажа каждого. Обзорные листы сохранены в frames/cave_full_visual/states_0…4.jpg и play_0…8.jpg. Обзор позволяет судить композицию, но не равен просмотру каждого пикселя в полном разрешении.

## Оценки и итог

Палитра7, материалы7, кадр7,5, ассеты8, HUD8. Новых подтверждённых дефектов сверх336 не найдено. Главный художественный остаток — геометрические полосы предупреждения волны/веера поверх пустоты. Спокойная вода проще ref1, верх скалы округлее; эти известные отличия не скрыты оценкой7. Камера/контур соответствуют низкой игре ref.png, не высокой концептной скале. Принятая область рефов — study/refs/README.md.

## Фактическое покрытие

| Набор | Просмотр | Результат |
|---|---|---|
| Все84 delivery | Пять обзорных листов, полный список ниже | Пол/вода/берег/пропсы/свет/карта/телеграфы/победа: нет нового явного разрыва |
| Три сквозных маршрута |196 кадров, девять обзорных листов | Все4этажа разных сидов сохраняют стиль; мосты/броды/лавка/лагерь/святилище/тайники/сражения/потоп/выход присутствуют |
| Крупные кадры | cave_monsters, skel_ranged, cave_bridge_v, cave_ford, serpent_bite_aim_6 | Сортировка, низкий берег, герои/монстры читаются; vertical bite условен, но шея связна |
| Пропсы | Собственный props.png:21 специализированный cave texture/prop | Обводки согласованы в игровом размере; исходный масштаб текстур не принят за экранную texel-density |
| Контуры | cave_art_final/contact.png | hero2,72/crab2,97; ford/lily/weed/water_stone2,31–2,83px, без прежних тонких форм |
| Новые UI cave | inventory_skills/pause/saved_menu/death полноразмерно; shop/altar/win в маршрутах | Текст внутри панелей, русский язык, cave save подпись корректна |
| Реакции | shroom/skel/shop-sign три возраста в delivery | Есть визуальный ответ; звук глазами не оценивается |

21 исходный prop/texture в собственном листе: bridge_post, bridge_torch, campfire_cv, crystal_cv, floor_cv_tex, ford_a/b, lily_cv, shore_cv_tex, shroom_a/b, skel_cv, stalag_a/b, tent_cv, wall_cv_tex, walltop_cv_tex, water_stone_a/b, weed_cv, wreck_cv. Merchant/chest/altar и старые skeleton/goblin/spider видны в собранных cave кадрах, не только на нейтральном листе. Элитные ауры, выстрелы, fireball и whirl присутствуют в сквозных снимках. Ни один обзорный кадр не доказывает полноту временного интервала эффекта — это отдельная проверка анимации.

## Честные ограничения

Не проводился ручной проход каждого процедурного сида, не просмотрены все1440 состояний actorJSON, не прослушан звук. Общие generic shop/pause/dead кампании не выдаются за cave: добавлены новые actual cave UI. Смерть в ui_death вызвана диагностическим источником, поэтому надпись «неизвестный источник» не признана игровым дефектом. Проверка мобильных размеров/контроллера вне этого прогона.

## Все84 просмотренных имени

cave_arena_exit, cave_breach, cave_bridge, cave_bridge_v, cave_camp, cave_crossing, cave_fireball_deep_0, cave_fireball_deep_1, cave_fireball_deep_2, cave_flood_complete, cave_ford, cave_fraction_absorb, cave_fraction_hit, cave_fraction_hurt, cave_hall, cave_known_boundary, cave_known_dark, cave_light, cave_light_bridge_back, cave_light_bridge_front, cave_light_bridge_left, cave_light_bridge_right, cave_light_camp_back, cave_light_camp_front, cave_light_camp_left, cave_light_camp_right, cave_map_bottom, cave_map_left, cave_map_right, cave_map_top, cave_monsters, cave_phase2_attack, cave_reaction_shop_sign_0.08, cave_reaction_shop_sign_0.2, cave_reaction_shop_sign_0.5, cave_reaction_shroom_a_0.08, cave_reaction_shroom_a_0.2, cave_reaction_shroom_a_0.5, cave_reaction_skel_cv_0.08, cave_reaction_skel_cv_0.2, cave_reaction_skel_cv_0.5, cave_spring, cave_wade_back_idle, cave_wade_back_stride, cave_wade_front_idle, cave_wade_front_stride, cave_wade_left_idle, cave_wade_left_stride, cave_wade_right_idle, cave_wade_right_stride, cave_water, cave_waterfall, cave_wreck, completion_85, crab_facings, eel_states, serpent_arena, serpent_attack_bite, serpent_attack_fan, serpent_attack_tail, serpent_attack_wave, serpent_bite_aim_0, serpent_bite_aim_1, serpent_bite_aim_2, serpent_bite_aim_3, serpent_bite_aim_4, serpent_bite_aim_5, serpent_bite_aim_6, serpent_bite_aim_7, serpent_emerge_warning, serpent_emit_fan_-1, serpent_emit_fan_1, serpent_emit_wave, serpent_flood, serpent_flood_warning, serpent_punish_window, serpent_warn_bite, serpent_warn_fan, serpent_warn_tail, serpent_warn_wave, skel_ranged, win_cave, win_cave_worst, zone_cave

## Собственный численный контроль композиции

Одинаковая ROI [370,250,1550,1000], без основной частиHUD, доля почти чёрных пикселей(maxRGB<8): water31,76%, bridge_v39,56%, ford47,86%, hall82,31%, warn_wave58,69%. СреднийRGB остальных пикселей48,36/52,50/50,48/55,97/54,02. JSON — frames/cave_full_visual/frame_measurements.json. Это не Lab и не целевая доля освещения: hall показывает локально исследованное пространство. Замер подтверждает, почему его нельзя использовать как единственный общий кадр материалов или объявлять всю воду слишком тёмной по среднему экрану. Освещённые материалы не провалены в чёрный, чёрный занимает неизвестную/внешнюю область.

Дополнительно просмотрен ui_inventory_after_clicks.png полноразмерно: сила6/очки26, fireballранг2/очки8, HP-зелья4 и MP-зелье1 согласованы с состоянием после взаимодействий; переполнения строк или разъезда карточек нет.
