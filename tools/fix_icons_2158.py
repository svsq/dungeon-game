#!/usr/bin/env python3
# TASKS 2158: the warrior's charge and war cry and the archer's leap back in the format of the six older ability icons: one sign on a
# dark plate of its own colour, the plate a 372 px square on the old icons' 6 px grid, 4 px of transparent rim round it (380 px; prep
# trims to the alpha box + 4 px, so the rim is what gives the margin). The generator returns the sign alone on alpha: the plate is ours.
#   python3 tools/fix_icons_2158.py ab_charge=frames/fix_icons_2158/gen/ab_charge_2158_1.png [ab_cry=... ab_leap=...]
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

PLATE, CELL, RIM, FILL = 372, 6, 4, 0.86
STAMP = '20261117-2158'
# the plate's middle and edge colours: the hues of the old icons' backgrounds (red-brown, crimson, olive-grey), as dark as ab_whirl's
PLATES = {'ab_charge': ((74, 28, 16), (30, 11, 8)), 'ab_cry': ((80, 14, 16), (34, 6, 8)), 'ab_leap': ((58, 62, 44), (26, 28, 21))}
# the long level sword filled half the plate's height and read as a thin line at 56 px: tilted up it takes the diagonal, as the old six
# signs fill theirs; degrees counter-clockwise and the share of the plate the sign's longer side takes
POSE = {'ab_charge': (28, 1.0), 'ab_cry': (0, 0.94), 'ab_leap': (0, 0.92)}


def plate(name):
    mid, edge = (np.array(c, float) for c in PLATES[name])
    y, x = np.mgrid[0:PLATE, 0:PLATE] / (PLATE - 1) - 0.5
    t = np.clip(np.hypot(x, y) / 0.7, 0, 1)[..., None]
    rgb = mid * (1 - t) + edge * t
    return Image.fromarray(np.dstack([rgb, np.full((PLATE, PLATE), 255.0)]).astype(np.uint8), 'RGBA')


def fix(name, src):
    rot, fill = POSE.get(name, (0, FILL))
    sign = Image.open(src).convert('RGBA')
    sign = sign.crop(sign.getbbox()).rotate(rot, Image.BICUBIC, expand=True)
    sign = sign.crop(sign.getbbox())
    k = fill * PLATE / max(sign.size)
    sign = sign.resize((round(sign.width * k), round(sign.height * k)), Image.LANCZOS)
    tile = plate(name)
    tile.alpha_composite(sign, ((PLATE - sign.width) // 2, (PLATE - sign.height) // 2))
    n = PLATE // CELL
    tile = tile.resize((n, n), Image.BOX).resize((PLATE, PLATE), Image.NEAREST)
    out = Image.new('RGBA', (PLATE + 2 * RIM, PLATE + 2 * RIM), (0, 0, 0, 0))
    out.paste(tile, (RIM, RIM))
    dst = Path('art/gen') / (name + '.png')
    old = Path('art/old') / f'{name}-{STAMP}.png'
    if dst.exists() and not old.exists():
        shutil.copy2(dst, old)
    out.save(dst)
    print(name, '<-', src, '->', out.size)


if __name__ == '__main__':
    for arg in sys.argv[1:]:
        name, src = arg.split('=', 1)
        fix(name, src)
