#!/bin/sh
set -eu
python3 tools/rig_serpent.py
python3 tools/prep.py --only serpent__body,serpent__tail,serpent__head,serpent__neckU,serpent__neckL
python3 "${REF2GAME_SKILL:-$HOME/.claude/skills/ref2game}/scripts/softbones.py" art/softbones.json serpent__body serpent__tail
python3 tools/prep.py --only serpent__body_w,serpent__tail_w
