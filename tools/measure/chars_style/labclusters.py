"""Lab colour clusters of a hero's head and torso, for the game textures and the small refs side by side.
python3 tools/measure/chars_style/labclusters.py [K]  ->  prints, per class and source, the K cluster centres (L, a, b, C, h, share)
of the head band and of the torso band. Head band: the top HEAD share of the figure's opaque rows; torso: the rest of the texture
(game __body textures hold head and torso only) or the next 30% of the small ref's figure (the small ref holds the legs too)."""
import os
import sys
import numpy as np
from PIL import Image

ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools/measure/fidelity'))
from labc import lab  # noqa: E402

K = int(sys.argv[1]) if len(sys.argv) > 1 else 6
BG = np.array([26, 26, 36])
SRC = {
    'warrior': [('ref', 'art/char_refs/warrior_a_small_r4.png'), ('game', 'art/gen/hero__body.png'), ('menu', 'art/gen/hero__body_menu.png')],
    'archer': [('ref', 'art/char_refs/archer_a_small_r4.png'), ('game', 'art/gen/archer__body.png'), ('menu', 'art/gen/archer__body_menu.png')],
    'mage': [('ref', 'art/char_refs/mage_a_small_noorb_r4.png'), ('game', 'art/gen/mage__body.png'), ('menu', 'art/gen/mage__body_menu.png')],
}


def opaque(path):
    im = np.asarray(Image.open(os.path.join(ROOT, path)).convert('RGBA')).astype(float)
    m = im[..., 3] > 127
    if 'char_refs' in path:
        m &= np.abs(im[..., :3] - BG).sum(-1) > 24
    return im[..., :3], m


def kmeans(x, k, it=40):
    rng = np.random.default_rng(1)
    c = x[rng.choice(len(x), min(k, len(x)), replace=False)]
    for _ in range(it):
        lbl = ((x[:, None] - c[None]) ** 2).sum(-1).argmin(1)
        c = np.array([x[lbl == i].mean(0) if (lbl == i).any() else c[i] for i in range(len(c))])
    return c, np.bincount(lbl, minlength=len(c)) / len(x)


def bands(path):
    rgb, m = opaque(path)
    rows = np.where(m.any(1))[0]
    top, bot = rows.min(), rows.max() + 1
    ref = 'char_refs' in path
    h = bot - top
    head_end = top + round(h * (0.2 if ref else 0.28))
    torso_end = top + round(h * 0.5) if ref else bot
    out = {}
    for name, (a, b) in (('head', (top, head_end)), ('torso', (head_end, torso_end))):
        mm = np.zeros_like(m); mm[a:b] = m[a:b]
        px = rgb[mm]
        # the 1-px ink outline is not a material
        px = px[px.sum(1) > 90]
        L, A, B = lab(px)
        out[name] = np.stack([L, A, B], 1)
    return out


for cls, srcs in SRC.items():
    print('==', cls)
    for tag, path in srcs:
        for band, x in bands(path).items():
            c, share = kmeans(x, K)
            order = np.argsort(-share)
            cells = ['L%3.0f a%4.0f b%4.0f C%3.0f h%3.0f %2.0f%%' % (*c[i], np.hypot(c[i][1], c[i][2]), np.degrees(np.arctan2(c[i][2], c[i][1])) % 360, 100 * share[i]) for i in order]
            print(f'{tag:5s} {band:5s} ' + ' | '.join(cells))
