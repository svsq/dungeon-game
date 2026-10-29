# Проверки завершения пещер

29.10.2026. База: `0c70d55`. План: `CAVE_FINISH_PLAN.md`.

| Область | Проверка | Результат | Материалы |
|---|---|---|---|
| Исходная симуляция | `node live/tune.cjs` | PASS: demoCheck, selfCheck | вывод команды |
| Исходный полный QA | `node ~/.claude/skills/ref2game/scripts/qa.mjs --out frames/cave_before` | FAIL: только boss_combo, handL @34, скачок 107,7 px | frames/cave_before/report.json |
| 319 | `node live/tune.cjs`; QA `--only ui --out frames/cave_319` | PASS, 305 HUD-состояний; точки secret удалены, foe/loot сохранены | frames/cave_319/report.json |

Остальные пункты плана пока не проверены. Исторические результаты не считаются приёмкой текущих исправлений. Критиков не запускать.
