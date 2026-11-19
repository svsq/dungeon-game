#!/usr/bin/env python3
"""TASKS 2160: the near forearm (farmR) was the far one's copy, its fist's fingers curling to the camera's right: on the near side
that turned the palm out, away from the body. Here each near forearm, as drawn, is mirrored about its own elbow → hand line (one
whole-px shift per row, so no holes), which keeps the elbow and the hand's rig points where they were. The drawn source then goes
through the 2155 grid step again.
  python3 tools/fix_2160.py mirror [--rig R]   write art/gen/<name>.png (old ones to art/old/<name>-20261117-2160.png), then:
  python3 tools/gridify_2155.py run <names printed>; python3 tools/prep.py --only <names printed by gridify>
--rig: that rig's near forearms of every outfit (<rig>__farmR, <rig>__farmR_<outfit>) instead of the accepted looks' list"""
import glob, json, os, re, shutil, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rigarg

NAMES = ['hero__farmR', 'hero__farmR_cl', 'hero__farmR_pw', 'archer__farmR', 'mage__farmR']
near_arms = lambda rig: sorted(n for n in (os.path.basename(p)[:-4] for p in glob.glob(f'art/gen/{rig}__farmR*.png')) if re.fullmatch(rf'{rig}__farmR(_[a-z]{{2}})?', n))
TAG, GRID = '20261117-2160', '20261117-2155'

def mirror(a, E, H):
    out = np.zeros_like(a)
    for y in range(a.shape[0]):
        t = min(1, max(0, (y - E[1]) / (H[1] - E[1]))); c2 = int(round(2 * (E[0] + (H[0] - E[0]) * t)))
        for x in np.nonzero(a[y, :, 3])[0]:
            if 0 <= c2 - x < a.shape[1]: out[y, c2 - x] = a[y, x]
    return out

if __name__ == '__main__' and sys.argv[1:2] == ['mirror']:
    sel = rigarg.take(())[0]
    if sel: NAMES = [n for r in sel for n in near_arms(r)]
    R = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip()))
    for n in NAMES:
        rig = n.split('__')[0]; drawn = f'art/old/{n}-{GRID}.png'
        if not os.path.exists(drawn): sys.exit(f'{drawn} missing: the drawn source of {n}')
        for f in (f'art/gen/{n}.png', f'art/gen/{n}_menu.png'):
            if os.path.exists(f): shutil.move(f, f'art/old/{os.path.basename(f)[:-4]}-{TAG}.png')
        a = np.array(Image.open(drawn).convert('RGBA'))
        Image.fromarray(mirror(a, R[rig]['elbowR'], R[rig]['handR'])).save(f'art/gen/{n}.png')
        os.remove(drawn)
    print(' '.join(NAMES))
