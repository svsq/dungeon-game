"""TASKS 2190: the mage's orb hand in an arch frame beside mage_a_v4's, mirrored and scaled so that both orbs are the same size, both
round their orb's centre (the centroid of its saturated blue, the largest blob of it within BOX of the given point), blown up Z times.
python3 tools/measure/mage_2190/pair.py FRAME.png x,y OUT.png [FRAME2.png x,y ...]   (x, y: a point on the frame's orb)"""
import os
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
REF, REF_AT, BOX, Z, HALF = 'art/char_refs/mage_a_v4.png', (598, 335), 60, 4, (60, 50)


def orb(a, at):
    """the orb's centre and radius: the blue blob holding the point"""
    R, G, B = a[..., 0], a[..., 1], a[..., 2]; blue = (B > R + 80) & (B > 165)
    x0, y0 = max(0, at[0] - BOX), max(0, at[1] - BOX); sub = blue[y0:at[1] + BOX, x0:at[0] + BOX]
    lab, n = ndi.label(sub); k = np.argmax(np.bincount(lab.ravel())[1:]) + 1; ys, xs = np.nonzero(lab == k)
    return (xs.mean() + x0, ys.mean() + y0), np.sqrt(len(xs) / np.pi)


def crop(im, c, half): return im.crop((int(round(c[0] - half[0])), int(round(c[1] - half[1] * 0.6)), int(round(c[0] + half[0])), int(round(c[1] + half[1] * 1.4))))


args = sys.argv[1:]; frames = [(args[0], tuple(map(int, args[1].split(','))))] + [(args[i], tuple(map(int, args[i + 1].split(',')))) for i in range(3, len(args), 2)]
ref = Image.open(os.path.join(ROOT, REF)).convert('RGB'); rc, rr = orb(np.asarray(ref).astype(int), REF_AT)
tiles = []
for f, at in frames:
    im = Image.open(os.path.join(ROOT, f)).convert('RGB'); c, r = orb(np.asarray(im).astype(int), at)
    tiles.append(crop(im, c, HALF)); print(f'{f}: orb at {c[0]:.1f},{c[1]:.1f} r {r:.1f} px')
k = r / rr; R2 = ref.resize((int(ref.size[0] * k), int(ref.size[1] * k)), Image.LANCZOS).transpose(Image.FLIP_LEFT_RIGHT)
tiles.append(crop(R2, (R2.size[0] - rc[0] * k, rc[1] * k), HALF)); print(f'mage_a_v4 orb r {rr:.1f} px, scaled ×{k:.3f}')
W = sum(t.size[0] * Z + 8 for t in tiles); o = Image.new('RGB', (W, tiles[0].size[1] * Z)); x = 0
for t in tiles: o.paste(t.resize((t.size[0] * Z, t.size[1] * Z), Image.NEAREST), (x, 0)); x += t.size[0] * Z + 8
o.save(args[2])
