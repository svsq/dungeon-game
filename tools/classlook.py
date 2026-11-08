#!/usr/bin/env python3
"""classlook.py: class look fixes (TASKS 1150, 1159, 1180) applied to art/gen sources from a pristine backup, so a second run changes nothing.
Run it, then `python3 tools/prep.py --only <names>` (prints the names) to refresh live/assets and live/assets.js.
A new `gear.py cut` or `archertone.py` run rewrites the parts from the sheets; run this again afterwards."""
import colorsys, os, shutil, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

import subprocess, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN = os.path.join(ROOT, 'art/gen')
BAK = os.environ.get('CLASSLOOK_BACKUP', os.path.join(tempfile.gettempdir(), 'classlook_pristine'))
PRISTINE = '6430340'
os.makedirs(BAK, exist_ok=True)
touched = []


def load(name):
    src = os.path.join(BAK, name + '.png')
    # the art as it was before these fixes, or a second run would apply them twice
    if not os.path.exists(src): open(src, 'wb').write(subprocess.run(['git', 'show', f'{PRISTINE}:art/gen/{name}.png'], cwd=ROOT, capture_output=True, check=True).stdout)
    return np.array(Image.open(src).convert('RGBA'))


def save(name, a):
    Image.fromarray(a.astype(np.uint8)).save(os.path.join(GEN, name + '.png'))
    touched.append(name)


def hsv(a):
    r, g, b = [a[..., i].astype(float) / 255 for i in range(3)]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
    return mx, np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)


def seg_dist(shape, p0, p1):
    yy, xx = np.mgrid[:shape[0], :shape[1]]
    d = np.array(p1, float) - np.array(p0, float); L2 = d @ d
    t = ((xx - p0[0]) * d[0] + (yy - p0[1]) * d[1]) / L2
    tc = np.clip(t, 0, 1)
    return np.hypot(xx - (p0[0] + tc * d[0]), yy - (p0[1] + tc * d[1])), t


BOWS = {
    'it_bow_s': dict(top=(223.7, 66), bot=(65.5, 311), t0=0.06, t1=0.94, R=12, wrap=(120, 215)),
    'it_bow_l': dict(top=(252.2, 76), bot=(59.7, 452), t0=0.05, t1=0.95, R=12, wrap=None),
}


def bow_hand(name, c):
    a = load(name)
    A = a[..., 3] > 0
    dist, t = seg_dist(a.shape, c['top'], c['bot'])
    band = (dist <= c['R']) & (t >= c['t0']) & (t <= c['t1'])
    a[band] = 0
    lab, n = ndi.label(a[..., 3] > 0, structure=np.ones((3, 3)))
    sizes = ndi.sum(a[..., 3] > 0, lab, range(1, n + 1))
    for i, s in enumerate(sizes, 1):
        if s < 400: a[lab == i] = 0
    if c['wrap']:
        y0, y1 = c['wrap']
        v, s = hsv(a)
        w = (a[..., 3] > 0) & (v > 0.62) & (s < 0.5)
        w[:y0] = False; w[y1:] = False
        core = ndi.binary_erosion(w, iterations=2)
        a[w & ~core, :3] = (120, 72, 44)
        a[core, :3] = (86, 52, 34)
    m = a[..., 3] > 0
    v, s = hsv(a)
    edge = m & ~ndi.binary_erosion(m, iterations=3)
    dark = v < 0.28
    a[edge & dark, :3] = (214, 170, 120)
    save(name + '_h', a)
    return c


def rgb2hsv(a):
    mx = a[..., :3].max(-1).astype(float) / 255; mn = a[..., :3].min(-1).astype(float) / 255
    r, g, b = [a[..., i].astype(float) / 255 for i in range(3)]
    d = np.maximum(mx - mn, 1e-9)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h, np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-9), 0), mx


BAND = [(172, 184, 202), (125, 138, 162), (70, 82, 112)]
GEM = [[(190, 232, 255), (70, 150, 226), (46, 108, 196)], [(70, 150, 226), (46, 108, 196), (30, 76, 152)], [(46, 108, 196), (30, 76, 152), (22, 56, 120)]]


