import sys

import numpy as np
from PIL import Image


def edges(a, axis):
    return (np.abs(np.diff(a, axis=axis)).sum(-1) > 40).sum(1 - axis)


def cell(ex):
    best = (0, 0, 0)
    idx = np.arange(len(ex))
    for k in np.arange(12, 20.01, 0.125):
        for p0 in np.arange(0, k, 0.5):
            d = np.abs(((idx - p0 + k / 2) % k) - k / 2)
            s = (ex * (d < 1.5)).sum() / ex.sum()
            if s > best[0]:
                best = (s, k, p0)
    return best[1], best[2]


def mode_sample(q, k, p0, n, axis_len):
    starts = p0 + k * np.arange(-1, n + 1)
    return [s for s in starts if s >= 0 and s + k <= axis_len]


def snap(src, dst, height=None, colors=128):
    im = Image.open(src).convert("RGB")
    q = np.asarray(im.quantize(colors, method=Image.MEDIANCUT, dither=Image.NONE).convert("RGB")).astype(int)
    a = np.asarray(im).astype(int)
    kx, px = cell(edges(a, 1))
    ky, py = cell(edges(a, 0))
    k = (kx + ky) / 2
    if height:
        bg = a[0, 0]
        ys, xs = np.where(np.abs(a - bg).sum(-1) > 30)
        k = (ys.max() - ys.min() + 1) / height
        py, px = ys.min() % k, xs.min() % k
    rows = np.arange(py, q.shape[0] - k + 1e-6, k)
    cols = np.arange(px, q.shape[1] - k + 1e-6, k)
    out = np.zeros((len(rows), len(cols), 3), np.uint8)
    for i, y in enumerate(rows):
        for j, x in enumerate(cols):
            c = q[int(y + k * 0.2):int(y + k * 0.8) + 1, int(x + k * 0.2):int(x + k * 0.8) + 1].reshape(-1, 3)
            v, n = np.unique(c, axis=0, return_counts=True)
            out[i, j] = v[n.argmax()]
    Image.fromarray(out).save(dst)
    return k, out.shape


if __name__ == "__main__":
    h = int(sys.argv[3]) if len(sys.argv) > 3 else None
    print(sys.argv[2], *snap(sys.argv[1], sys.argv[2], h))
