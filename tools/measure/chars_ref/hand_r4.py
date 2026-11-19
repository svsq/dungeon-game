"""ref critic r4: the mage's orb hand by layers. Masks of the cup (cupL), the cuff (cuffL) and the orb from the 'only' renders of
   grab_r4.mjs; crops of the hand at x8 beside the reference's orb hand (mage_a_v4.png) scaled to the same orb diameter; counts of the
   cup's pixels by tone, how far round the orb the fingers reach (angle on the orb's rim), the wrist's length and the cuff's colour.
   python3 tools/measure/chars_ref/hand_r4.py [frames/critic_chars_r4_ref]"""
import json, os, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(os.environ.get('ROOT', Path(__file__).resolve().parents[3]))
OUT = ROOT / (sys.argv[1] if len(sys.argv) > 1 else 'frames/critic_chars_r4_ref')
LY = OUT / 'layers'; LK = OUT / 'look'; LK.mkdir(exist_ok=True)
M = json.load(open(LY / 'meta.json'))
img = lambda v, k: np.asarray(Image.open(LY / f'{v}__{k}.png').convert('RGB')).astype(int)
def own(v, p):
    return np.abs(img(v, 'only_' + p) - img(v, 'none')).sum(2) > 24
def vis(v, p):
    return np.abs(img(v, 'all') - img(v, 'no_' + p)).sum(2) > 24

def ref_hand():
    """the orb and its hand on mage_a_v4.png: the orb is the bright blue disc right of the figure"""
    a = np.asarray(Image.open(ROOT / 'art/char_refs/mage_a_v4.png').convert('RGB')).astype(int)
    sub = a[250:470, 520:690]
    blue = (sub[..., 2] > 150) & (sub[..., 2] - sub[..., 0] > 80)
    lab, n = ndi.label(ndi.binary_closing(blue, iterations=3)); big = lab == (np.bincount(lab.ravel())[1:].argmax() + 1)
    ys, xs = np.nonzero(big)
    d = max(xs.max() - xs.min(), ys.max() - ys.min()) + 1
    return a, (520 + xs.mean(), 250 + ys.mean()), d

ra, rc, rd = ref_hand()
print(f'ref orb: centre {rc[0]:.0f},{rc[1]:.0f}  diameter {rd} px (sheet figure height ~ {910-80} px)')
rows = []
for v in [k for k in M if 'mage' in k]:
    if not (LY / f'{v}__only_cupL.png').exists():
        continue
    o, cu, cf = own(v, 'orb'), own(v, 'cupL'), own(v, 'cuffL')
    ov, cv, fv = vis(v, 'orb'), vis(v, 'cupL'), vis(v, 'cuffL')
    if not o.any() or not cu.any():
        print(v, 'no orb or cup'); continue
    ys, xs = np.nonzero(o); oc = (xs.mean(), ys.mean()); od = max(xs.max() - xs.min(), ys.max() - ys.min()) + 1; r = od / 2
    A = np.asarray(Image.open(LY / f'{v}__all.png').convert('RGB')).astype(int)
    cy, cx = np.nonzero(cv)
    ang = np.degrees(np.arctan2(-(cy - oc[1]), cx - oc[0]))
    dist = np.hypot(cx - oc[0], cy - oc[1])
    rim = dist < r + 0.25 * r
    over = cv & o
    # skin vs outline in the visible cup: skin = warm and lit, outline = dark
    col = A[cv]; L = col.mean(1); skin = (col[:, 0] - col[:, 2] > 40) & (L > 70)
    fy, fx = np.nonzero(fv); cuffcol = np.median(A[fv], 0) if fv.any() else None
    cuff_w = (fx.max() - fx.min() + 1, fy.max() - fy.min() + 1) if fv.any() else None
    angs = ang[rim]
    over_orb_face = int((cv & (np.hypot(*np.mgrid[0:o.shape[0], 0:o.shape[1]][::-1] - np.array(oc)[:, None, None]) < r * 0.85)).sum())
    print(f'{v:24s} orb d={od:3d}  cup visible {int(cv.sum()):4d} px (own {int(cu.sum())}), skin share {skin.mean():.2f}, '
          f'cup px within 0.85 r of the orb centre (on its face) {over_orb_face}, cup rim angles {np.percentile(angs,5):.0f}..{np.percentile(angs,95):.0f} deg; '
          f'cuff visible {int(fv.sum())} px box {cuff_w} median rgb {cuffcol}')
    # crop round the orb, scale so the orb diameter matches the ref's
    k = 4 if od > 30 else 8
    x0, y0 = int(oc[0] - 1.6 * od), int(oc[1] - 1.1 * od); x1, y1 = int(oc[0] + 1.6 * od), int(oc[1] + 1.6 * od)
    g = Image.fromarray(A.clip(0, 255).astype(np.uint8)).crop((x0, y0, x1, y1))
    s = rd / od
    gW = round(g.width * s); g2 = g.resize((gW, round(g.height * s)), Image.NEAREST)
    rx0, ry0 = int(rc[0] - 1.6 * rd), int(rc[1] - 1.1 * rd)
    rr = Image.fromarray(ra.astype(np.uint8)).crop((rx0, ry0, rx0 + gW, ry0 + g2.height))
    sheet = Image.new('RGB', (gW * 2 + 8, g2.height), (20, 20, 28)); sheet.paste(g2, (0, 0)); sheet.paste(rr, (gW + 8, 0))
    z = max(1, 600 // sheet.width); sheet.resize((sheet.width * z, sheet.height * z), Image.NEAREST).save(LK / f'hand_{v}.png')
    # tinted layer map: cup green, cuff magenta, orb cyan
    T = A.copy(); T[cv] = (T[cv] * 0.4 + np.array([0, 255, 0]) * 0.6); T[fv] = (T[fv] * 0.4 + np.array([255, 0, 255]) * 0.6)
    t = Image.fromarray(T.clip(0, 255).astype(np.uint8)).crop((x0, y0, x1, y1)); t.resize((t.width * k, t.height * k), Image.NEAREST).save(LK / f'handmap_{v}.png')
