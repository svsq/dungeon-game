# TASKS 2142, 2145: the mage's and the archer's hand joints on the middle of the fist painted on their forearm parts. partrig put
# them at 0.9 of the arm's length, 8 rig px ahead of the mage's fist, so the staff and the bow stood clear of the hand gripping them
# usage: python3 tools/handgrip_2142.py   (edits live/rigs.js)
import json, re
import numpy as np
from PIL import Image

RP, FIST = 'live/rigs.js', 24   # the fist: the part's lowest rig px
R = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open(RP).read().strip()))
for name in ('mage', 'archer'):
    for side in 'LR':
        a = np.array(Image.open(f'art/gen/{name}__farm{side}.png').convert('RGBA'))[..., 3] > 128
        ys, xs = np.nonzero(a); m = ys > ys.max() - FIST
        old = R[name]['hand' + side]; R[name]['hand' + side] = [float(xs[m].mean()), float(ys[m].mean())]
        print(name, 'hand' + side, [round(v) for v in old], '->', [round(v) for v in R[name]['hand' + side]])
open(RP, 'w').write('window.RIGS = ' + json.dumps(R) + ';\n')
