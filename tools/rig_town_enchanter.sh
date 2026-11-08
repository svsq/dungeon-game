#!/bin/sh
# the town enchanter rig, cut from his approved sprite: hood and face nod on the neck, both arms in two bones with the wide sleeves;
# his legs stay in the body under the robe
set -e
python3 tools/robecut.py town_enchanter art/gen/town_enchanter.png \
 "L:upper|70,100;40,104;18,125;5,150;5,162;38,160;55,140;62,120|fore|2,158;42,158;55,172;40,185;28,200;2,200;0,178|sh|48,108|elbow|28,158|hand|14,185" \
 "R:upper|85,100;115,102;135,118;148,145;150,160;118,160;106,140;100,120|fore|112,158;150,158;152,172;148,202;130,202;122,185;110,172|sh|112,108|elbow|130,158|hand|140,188" \
 "H:head|22,-2;130,-2;134,50;134,70;126,90;105,97;80,98;55,92;35,80;24,50|neck|88,88"
python3 tools/jointcap.py town_enchanter "uarmL:shL:12" "uarmR:shR:12"
