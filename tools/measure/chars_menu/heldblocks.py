# TASKS 2165: blocksize.py over each weapon's own box in the arch (archbox.txt of the same folder), the frames menu_weapon_<kind>.png;
# the box is the weapon's render-twice box, so the arch's masonry around a thin weapon weighs in too: compare folders, not kinds
#   python3 tools/measure/chars_menu/heldblocks.py frames/fix_2165/before
import json
import re
import subprocess
import sys
from pathlib import Path

d = Path(sys.argv[1])
KIND = {'sword': 'sword', 'longsword': 'longsword', 'axe': 'axe', 'hammer': 'hammer', 'staff': 'staff', 'wand': 'wand', 'shortbow': 'shortbow', 'longbow': 'longbow', 'crossbow': 'crossbow'}
here = Path(__file__).resolve().parent
lines = []
for row in (d / 'archbox.txt').read_text().splitlines():
    m = re.match(r'(\w+) (\w+)\s+body (\[.*?\])\s+weapon (\[.*?\])', row)
    if not m:
        continue
    cls, b, body, wb = m.group(1), m.group(2), json.loads(m.group(3)), json.loads(m.group(4))
    args = ['weapon', *map(str, wb)]
    if b in ('sword', 'staff', 'shortbow'):
        args += ['face', str(body[0] + 46), str(body[1] + 7), str(body[0] + 96), str(body[1] + 57), 'torso', str(body[0] + 26), str(body[1] + 67), str(body[0] + 116), str(body[1] + 147)]
    r = subprocess.run([sys.executable, str(here / 'blocksize.py'), str(d / f'menu_weapon_{KIND[b]}.png'), *args], capture_output=True, text=True, check=True)
    lines += [f'{cls} {b}: {s}' for s in r.stdout.strip().splitlines()]
(d / 'heldblocks.txt').write_text('\n'.join(lines) + '\n')
print('\n'.join(lines))
