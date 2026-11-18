"""ref critic r3: left/right tone of every limb texture pair of the three heroes (world, _menu and the outfit variants).
   Lab median and mean L* of the opaque pixels lighter than the outline (L* > 12), dE76 of the medians; a sheet of the pairs.
   python3 tools/measure/chars_ref/tones.py [frames/critic_chars_r3_ref]"""
import os, re, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from measure import lab

ROOT = Path(os.environ.get('ROOT', Path(__file__).resolve().parents[3]))
OUT = ROOT / (sys.argv[1] if len(sys.argv) > 1 else 'frames/critic_chars_r3_ref')
GEN = ROOT / 'art/gen'
pat = re.compile(r'^(hero|archer|mage)__(thigh|shin|foot|uarm|farm)L(.*)\.png$')


def tone(f):
    a = np.asarray(Image.open(f).convert('RGBA')).astype(int)
    px = lab(a[..., :3][a[..., 3] > 128]); px = px[px[:, 0] > 12]
    return np.median(px, 0), px[:, 0].mean(), len(px)


rows, tiles = [], []
for f in sorted(GEN.iterdir()):
    m = pat.match(f.name)
    if not m:
        continue
    g = GEN / f.name.replace(m.group(2) + 'L', m.group(2) + 'R', 1)
    if not g.exists():
        continue
    (mL, lL, nL), (mR, lR, nR) = tone(f), tone(g)
    dE = float(np.linalg.norm(mL - mR))
    rows.append((dE, f.name[:-4], mL.round(1).tolist(), mR.round(1).tolist(), round(lL, 1), round(lR, 1), nL, nR))
    if dE > 6:
        tiles.append((f, g))
rows.sort(reverse=True)
with open(OUT / 'tones.txt', 'w') as o:
    for r in rows:
        line = f'{r[0]:5.1f}  {r[1]:28s} L {r[2]}  R {r[3]}  meanL* {r[4]} / {r[5]}  px {r[6]} / {r[7]}'
        print(line); o.write(line + '\n')
if tiles:
    ims = []
    for f, g in tiles[:12]:
        a, b = Image.open(f).convert('RGBA'), Image.open(g).convert('RGBA')
        for im in (a, b):
            bb = im.getbbox() or (0, 0, 1, 1); ims.append(im.crop(bb).resize(((bb[2] - bb[0]) * 4, (bb[3] - bb[1]) * 4), Image.NEAREST))
    W = sum(i.width for i in ims) + 10 * len(ims); H = max(i.height for i in ims)
    S = Image.new('RGBA', (W, H), (28, 28, 36, 255)); x = 0
    for i in ims:
        S.paste(i, (x, 0), i); x += i.width + 10
    S.save(OUT / 'tones_pairs.png')
