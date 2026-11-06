#!/bin/sh
# the town guard rig, cut from his approved sprite (art/gen/town_guard.png): the helmet and face nod on the neck, the scabbarded
# short sword is a part of its own so it hangs from the belt instead of riding the thigh
set -e
python3 ~/.claude/skills/ref2game/scripts/rigcut.py town_guard --elbow --face right --knee 0.80 \
 --arm "L=62,84;40,86;20,112;6,135;4,170;0,208;36,208;42,170;52,140;62,120;64,100" --sh L=42,100 --hand L=18,185 \
 --arm "R=122,86;136,92;152,110;154,132;160,152;176,160;176,205;140,205;138,180;140,160;132,140;124,120" --sh R=135,100 --hand R=155,182
python3 tools/partcut.py town_guard "head:40,0;150,0;132,50;125,75;110,84;85,86;70,78;60,62;40,46|98,82" \
 "sword:52,142;72,142;70,175;66,232;50,236;50,200|60,150|fill"
python3 tools/jointcap.py town_guard "uarmL:shL:12" "uarmR:shR:12" "thighL:hipL:12" "thighR:hipR:12"