def circlet(name, front):
    a = load(name)
    gx = None
    if front:
        h, s, v = rgb2hsv(a)
        bl = (a[..., 3] > 0) & (h > 180) & (h < 260)
        bl[40:] = False; bl[:, :105] = False; bl[:, 140:] = False
        gx = int(round(np.where(bl)[1].mean()))
        a[18:41, gx - 7:gx + 8] = a[18:41, gx - 22:gx - 7]
    h, s, v = rgb2hsv(a)
    ok = (a[..., 3] > 0) & (h >= 18) & (h <= 55) & (s < 0.45) & (v > 0.33)
    ok &= (v < 0.8) | (np.arange(a.shape[0])[:, None] <= (35 if front else 42))
    ok[(46 if front else 45):] = False
    ok[:, :62] = False; ok[:, 156:] = False
    cols = {x: np.where(ok[:, x])[0] for x in range(62, 156) if ok[:, x].any()}
    xs = sorted(cols)
    cen = np.array([np.median(cols[x]) for x in xs])
    pad = np.pad(cen, 3, mode='edge')
    cen = np.array([np.median(pad[i:i + 9]) for i in range(len(cen))])
    c = dict(zip(xs, cen.round().astype(int)))
    out = a.copy()
    for x in xs:
        top = c[x] - 1
        above = top - 1
        while above > 0 and ok[above, x]: above -= 1
        for y in np.where(ok[:, x])[0]:
            if y < c[x]: out[y, x, :3] = a[max(above, 0), x, :3]
            else:
                below = y
                while below < a.shape[0] - 1 and ok[below, x]: below += 1
                out[y, x, :3] = a[below, x, :3]
        for i in range(3): out[top + i, x, :3] = BAND[i]
    if front:
        gy = c[gx]
        for dy in (-2, 2):
            for dx in (-1, 0, 1): out[gy + dy, gx + dx, :3] = BAND[0 if dy < 0 else 2]
        for dx in (-2, 2):
            for dy in (-1, 0, 1): out[gy + dy, gx + dx, :3] = (34, 44, 74)
        for dy in range(3):
            for dx in range(3): out[gy - 1 + dy, gx - 1 + dx, :3] = GEM[dy][dx]
        out[gy - 2:gy + 3, gx - 2:gx + 3, 3] = 255
    save(name, out)


MAGE_FRONT = ['body', 'body_nh', 'body_le', 'body_le_nh', 'body_hd', 'body_hd_nh']
MAGE_BACK = ['body_back', 'body_back_nh', 'body_back_le', 'body_back_le_nh', 'body_back_hd', 'body_back_hd_nh']
KNEE = 287


def specks(a, below):
    lab, n = ndi.label(a[..., 3] > 0, structure=np.ones((3, 3)))
    for i in range(1, n + 1):
        if (lab == i).sum() < below: a[lab == i] = 0
    return a


def row_extent(a, y):
    xs = np.where(a[y, :, 3] > 0)[0]
    return (xs.min(), xs.max() + 1) if len(xs) else None


def resample_row(row, lo, hi, cx, width):
    out = np.zeros_like(row)
    src = row[lo:hi]
    d0 = int(round(cx - width / 2)); d1 = d0 + int(round(width))
    for x in range(max(d0, 0), min(d1, row.shape[0])):
        out[x] = src[min(int((x - d0) * (hi - lo) / (d1 - d0)), hi - lo - 1)]
    return out


def back_width(a):
    return {y: (lambda e: e[1] - e[0])(row_extent(a, y)) for y in range(200, 299) if row_extent(a, y)}


OUTLINE = (20, 5, 8, 255)


def fit_row(src, lo, hi, c0, t):
    row = np.zeros_like(src)
    d0 = int(round(c0 - t / 2)); d1 = d0 + int(round(t))
    row[d0 + 3:d1 - 3] = resample_row(src, lo + 4, hi - 4, (d0 + d1) / 2, d1 - d0 - 6)[d0 + 3:d1 - 3]
    row[d0:d0 + 3] = OUTLINE; row[d1 - 3:d1] = OUTLINE
    return row


def front_hem(name, back_w):
    a = load(name)
    H0, E = 220, KNEE - 243
    src_h = a.copy()
    out = a.copy(); out[H0:] = 0
    prof = np.median(src_h[211:218].astype(float), axis=0).round().astype(np.uint8)
    lo0, hi0 = row_extent(src_h, H0)
    for r in range(H0, 244 + E):
        k = back_w[min(r, 298)] / back_w[H0]
        if r < H0 + E: out[r] = fit_row(prof, lo0, hi0, (lo0 + hi0) / 2, (hi0 - lo0) * k)
        else:
            y = r - E; e = row_extent(src_h, y)
            if not e: continue
            out[r] = fit_row(src_h[y], e[0], e[1], (e[0] + e[1]) / 2, (e[1] - e[0]) * k)
    return out


