#!/bin/sh
# the drowned rig (TASKS 307), cut from its approved sprite (art/gen/en_drowned.png, mirrored to face right): the hanging weed rides
# the forearms, the thighs are cut above the rags' hem (the crotch sits at the knees)
set -e
cp art/gen/en_drowned.png art/gen/drowned.png
python3 ~/.claude/skills/ref2game/scripts/rigcut.py drowned --elbow --face right --knee L=0.70,R=0.66 --hip L=172,R=168 \
 --thigh "L=58,168;100,168;96,218;56,226" --thigh "R=128,162;172,162;180,214;140,214" \
 --arm "L=66,84;84,90;80,104;70,114;64,124;62,160;52,176;48,236;0,236;0,180;10,150;28,128;46,112;58,96" --sh L=72,98 --hand L=25,182 \
 --arm "R=176,92;192,96;204,104;218,122;236,134;266,170;266,222;232,222;212,212;198,212;192,190;176,150;172,120;172,100" --sh R=182,104 --hand R=232,180
python3 tools/jointcap.py drowned "uarmL:shL:12" "uarmR:shR:12" "thighL:hipL:12" "thighR:hipR:12"
