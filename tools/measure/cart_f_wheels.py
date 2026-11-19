#!/usr/bin/env python3
"""TASKS 2113, 2121: the cart paintings' wheels and box, from the alpha channel.

Front views (live/assets/cart_tw_f*.png): the slabs' centres across (parts of the width) and their bottom (part of the height):
the rows under the box hold exactly two narrow opaque runs, the slabs; the band of such rows is walked up from the lowest opaque row.

3/4 views (live/assets/cart_tw*.png, TASKS 2121): one painting with the load changed, cropped to different heights, so their box must
come out one size in the game. For each: the near wheels' feet (under each hub of CART.hubs, as a wheel stands plumb over its rail, at
the lowest opaque row within `FOOT` of the width round it, in parts of the size), the feet line's slope, the box's width over the rows under CART.rim, and in view px at the sizes.js
height: the width, the box, the hubs' distance and the near rim, and the height that gives the full cart's scale.
"""
import math
import re
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
NAMES = ['cart_tw_f', 'cart_tw_f_half', 'cart_tw_f_empty']
SIDE = ['cart_tw', 'cart_tw_half', 'cart_tw_empty']
ALPHA, NARROW, FOOT = 128, 0.15, (0.1, 0.05)


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


def hubs_of(src):
    line = re.search(r'hubs: \{.*', src).group(0)
    return {n: [float(v) for v in re.findall(r'[\d.]+', val)] for n, val in re.findall(r'(cart_tw\w*): (\[\[.*?\]\])', line)}


def side(path, hubs, rim):
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    A = im.getchannel('A').load()
    low = [max((y for y in range(h) if A[x, y] >= ALPHA), default=-1) for x in range(w)]
    feet = []
    for hu, _ in hubs:
        xs = range(max(0, round((hu - FOOT[0]) * w)), min(w, round((hu + FOOT[1]) * w)))
        feet.append((hu, (max(low[x] for x in xs) + 1) / h))
    under = [x for x in range(w) for y in range(round((1 - rim) * h), h) if A[x, y] >= ALPHA]
    box = (max(under) - min(under) + 1) / w
    slope = math.degrees(math.atan2((feet[0][1] - feet[1][1]) * h, (feet[1][0] - feet[0][0]) * w))
    return dict(size=(w, h), feet=feet, slope=slope, box=box)


def heights():
    src = (ROOT / 'live' / 'sizes.js').read_text()
    return {n: int(re.search(r'\b' + n + r': (\d+)', src).group(1)) for n in SIDE}


if __name__ == '__main__':
    for n in NAMES:
        m = measure(ROOT / 'live' / 'assets' / (n + '.png'))
        c, wd = m['centres'], m['widths']
        print(f"{n}: {m['size'][0]}x{m['size'][1]} slabs at {c[0]:.4f} {c[1]:.4f} (span {c[1] - c[0]:.4f}, widths {wd[0]:.3f} {wd[1]:.3f}),"
              f" bottom {m['bottom']:.4f}, {m['rows']} rows under the box")
    data = (ROOT / 'live' / 'data_town.js').read_text()
    hubs, rims, H = hubs_of(data), dict(re.findall(r'(cart_tw\w*): ([\d.]+)', re.search(r'rim: \{(.*?)\}', data).group(1))), heights()
    full = Image.open(ROOT / 'live' / 'assets' / (SIDE[0] + '.png')).size[1]
    for n in SIDE:
        hb = [hubs[n][0:2], hubs[n][2:4]]
        m = side(ROOT / 'live' / 'assets' / (n + '.png'), hb, float(rims[n]))
        (cw, ch), hh = m['size'], H[n]
        vw = round(hh * cw / ch)
        f = m['feet']
        hd = math.hypot((hb[1][0] - hb[0][0]) * vw, (hb[1][1] - hb[0][1]) * hh)
        print(f"{n}: {cw}x{ch} feet ({f[0][0]:.4f}, {f[0][1]:.4f}) ({f[1][0]:.4f}, {f[1][1]:.4f}), feet line {m['slope']:.1f} deg,"
              f" box {m['box']:.4f} of the width | at height {hh}: {vw}x{hh} px, box {m['box'] * vw:.1f}, hubs {hd:.2f} apart,"
              f" near rim {float(rims[n]) * hh:.1f}; the full cart's scale wants height {H[SIDE[0]] * ch / full:.1f}")