def folds(a, top, bot):
    h, s, v = rgb2hsv(a)
    fab = (a[..., 3] > 0) & (h > 205) & (h < 235) & (s > 0.4) & (v < 0.62)
    for y in range(top, bot):
        e = row_extent(a, y)
        if not e: continue
        lo, hi = e; w = hi - lo
        for frac, dark in ((0.22, 1), (0.40, 0), (0.66, 1), (0.82, 0)):
            x = int(lo + w * frac + (y - top) * (frac - 0.5) * 0.25)
            for dx in range(2):
                if fab[y, x + dx]:
                    a[y, x + dx, :3] = np.clip(a[y, x + dx, :3].astype(int) * (0.8 if dark else 1.22), 0, 255)
    return a


def back_trim(name):
    a = load(name)
    cut = 298 - KNEE
    drop = sorted(set(np.linspace(246, 270, cut).round().astype(int)))
    keep = [y for y in range(a.shape[0]) if y not in drop]
    out = np.zeros_like(a)
    out[:len(keep)] = a[keep]
    return out


R_SRC = np.array([[29, 46, 92], [35, 59, 114], [54, 85, 152]], float)
R_DST = np.array([[31, 50, 96], [42, 70, 127], [58, 92, 150]], float)
H_SRC = np.array([[40, 26, 28], [66, 37, 37], [112, 66, 60]], float)
H_DST = np.array([[42, 30, 36], [58, 42, 48], [98, 72, 80]], float)


def ramp_map(a, mask, src, dst):
    lum = a[..., :3].astype(float) @ np.array([0.3, 0.59, 0.11])
    sl = src @ np.array([0.3, 0.59, 0.11])
    t = np.interp(lum, sl, [0, 1, 2])
    lo = np.clip(np.floor(t).astype(int), 0, 1); f = (t - lo)[..., None]
    f = np.clip(f, 0, 1)
    new = dst[lo] * (1 - f) + dst[lo + 1] * f
    a[mask, :3] = new[mask].clip(0, 255)
    return a


def recolor(a, hair_rows):
    h, s, v = rgb2hsv(a)
    robe = (a[..., 3] > 0) & (h > 205) & (h < 235) & (s > 0.4) & (v > 0.18) & (v < 0.65)
    a = ramp_map(a, robe, R_SRC, R_DST)
    if hair_rows:
        hair = (a[..., 3] > 0) & ((h < 25) | (h > 340)) & (s > 0.2) & (s < 0.62) & (v > 0.1) & (v < 0.55)
        hair[hair_rows:] = False
        a = ramp_map(a, hair, H_SRC, H_DST)
    return a


def narrow_shoulder(a, left):
    out = a.copy()
    for y in range(88, 135):
        e = row_extent(a, y)
        if not e: continue
        d = int(round(9 * np.clip((132 - y) / 22, 0, 1)))
        if not d: continue
        lo, hi = e
        nlo, nhi = (lo + d, hi) if left else (lo, hi - d)
        out[y] = 0
        out[y] = resample_row(a[y], lo, hi, (nlo + nhi) / 2, nhi - nlo)
    return out


def lengthen(a, rows):
    ys = np.where(a[..., 3].any(1))[0]
    bot = ys.max()
    s = bot - 3
    out = a.copy()
    out[s + 1:s + 1 + rows] = a[s]
    out[s + 1 + rows:] = a[s + 1:a.shape[0] - rows]
    return out


