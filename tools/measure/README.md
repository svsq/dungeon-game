# Замеры критиков

Здесь лежат скрипты, которыми критики и задачи меряют кадры и симуляцию. Папка в git. Выходы скриптов (кадры, листы, json, логи) кладутся в `frames/…`: `frames/` не в git, игрок его чистит, а скрипты при этом остаются.

Правило (12.11.2026): каждый критик сохраняет свои скрипты в `tools/measure/<критик>/` и коммитит их вместе с отчётом. Раньше скрипты лежали в `study/critique/measure/` и `frames/critic_*`, и почти все пропали при чистке (список в `study/critique/MAGMA_LIMITS.md`).

## Папки

- `game/`: геймплей, симуляция без браузера (`survey.cjs`, `lib.cjs`, `dbg.cjs`).
- `motion/`: анимация, тела для `evalq.mjs` (`gate.js`, `gatet.js`, `flash.js`, `strip14.js`, `victor.js`, `pops.js`, `volley.js`, `coffin.js` …) и `trace.mjs`.
- `fidelity/`: сверка с `study/refs/ref_cave_lava.png`, Lab-замеры по кадрам (`mask14.py`, `falledge.py`, `lemon.py`, `shoremap.*` …), общий модуль `labc.py`.
- `frame/`: кадр, наборы состояний для `shot.mjs` (`set1.js`, `set2.js`, `set3.js`, `shore.js`, `chapter.js`) и разбор (`census.py`, `blobs.py`, `nn.py`, `shore_offset.py`).

Новый раунд правит скрипт на месте, старая версия остаётся в истории git. Если скрипт меряет иначе, чем раньше, это пишется в отчёте и в `MAGMA_LIMITS.md` («Замечания к старым замерам»).

## Пути

Корень рабочей копии скрипт берёт из `ROOT`, а без него из своего места (`tools/measure/<критик>/` → три уровня вверх). Абсолютных путей к рабочим копиям в скриптах быть не должно. Пути к кадрам раунда внутри скриптов (`frames/critic_r14_fidelity/qa/` и т. п.) следующий критик меняет на свой раунд.

## Запуск

Из корня рабочей копии:

```sh
node tools/measure/game/survey.cjs 30                       # или ROOT=/путь/к/копии node …
node tools/measure/motion/evalq.mjs tools/measure/motion/gatet.js frames/critic_r15_motion/gatet.json
node tools/measure/motion/trace.mjs frames/critic_r15_motion/trace.json imp_claw,golem_crust_regrow
node tools/measure/frame/shot.mjs tools/measure/frame/set1.js frames/critic_r15_frame/set1 > frames/critic_r15_frame/set1_log.txt
python3 tools/measure/fidelity/mask14.py frames/critic_r15_fidelity/qa/
```

Браузерные скрипты берут playwright из `~/.claude/skills/ref2game/scripts`, поднимают свой сервер на случайном порту и закрывают его сами. Python: numpy, Pillow, scipy.
