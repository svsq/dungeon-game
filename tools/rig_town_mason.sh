#!/bin/sh
# the town mason rig, cut from his approved sprite (art/gen/town_mason.png): the bald head and beard nod on the neck
set -e
python3 ~/.claude/skills/ref2game/scripts/rigcut.py town_mason --elbow --face right --knee 0.80 \
 --arm "L=45,62;26,69;14,98;5,121;9,131;5,159;3,175;15,196;30,190;30,175;35,154;42,134;42,123;53,113;54,85;53,67" --sh L=33,82 --hand L=17,177 \
 --arm "R=105,67;116,74;123,95;134,113;131,128;139,157;143,175;136,193;122,194;121,175;113,152;112,131;109,123;111,103" --sh R=114,89 --hand R=131,177
python3 tools/partcut.py town_mason "head:49,0;108,0;110,36;103,63;77,66;62,60;50,33|80,64"
python3 tools/jointcap.py town_mason "uarmL:shL:12" "uarmR:shR:12" "thighL:hipL:12" "thighR:hipR:12"
