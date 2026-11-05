#!/bin/sh
# the magma colossus rig (TASKS 413), cut from its approved sprite (art/gen/en_colossus.png): the arms hang below the basalt mantle
# on its shoulders, which stays with the body; they are cut by polygon from under the mantle down to the fists
set -e
cp art/gen/en_colossus.png art/gen/colossus.png
python3 ~/.claude/skills/ref2game/scripts/rigcut.py colossus --elbow --face right \
 --arm "L=40,100;80,104;82,140;72,166;66,190;64,238;0,238;0,128;14,110" --sh L=60,116 --hand L=38,207 \
 --arm "R=174,104;212,100;240,110;253,128;253,238;188,238;186,200;182,170;172,140" --sh R=194,116 --hand R=216,207
python3 -c 'import json, re; R = json.loads(re.sub(r"^window\.RIGS = |;\s*$", "", open("live/rigs.js").read().strip())); R["colossus"]["head"] = [135, 72]; open("live/rigs.js", "w").write("window.RIGS = " + json.dumps(R) + ";\n")'
