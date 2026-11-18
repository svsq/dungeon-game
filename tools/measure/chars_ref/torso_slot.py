"""ref critic r4: the torso's near side under the arm. For each body texture of the warrior and the archer (every outfit, world and
   _menu): per row from the armpit (shL + 0.25 of the upper arm) down to the hip, how far in from the shoulder cap's outer edge the
   torso's first opaque pixel starts, and the empty area there (rig px) that only the arm can cover; and the same for the upper arm's
   own width, so a slot wider than the arm's reach under NEAR_OUT is visible.
   python3 tools/measure/chars_ref/torso_slot.py"""
import json, os, re, glob
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(os.environ.get('ROOT', Path(__file__).resolve().parents[3]))
src = open(ROOT / 'live/rigs.js').read(); RIGS = json.loads(src[src.index('{'):src.rindex('}') + 1])
for rig in ['hero', 'archer']:
    R = RIGS[rig]; sh, el, hp = R['shL'], R['elbowL'], R['hipL']
    for f in sorted(glob.glob(str(ROOT / f'live/assets/{rig}__body*.png'))):
        n = Path(f).stem
        if 'back' in n: continue
        a = np.asarray(Image.open(f).convert('RGBA'))[..., 3] > 128
        k = a.shape[1] / R['w']
        y0, y1 = int((sh[1] + 0.25 * (el[1] - sh[1])) * k), int(hp[1] * k)
        cap = np.nonzero(a[int(sh[1] * k)])[0].min() if a[int(sh[1] * k)].any() else None
        edge = [np.nonzero(a[y])[0].min() if a[y].any() else None for y in range(y0, y1)]
        e = np.array([v for v in edge if v is not None])
        area = sum((v - cap) for v in e if v > cap) / k / k
        print(f'{n:24s} cap x {cap/k:6.1f}  torso edge below armpit x {e.min()/k:6.1f}..{e.max()/k:6.1f} rig px (in from the cap up to {(e.max()-cap)/k:5.1f})  slot {area:6.0f} rig px²  shL x {sh[0]:.1f} elbowL x {el[0]:.1f}')
