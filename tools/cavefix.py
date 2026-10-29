import argparse
import shutil
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
BODIES = ('skel_mage__body', 'skel_archer__body', 'drowned__body')
SHORE = 'shore_cv_tex'


def backup(path):
    old = ROOT / 'art/old/cavefix' / path.name
    if not old.exists():
        old.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, old)
    return old


def drop_islands(name):
    path = ROOT / 'art/gen' / (name + '.png')
    im = np.array(Image.open(backup(path)).convert('RGBA'))
    labels, n = ndimage.label(im[..., 3] > 0, np.ones((3, 3)))
    sizes = np.bincount(labels.ravel())[1:]
    keep = np.isin(labels, 1 + np.flatnonzero(sizes >= 0.01 * sizes.max()))
    im[~keep] = 0
    Image.fromarray(im).save(path)
    print(f'{name}: {n} parts, {int((sizes < 0.01 * sizes.max()).sum())} islands removed')


def seamless(a):
    h, w = a.shape[:2]
    wy = np.sin(np.pi * (np.arange(h) + 0.5) / h) ** 2
    wx = np.sin(np.pi * (np.arange(w) + 0.5) / w) ** 2
    k = (wy[:, None] * wx[None, :])[..., None]
    return a * k + np.roll(a, (h // 2, w // 2), (0, 1)) * (1 - k)


def shore():
    path = ROOT / 'art/gen' / (SHORE + '.png')
    a = np.array(Image.open(backup(path)).convert('RGB')).astype(float)
    im = Image.fromarray(np.clip(seamless(a), 0, 255).astype(np.uint8))
    Image.fromarray(np.array(im.quantize(24, Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB'))).save(path)
    print(SHORE + ': 24 colours, edges blended')


def main():
    argparse.ArgumentParser().parse_args()
    for name in BODIES:
        drop_islands(name)
    shore()


if __name__ == '__main__':
    main()
