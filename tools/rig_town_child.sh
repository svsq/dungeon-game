#!/bin/sh
# the town child rig, cut from its approved sprite (art/gen/town_child.png): the big head nods on the neck
set -e
python3 ~/.claude/skills/ref2game/scripts/rigcut.py town_child --elbow --face right --knee 0.82 \
 --arm "L=50,114;35,116;12,126;8,150;10,166;0,176;0,218;28,218;30,196;44,178;46,150;52,130" --sh L=36,128 --hand L=20,195 \
 --arm "R=104,116;116,120;122,140;122,158;114,162;134,168;148,190;148,216;122,216;112,196;108,175;104,150;100,130" --sh R=110,132 --hand R=128,190
python3 tools/partcut.py town_child "head:6,0;144,0;146,70;128,100;108,112;70,112;50,104;10,96|85,110"
python3 tools/jointcap.py town_child "uarmL:shL:12" "uarmR:shR:12" "thighL:hipL:12" "thighR:hipR:12"
python3 tools/childface.py
