#!/bin/sh
# the cultist rig, cut from its approved sprite: the staff and its hand swing from the far shoulder, the free arm in two bones
set -e
python3 tools/robecut.py cultist art/gen/en_cultist.png \
 "L:fore|0,0;66,0;72,112;70,148;60,150;79,318;65,318;48,150;36,148;28,140;24,110;0,62|sh|92,108|hand|50,130" \
 "R:upper|158,96;198,98;204,148;172,152|fore|198,98;216,92;248,100;248,138;218,150;204,148|sh|170,110|elbow|200,124|hand|226,116"
