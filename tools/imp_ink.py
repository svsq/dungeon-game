#!/usr/bin/env python3
"""Imp parts cleaned of stray bits and given a near-black outer contour, one art cell (R px) thick, drawn only outside each
part's own silhouette and not over a neighbouring part. Rebuilt from art/old/ each run. en_imp.png (the sprite the parts are
cut from, 2.63x larger) gets the same contour so a re-cut keeps it.
  python3 tools/imp_ink.py
"""
import glob, os, shutil
import numpy as np
from PIL import Image
from scipy import ndimage as nd

INK = (18, 12, 14)
R = 5
STRAY = {
    'imp__body': [(152, 153, 105, 106), (156, 159, 253, 258), (122, 126, 228, 232), (155, 169, 89, 102), (237, 241, 255, 265)],
    'imp__farmR': [(188, 192, 233, 237)],
}


def src(name):
    old = f'art/old/{name}.png'
    if not os.path.exists(old):
        shutil.copy(f'art/gen/{name}.png', old)
    return np.array(Image.open(old).convert('RGBA'))


def clean(name, a):
    lab, _ = nd.label(a[..., 3] > 0, np.ones((3, 3)))
    big = np.bincount(lab.ravel())[1:]
    main = 1 + int(big.argmax())
    for y0, y1, x0, x1 in STRAY.get(name, []):
        w = np.zeros(a.shape[:2], bool); w[y0:y1, x0:x1] = True
        ids = set(np.unique(lab[w & (a[..., 3] > 0)])) - {0}
        for i in ids:
            comp = lab == i
            if i == main or comp.sum() > 200:
                a[w & comp & (a[..., 3] < 128) | (w & comp & (a[..., 3] >= 128) & (comp.sum() > 200))] = 0
            else:
                a[comp] = 0
    return a


def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r + 1


def hull(solid, r):
    # opening drops hairs and specks; the eroded core keeps real limbs that the opening could thin out
    core = nd.binary_erosion(solid, disk(3))
    return nd.binary_opening(solid, disk(2)) | nd.binary_dilation(core, disk(3)) & solid


def ink(a, r, others):
    solid = a[..., 3] > 128
    ring = nd.binary_dilation(hull(solid, r), disk(r))
    ring = nd.binary_closing(np.pad(ring, 8), disk(3))[8:-8, 8:-8] & ~solid & ~others
    a[ring, :3] = INK; a[ring, 3] = 255
    return a


if __name__ == '__main__':
    names = sorted(os.path.basename(f)[:-4] for f in glob.glob('art/gen/imp__*.png'))
    arts = {n: clean(n, src(n)) for n in names}
    for n in names:
        others = np.zeros(arts[n].shape[:2], bool)
        for m in names:
            if m != n: others |= arts[m][..., 3] > 128
        a = ink(arts[n].copy(), R, others)
        Image.fromarray(a).save(f'art/gen/{n}.png'); print(n)
    a = ink(src('en_imp'), round(R * 2.63), np.zeros((1024, 1024), bool))
    Image.fromarray(a).save('art/gen/en_imp.png'); print('en_imp')