def mage_all():
    bw = back_width(load('mage__body_back'))
    for n in MAGE_FRONT:
        a = front_hem('mage__' + n, bw)
        if '_le' in n: a = specks(a, 12)
        a = folds(a, 208, KNEE - 14)
        save('mage__' + n, recolor(a, 0 if '_nh' in n else 100))
    for n in MAGE_BACK:
        a = back_trim('mage__' + n)
        if '_le' in n: a = specks(a, 12)
        save('mage__' + n, recolor(a, 0 if '_nh' in n else 100))
    for side in 'LR':
        for sfx in ('', '_hd', '_le'):
            a = lengthen(narrow_shoulder(load(f'mage__uarm{side}{sfx}'), side == 'L'), 4)
            save(f'mage__uarm{side}{sfx}', recolor(a, 0))
        for sfx in ('', '_hd'):
            save(f'mage__thigh{side}{sfx}', lengthen(load(f'mage__thigh{side}{sfx}'), 4))
        save(f'mage__farm{side}', recolor(load(f'mage__farm{side}'), 0))
    save('mage__cape', recolor(load('mage__cape'), 0))
    for n, front in (('mage__head_ci', True), ('mage__head_back_ci', False)):
        circlet(n, front)
        a = np.array(Image.open(os.path.join(GEN, n + '.png')).convert('RGBA'))
        h, s, v = rgb2hsv(a)
        hair = (a[..., 3] > 0) & ((h < 25) | (h > 340)) & (s > 0.2) & (s < 0.62) & (v > 0.1) & (v < 0.55)
        save(n, ramp_map(a, hair, H_SRC, H_DST))


ARCHER_FRONT = ['body', 'body_nh', 'body_le', 'body_le_nh', 'body_hd', 'body_hd_nh']
ARCHER_BACK = ['body_back', 'body_back_nh', 'body_back_le', 'body_back_le_nh', 'body_back_hd', 'body_back_hd_nh']
LEG_TARGET = 0.45


def leg_factor(part):
    a = load(f'archer__{part}L')
    h, s, v = rgb2hsv(a)
    return LEG_TARGET / np.median(v[(a[..., 3] > 0) & (v > 0.15)])


def lift_legs(a, f):
    h, s, v = rgb2hsv(a)
    m = (a[..., 3] > 0) & (v > 0.08)
    a[m, :3] = np.clip(a[m, :3].astype(float) * f, 0, 255)
    return a


def neck_band(a):
    h, s, v = rgb2hsv(a)
    scarf = (a[..., 3] > 0) & (h > 28) & (h < 52) & (s < 0.45) & (v > 0.6)
    for x in range(72, 150):
        ys = np.where(scarf[70:125, x])[0]
        if not len(ys): continue
        y0 = 70 + ys[0]
        for y in (y0 - 1, y0, y0 + 1):
            if a[y, x, 3] and a[y, x, :3].max() > 60: a[y, x, :3] = np.clip(a[y, x, :3].astype(float) * 0.55, 0, 255)
    return a


def fletching(a):
    out = a.copy()
    d = np.array([-0.30, -0.95]); d /= np.hypot(*d); n = np.array([-d[1], d[0]])
    for bx, by in ((58, 103), (51, 102), (65, 101)):
        for t in np.arange(-14, 38, 0.5):
            for u in np.arange(-3.5, 3.6, 0.5):
                x = int(round(bx + d[0] * t + n[0] * u)); y = int(round(by + d[1] * t + n[1] * u))
                if not (0 <= x < 188 and 0 <= y < 360) or a[y, x, 3]: continue
                if t < 9:
                    if abs(u) <= 0.9: out[y, x] = (90, 62, 34, 255) if u < 0.3 else (58, 40, 22, 255)
                else:
                    half = 3.8 * np.sin(np.pi * (t - 8) / 26) + 0.6
                    if abs(u) <= half - 1.1: out[y, x] = (236, 224, 184, 255) if u < 0.8 else (190, 172, 128, 255)
                    elif abs(u) <= half: out[y, x] = (38, 24, 14, 255)
    return out


def archer_all():
    ft, fs = leg_factor('thigh'), leg_factor('shin')
    for side in 'LR':
        for sfx in ('', '_hd', '_le'):
            save(f'archer__thigh{side}{sfx}', lift_legs(load(f'archer__thigh{side}{sfx}'), ft))
        save(f'archer__shin{side}', lift_legs(load(f'archer__shin{side}'), fs))
    save('archer__head_back_le', specks(load('archer__head_back_le'), 400))
    for n in ARCHER_BACK: save('archer__' + n, neck_band(load('archer__' + n)))
    for n in ARCHER_FRONT: save('archer__' + n, fletching(load('archer__' + n)))


if __name__ == '__main__':
    mage_all()
    archer_all()
    for n, c in BOWS.items(): bow_hand(n, c)
    print(','.join(touched))
