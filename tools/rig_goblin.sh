#!/bin/sh
# the goblin rig, cut from its approved sprite: the dagger rides the far forearm, the claw hand the near one
set -e
cp art/gen/en_goblin.png art/gen/goblin.png
python3 ~/.claude/skills/ref2game/scripts/rigcut.py goblin --elbow --face right --knee L=0.74,R=0.78 --hip L=192,R=195 --thigh "L=138,186;186,186;186,216;136,216" --thigh "R=250,188;294,188;296,216;250,216" \
 --arm "L=162,106;168,126;142,146;126,176;120,216;84,222;72,206;58,202;2,152;2,132;16,132;80,164;94,158;104,138;126,118;146,104" --sh L=152,115 --hand L=95,188 \
 --arm "R=260,86;292,94;322,120;342,140;388,188;388,238;308,238;308,170;288,142;260,116" --sh R=268,100 --hand R=345,200
python3 tools/armsplit.py goblin L "168,102;172,126;138,160;98,162;98,138;130,112" 112,148 R "256,82;298,90;328,124;312,152;284,142;256,120" 308,138
python3 tools/rigset.py goblin bladeL=atan2:10,140,95,188
