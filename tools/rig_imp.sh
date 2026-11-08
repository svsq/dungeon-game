#!/bin/sh
# the imp rig (TASKS 407), cut from its approved sprite (art/gen/en_imp.png): the clawed arms reach out clear of the torso and are
# cut by polygon; the tail stays with the body (it springs in the scene, not on its own part)
set -e
cp art/gen/en_imp.png art/gen/imp.png
python3 ~/.claude/skills/ref2game/scripts/rigcut.py imp --elbow --face right --knee L=0.73,R=0.74 --hip L=186,R=189 --thigh "L=98,178;133,175;140,190;128,214;116,228;86,228;92,205" --thigh "R=180,185;208,183;212,200;210,228;180,228;178,205" \
 --arm "L=96,115;120,119;122,136;99,157;80,178;78,212;54,218;31,233;0,205;0,167;23,153;61,153;84,131" --sh L=109,127 --hand L=42,189 \
 --arm "R=183,104;213,108;236,131;253,153;260,178;305,191;305,237;227,237;232,193;243,178;236,160;217,145;197,137;183,125" --sh R=198,117 --hand R=263,205
python3 -c 'import json, re; R = json.loads(re.sub(r"^window\.RIGS = |;\s*$", "", open("live/rigs.js").read().strip())); R["imp"]["head"] = [130, 79]; open("live/rigs.js", "w").write("window.RIGS = " + json.dumps(R) + ";\n")'
