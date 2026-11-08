#!/bin/sh
# the magma golem rig (TASKS 409), cut from its approved sprite (art/gen/en_golem.png): the long arms hang clear of the torso and
# the legs, so they are cut by polygon from the shoulder boulders down to the fists; the head is the eye slits, sunk in the shoulders
set -e
cp art/gen/en_golem.png art/gen/golem.png
python3 ~/.claude/skills/ref2game/scripts/rigcut.py golem --elbow --face right \
 --arm "L=39,55;87,45;104,74;94,129;86,145;78,174;78,267;67,277;46,320;0,320;0,155;17,123;30,78" --sh L=67,87 --hand L=36,251 \
 --arm "R=206,42;261,45;287,68;322,129;322,320;224,320;224,200;226,161;223,139;216,100" --sh R=256,87 --hand R=280,251
python3 -c 'import json, re; R = json.loads(re.sub(r"^window\.RIGS = |;\s*$", "", open("live/rigs.js").read().strip())); R["golem"]["head"] = [143, 82]; open("live/rigs.js", "w").write("window.RIGS = " + json.dumps(R) + ";\n")'
python3 tools/golem_longarm.py
