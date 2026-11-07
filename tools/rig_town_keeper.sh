#!/bin/sh
# the town keeper rig, cut from his approved sprite (art/gen/town_keeper.png): the cloak hangs behind both arms, so the arms are cut
# from where the sleeves leave it and rigcut back-fills the cloak; the bald head and beard nod on the neck
set -e
python3 ~/.claude/skills/ref2game/scripts/rigcut.py town_keeper --elbow --face right --knee 0.80 \
 --arm "L=28,158;50,152;66,160;62,176;60,196;54,206;40,204;32,190;34,176;26,170" --sh L=50,152 --hand L=46,190 \
 --arm "R=132,144;148,146;158,158;166,172;168,198;158,202;148,192;142,178;132,166;128,152" --sh R=140,150 --hand R=152,185
python3 tools/partcut.py town_keeper "head:62,0;132,0;134,30;128,52;126,75;116,102;98,108;90,90;80,78;66,62;64,35|98,62|fill"
python3 tools/jointcap.py town_keeper "uarmL:shL:12" "uarmR:shR:12" "thighL:hipL:12" "thighR:hipR:12"
python3 tools/keeperhip.py
