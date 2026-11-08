#!/bin/sh
# the town sweeper rig, cut from her approved sprite: the kerchiefed head nods on the neck, both arms in two bones; her legs stay in
# the body under the long skirt
set -e
python3 tools/robecut.py town_sweeper art/gen/town_sweeper.png \
 "L:upper|70,84;40,86;20,105;8,130;2,150;20,160;45,155;52,130;60,110|fore|0,150;48,150;44,170;30,190;28,215;0,215|sh|40,104|elbow|22,150|hand|14,192" \
 "R:upper|112,100;128,106;140,128;140,160;118,160;106,130|fore|118,150;142,150;152,166;156,176;156,205;126,205;124,185;116,168|sh|118,115|elbow|128,150|hand|140,188" \
 "H:head|20,0;142,0;142,40;136,72;110,92;95,98;80,90;55,82;30,76;22,50|neck|95,88"
python3 tools/jointcap.py town_sweeper "uarmL:shL:12" "uarmR:shR:12"
