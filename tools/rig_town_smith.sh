#!/bin/sh
# the town smith rig, cut from his approved sprite (art/gen/town_smith.png): the long apron stays on the body down to the knees, the thighs
# are what shows under its hem; hair and beard nod on the neck
set -e
python3 ~/.claude/skills/ref2game/scripts/rigcut.py town_smith --elbow --face right --knee 0.82 \
 --arm "L=56,78;38,76;18,92;8,115;-4,138;-4,150;-2,162;-4,185;-4,200;26,214;40,210;40,190;36,172;44,155;54,140;56,115" --sh L=36,96 --hand L=22,190 \
 --arm "R=120,76;136,76;150,92;152,115;148,134;158,140;158,160;156,180;158,200;154,214;132,214;130,190;128,172;124,150;118,130;116,100" --sh R=132,96 --hand R=144,192
python3 tools/partcut.py town_smith "head:34,-4;122,-4;124,30;120,60;104,74;80,76;60,68;42,56;34,30|88,68|fill"
python3 tools/jointcap.py town_smith "uarmL:shL:12" "uarmR:shR:12" "thighL:hipL:12" "thighR:hipR:12"
