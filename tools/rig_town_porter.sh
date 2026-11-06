#!/bin/sh
# the town porter rig, cut from his approved sprite (art/gen/town_porter.png): the cap and face nod on the neck
set -e
python3 ~/.claude/skills/ref2game/scripts/rigcut.py town_porter --elbow --face right --knee 0.80 \
 --arm "L=60,82;40,84;22,96;10,120;6,140;2,180;4,200;28,200;28,176;36,146;50,140;52,120;54,100" --sh L=36,104 --hand L=14,185 \
 --arm "R=98,84;110,88;122,100;126,120;122,138;138,150;138,200;112,200;108,175;104,150;98,138;96,110" --sh R=108,104 --hand R=125,178
python3 tools/partcut.py town_porter "head:28,0;122,0;126,30;100,78;82,82;60,76;40,70;28,50|74,78"
python3 tools/jointcap.py town_porter "uarmL:shL:12" "uarmR:shR:12" "thighL:hipL:12" "thighR:hipR:12"
