#!/bin/sh
# the skeleton archer rig (TASKS 311), cut from its approved sprite (art/gen/en_skel_archer.png): the bracer rides the bow arm's
# forearm (R, the near one), the quiver stays on the body, the skull comes off on death; the bow is a part of its own (skel_archer_weapon)
set -e
cp art/gen/en_skel_archer.png art/gen/skel_archer.png
python3 ~/.claude/skills/ref2game/scripts/rigcut.py skel_archer --elbow --face right --knee L=0.70,R=0.765 --hip L=184,R=205 --thigh "L=62,190;84,180;104,178;100,196;92,214;84,230;58,228;56,206" \
 --arm "L=54,100;74,98;68,124;60,140;50,158;40,172;44,190;40,212;18,214;4,200;4,180;14,168;30,150;42,128;50,104" --sh L=66,102 --hand L=24,186 \
 --arm "R=166,104;184,102;188,110;192,128;198,146;214,150;222,160;224,186;234,194;238,214;228,232;204,230;196,210;198,190;192,170;184,152;176,134;166,114" --sh R=176,106 --hand R=216,206
python3 tools/armsplit.py skel_archer L "50,96;78,96;70,124;58,142;44,140;48,120" 52,138 R "156,98;190,98;196,128;206,150;192,158;172,140;158,116" 196,152
python3 tools/partcut.py skel_archer "skull:70,4;135,2;140,30;138,60;128,80;110,88;84,88;72,72;66,50|110,86"
python3 tools/jointcap.py skel_archer "uarmL:shL:12" "uarmR:shR:12"
python3 tools/rigset.py skel_archer weaponLen=196 weaponGrip=0.5
