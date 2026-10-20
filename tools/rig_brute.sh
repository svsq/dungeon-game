#!/bin/sh
# the demon brute (and boss) rig, cut from its approved sprite: hanging arms by polygon (narrowed where the claws overlap the thighs)
set -e
cp art/gen/en_brute.png art/gen/brute.png
python3 ~/.claude/skills/ref2game/scripts/rigcut.py brute --elbow --face right --knee L=0.78,R=0.8 --hip L=175,R=178 \
 --thigh "L=58,178;112,178;112,220;60,220" --thigh "R=178,178;212,178;212,220;178,220" \
 --arm "L=40,55;85,70;85,120;70,150;60,170;56,236;0,236;0,140;20,110;35,70" --sh L=60,95 --hand L=28,205 \
 --arm "R=200,58;250,68;275,98;287,140;287,242;230,242;212,215;205,195;222,175;215,140;205,110" --sh R=228,100 --hand R=250,205
python3 tools/armsplit.py brute L "40,55;88,70;85,125;55,160;12,150;25,100" 35,150 R "198,56;252,66;278,100;287,150;240,160;212,140;204,105" 255,150
python3 tools/partmove.py brute farmR "213,185;225,174;262,174;284,190;284,236;256,241;240,249;224,246;217,226;211,201" thighR shinR
python3 tools/partfill.py brute thighR "212,180;232,182;234,215;230,248;212,250"
# hip caps (TASKS 129): the thighs turn −0.63…+0.33 (L) and −0.96…+0.17 rad (R) over the QA attacks, deaths and walks
python3 tools/jointcap.py brute "thighL:hipL:14" "thighR:hipR:14"
python3 tools/jointgap.py brute "thighL:hipL:14:-0.65,0.35" "thighR:hipR:14:-0.98,0.2"
