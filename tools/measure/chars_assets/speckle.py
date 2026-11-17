# python3 tools/measure/chars_assets/speckle.py: noise of each hero part as the world draws it: the texture voted onto the 42-row
# world grid the way snapTex in live/lib.js does (4×4 samples per world pixel, kept if half covered, the largest group of samples
# within 0.13 RGB wins, its mean painted); then, per 100 opaque world px, pixels that stand out (|dRGB| sum > 90) from at least 3 of
# their 4 neighbours. Also the share of half-transparent texture pixels (alpha 16..239, a halo source) and opaque islands < 6 px.
import os, glob; import numpy as np; from PIL import Image; from scipy import ndimage
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')); os.chdir(ROOT)
def vote(a, rows=42):
    h, w = a.shape[:2]; C = h / rows; W = int(np.ceil(w / C)); out = np.zeros((rows, W, 4))
    for y in range(rows):
        for x in range(W):
            ys = np.clip(((y + (np.arange(4) + 0.5) / 4) * C).astype(int), 0, h - 1); xs = np.clip(((x + (np.arange(4) + 0.5) / 4) * C).astype(int), 0, w - 1)
            s = a[np.ix_(ys, xs)].reshape(-1, 4) / 255.0; on = s[:, 3] >= 0.5
            if on.sum() < 8: continue
            c = s[on, :3]; d = np.linalg.norm(c[:, None] - c[None], axis=-1) <= 0.13; k = d.sum(1).argmax(); out[y, x, :3] = c[d[k]].mean(0); out[y, x, 3] = 1
    return out
for f in sorted(glob.glob('live/assets/hero__*.png') + glob.glob('live/assets/archer__*.png') + glob.glob('live/assets/mage__*.png')):
    n = os.path.basename(f)[:-4]
    if n.endswith('_w') or n.endswith('_menu'): continue
    a = np.array(Image.open(f).convert('RGBA')).astype(float); al = a[..., 3]
    semi = ((al > 15) & (al < 240)).sum() / max(1, (al > 15).sum())
    lab, k = ndimage.label(al > 60); sizes = ndimage.sum(np.ones_like(al), lab, range(1, k + 1)) if k else []
    isl = int(sum(1 for s in sizes if s < 6))
    v = vote(a); op = v[..., 3] > 0; c = v[..., :3] * 255; cnt = np.zeros(op.shape, int)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        s = np.roll(np.roll(c, dy, 0), dx, 1); so = np.roll(np.roll(op, dy, 0), dx, 1); cnt += ((np.abs(c - s).sum(-1) > 90) & so)
    sp = ((cnt >= 3) & op).sum() / max(1, op.sum()) * 100
    # below the head (row 11 of 42 and down): the cell-painted face has its one-cell eye by design
    lo = op.copy(); lo[:11] = False; spb = ((cnt >= 3) & lo).sum() / max(1, lo.sum()) * 100
    print(f'{n:26s} speckle {sp:5.1f}/100  below head {spb:5.1f}  semi-alpha {semi:.3f}  islands<6px {isl:3d}  world px {op.sum()}')
