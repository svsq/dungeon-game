import sys
from pathlib import Path

import numpy as np
from PIL import Image

BG = (26, 26, 36)


def box(a):
    ys, xs = np.where(np.abs(a - a[0, 0]).sum(-1) > 30)
    return ys.min(), ys.max(), xs.min(), xs.max()


def nearest(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def view(native, raw=None):
    im = Image.open(native).convert("RGB")
    a = np.asarray(im).astype(int)
    y0, _, x0, x1 = box(a)
    cx = (x0 + x1) // 2
    face = im.crop((cx - 6, y0 - 1, cx + 7, y0 + 11))
    cells = [im, nearest(im, 4), nearest(face, 10)]
    if raw:
        r = Image.open(raw).convert("RGB")
        ra = np.asarray(r).astype(int)
        ry0, ry1, rx0, rx1 = box(ra)
        k = (ry1 - ry0 + 1) / (a.shape[0] and (box(a)[1] - y0 + 1))
        rcx = (rx0 + rx1) // 2
        cells.append(r.crop((int(rcx - 6 * k), int(ry0 - k), int(rcx + 7 * k), int(ry0 + 11 * k))).resize((130, 120), Image.NEAREST))
    w = sum(c.width for c in cells) + 10 * len(cells)
    out = Image.new("RGB", (w, max(c.height for c in cells)), (90, 90, 90))
    x = 0
    for c in cells:
        out.paste(c, (x, 0))
        x += c.width + 10
    return out


if __name__ == "__main__":
    dst = sys.argv[1]
    pairs = [p.split(",") for p in sys.argv[2:]]
    rows = [view(*p) for p in pairs]
    out = Image.new("RGB", (max(r.width for r in rows), sum(r.height + 10 for r in rows)), (90, 90, 90))
    y = 0
    for r in rows:
        out.paste(r, (0, y))
        y += r.height + 10
    Path(dst).parent.mkdir(parents=True, exist_ok=True)
    out.save(dst)
