#!/usr/bin/env python3
"""TASKS 2113: the front cart paintings' two edge-on wheel slabs, from the alpha channel.

Prints for each of live/assets/cart_tw_f*.png the slabs' centres across (parts of the width) and their bottom (part of the height):
the rows under the box hold exactly two narrow opaque runs, the slabs; the band of such rows is walked up from the lowest opaque row.
"""
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
NAMES = ['cart_tw_f', 'cart_tw_f_half', 'cart_tw_f_empty']
ALPHA, NARROW = 128, 0.15


def runs(row):
    out, start = [], None
    for x, a in enumerate(row + [0]):
        if a >= ALPHA and start is None:
            start = x
        elif a < ALPHA and start is not None:
            out.append((start, x - 1))
            start = None
    return out


def measure(path):
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    A = im.getchannel('A').load()
    rows = [[A[x, y] for x in range(w)] for y in range(h)]
    bottom = max(y for y in range(h) if any(a >= ALPHA for a in rows[y]))
    band = []
    for y in range(bottom, -1, -1):
        r = runs(rows[y])
        if len(r) != 2 or any(b - a + 1 > NARROW * w for a, b in r):
            break
        band.append(r)
    if not band:
        sys.exit(f'{path.name}: no two slabs under the box')
    cs = [sum((a + b + 1) / 2 for a, b in (row[q] for row in band)) / len(band) for q in (0, 1)]
    ws = [sum(row[q][1] - row[q][0] + 1 for row in band) / len(band) for q in (0, 1)]
    return dict(size=(w, h), centres=[c / w for c in cs], widths=[x / w for x in ws], bottom=(bottom + 1) / h, rows=len(band))


if __name__ == '__main__':
    for n in NAMES:
        m = measure(ROOT / 'live' / 'assets' / (n + '.png'))
        c, wd = m['centres'], m['widths']
        print(f"{n}: {m['size'][0]}x{m['size'][1]} slabs at {c[0]:.4f} {c[1]:.4f} (span {c[1] - c[0]:.4f}, widths {wd[0]:.3f} {wd[1]:.3f}),"
              f" bottom {m['bottom']:.4f}, {m['rows']} rows under the box")
