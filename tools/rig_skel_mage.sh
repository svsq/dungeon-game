#!/bin/sh
# the skeleton water mage rig (TASKS 311), cut from its approved sprite (art/gen/en_skel_mage.png): the weed hanging off the wrists
# rides the forearms, the thighs are cut below the hip cloth, the skull with its circlet of shells comes off on death
set -e
cp art/gen/en_skel_mage.png art/gen/skel_mage.png
python3 ~/.claude/skills/ref2game/scripts/rigcut.py skel_mage --elbow --face right --knee L=0.70,R=0.745 --hip L=186,R=186 \
 --thigh "L=100,182;124,182;116,212;108,222;88,220;92,204" --thigh "R=176,182;200,182;208,212;212,228;194,230;182,208" \
 --arm "L=78,104;96,102;96,125;90,140;82,150;82,196;66,198;58,172;30,176;10,166;2,150;4,128;20,118;36,124;52,130;68,130;74,118" --sh L=86,108 --hand L=34,150 \
 --arm "R=190,102;206,98;214,112;226,126;238,136;250,148;266,158;280,170;282,190;268,198;252,194;248,214;236,216;228,180;222,160;210,140;200,124;190,112" --sh R=198,106 --hand R=256,176
python3 tools/armsplit.py skel_mage L "74,100;100,100;98,128;90,140;76,138;70,120" 84,134 R "186,96;212,96;232,122;240,138;224,148;204,130;188,114" 228,138
python3 tools/partcut.py skel_mage "skull:86,2;172,2;174,40;162,62;152,84;124,88;104,84;96,62;86,40|126,84"
python3 tools/jointcap.py skel_mage "uarmL:shL:12" "uarmR:shR:12" "thighL:hipL:10" "thighR:hipR:10"
python3 tools/rigset.py skel_mage weaponLen=300 weaponGrip=0.57
