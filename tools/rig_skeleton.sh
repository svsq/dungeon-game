#!/bin/sh
# the skeleton rig, cut from its approved sprite (art/gen/en_skeleton.png): arms by polygon (sword and shield ride the forearms),
# knees where they are drawn, elbows re-split at the real joint, the blade's drawn angle for the chop
set -e
cp art/gen/en_skeleton.png art/gen/skeleton.png
python3 ~/.claude/skills/ref2game/scripts/rigcut.py skeleton --elbow --face right --knee L=0.69,R=0.78 --hip L=182,R=186 \
 --arm "L=128,62;148,70;146,100;141,140;126,160;116,190;118,215;95,215;80,200;60,198;58,185;0,86;4,74;24,76;76,148;96,150;108,128;114,95;118,68" --sh L=134,72 --hand L=95,176 \
 --arm "R=236,86;262,80;270,96;258,102;346,98;346,242;254,242;254,132;240,112" --sh R=244,92 --hand R=298,160
python3 tools/armsplit.py skeleton L "116,60;152,66;148,100;144,134;114,142;108,95" 127,133 R "232,84;264,78;274,100;272,128;250,134;238,112" 262,124
python3 tools/rigset.py skeleton bladeL=atan2:5,78,95,176
