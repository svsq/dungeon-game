"""ref critic r2: game <-> reference numbers in shares of height H (top of the hair to the soles).
   Game landmarks come from the rig's traced joints (grab.mjs), reference landmarks are read by eye off the sheets
   (grid.py on art/char_refs/*), in the crop coordinates of pairs.py's REF boxes shifted to the crop origins below.
   python3 tools/measure/chars_ref/measure.py [frames/critic_chars_r2_ref]"""
import json, math, os, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(os.environ.get('ROOT', Path(__file__).resolve().parents[3]))
OUT = ROOT / (sys.argv[1] if len(sys.argv) > 1 else 'frames/critic_chars_r2_ref')
J = json.load(open(OUT / 'game/joints.json'))

# tops and soles from a pixel scan of the sheet (background distance > 30), the rest by eye
# L = the viewer's left limb, R = the viewer's right one (the game's rig names them the same way when he faces right)
REF = {
    'warrior': dict(src='warrior_a_v2', top=15, ground=947, chin=125,
                    shL=(120, 210), shR=(320, 210), elbowL=(95, 365), elbowR=(345, 390), handL=(65, 470), handR=(355, 505),
                    hipL=(185, 565), hipR=(265, 565), kneeL=(165, 735), kneeR=(290, 740), ankleL=(160, 880), ankleR=(295, 875),
                    footL=(120, 215, 947), footR=(255, 370, 925)),
    'archer': dict(src='archer_a', top=21, ground=916, chin=140,
                   shL=(125, 265), shR=(335, 260), elbowL=(115, 395), elbowR=(378, 398), handL=(112, 515), handR=(420, 455),
                   hipL=(165, 560), hipR=(265, 560), kneeL=(140, 690), kneeR=(280, 690), ankleL=(132, 830), ankleR=(292, 825),
                   footL=(85, 195, 916), footR=(245, 365, 889)),
    'mage': dict(src='mage_a_v4', top=36, ground=927, chin=160,
                 shL=(150, 235), shR=(330, 235), elbowL=(125, 380), elbowR=(330, 370), handL=(78, 295), handR=(410, 365),
                 hipL=(190, 560), hipR=(270, 560), kneeL=(175, 705), kneeR=(300, 705), ankleL=(165, 850), ankleR=(320, 840),
                 footL=(110, 215, 927), footR=(270, 385, 916)),
}
# chins read off grid_harch_<cls>.png (arch crop, 3.2 px per world px; y from the top of the hair)
GAME_CHIN = {'warrior': 42, 'archer': 44, 'mage': 48}


def ang(a, b, c):
    v1, v2 = np.subtract(a, b), np.subtract(c, b)
    return math.degrees(math.acos(max(-1, min(1, np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9)))))


def tilt(a, b):
    return math.degrees(math.atan2(b[0] - a[0], b[1] - a[1]))


def ref_numbers(r):
    top, g = r['top'], r['ground']; H = g - top
    fL, fR = r['footL'], r['footR']
    return dict(H=H, head=(r['chin'] - top) / H, shoulders=(r['shR'][0] - r['shL'][0]) / H,
                hip_h=(g - (r['hipL'][1] + r['hipR'][1]) / 2) / H, knee_h=(g - (r['kneeL'][1] + r['kneeR'][1]) / 2) / H,
                kneeL=ang(r['hipL'], r['kneeL'], r['ankleL']), kneeR=ang(r['hipR'], r['kneeR'], r['ankleR']),
                elbowL=ang(r['shL'], r['elbowL'], r['handL']), elbowR=ang(r['shR'], r['elbowR'], r['handR']),
                handL_h=(g - r['handL'][1]) / H, handR_h=(g - r['handR'][1]) / H,
                ankles=(r['ankleR'][0] - r['ankleL'][0]) / H, feet=((fR[0] + fR[1]) / 2 - (fL[0] + fL[1]) / 2) / H,
                gap=(fR[0] - fL[1]) / H, sole_dy=(fL[2] - fR[2]) / H, footlen=((fL[1] - fL[0]) + (fR[1] - fR[0])) / 2 / H,
                shinL_tilt=tilt(r['kneeL'], r['ankleL']), shinR_tilt=tilt(r['kneeR'], r['ankleR']))


def game_numbers(j, chin_px=None, k=1):
    top, g = j['top'][1], j['ground'][1]; H = g - top
    fl = lambda s: (min(j['heel' + s][0], j['toe' + s][0]), max(j['heel' + s][0], j['toe' + s][0]), max(j['heel' + s][1], j['toe' + s][1]))
    fL, fR = fl('L'), fl('R')
    d = dict(H=H, shoulders=(j['shR'][0] - j['shL'][0]) / H,
             hip_h=(g - (j['hipL'][1] + j['hipR'][1]) / 2) / H, knee_h=(g - (j['kneeL'][1] + j['kneeR'][1]) / 2) / H,
             kneeL=ang(j['hipL'], j['kneeL'], j['ankleL']), kneeR=ang(j['hipR'], j['kneeR'], j['ankleR']),
             elbowL=ang(j['shL'], j['elbowL'], j['handL']), elbowR=ang(j['shR'], j['elbowR'], j['handR']),
             handL_h=(g - j['handL'][1]) / H, handR_h=(g - j['handR'][1]) / H,
             ankles=(j['ankleR'][0] - j['ankleL'][0]) / H, feet=((fR[0] + fR[1]) / 2 - (fL[0] + fL[1]) / 2) / H,
             gap=(fR[0] - fL[1]) / H, sole_dy=(fL[2] - fR[2]) / H, footlen=((fL[1] - fL[0]) + (fR[1] - fR[0])) / 2 / H,
             shinL_tilt=tilt(j['kneeL'], j['ankleL']), shinR_tilt=tilt(j['kneeR'], j['ankleR']))
    if chin_px is not None:
        d['head'] = chin_px / (H * k)
    return d


# Lab
def lab(rgb):
    c = rgb.astype(float) / 255
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def seg_px(img, mask, a, b, r):
    h, w = mask.shape
    ys, xs = np.mgrid[0:h, 0:w]
    p = np.stack([xs + 0.5, ys + 0.5], -1)
    a, b = np.array(a), np.array(b)
    t = np.clip(((p - a) @ (b - a)) / max(1e-9, (b - a) @ (b - a)), 0.15, 0.85)
    near = np.linalg.norm(p - (a + t[..., None] * (b - a)), axis=-1) < r
    sel = near & mask
    return img[sel]


def limb_tone(name, k=1.0, at=None):
    """Lab median of each limb segment of the drawn hero (the mask from the with/without pair)."""
    j = J[name]['joints']; bx, by = J[name]['box'][:2]
    a = np.asarray(Image.open(OUT / f'game/{name}_all.png').convert('RGB')).astype(int)
    b = np.asarray(Image.open(OUT / f'game/{name}_none.png').convert('RGB')).astype(int)
    m = np.abs(a - b).sum(2) > 24
    L = lab(a)
    tr = (lambda p: (at[0] + (p[0] - at[0]) * k - bx, at[1] + (p[1] - at[1]) * k - by)) if at else (lambda p: (p[0] - bx, p[1] - by))
    out = {}
    for s in 'LR':
        for nm, p, q in [('thigh', 'hip', 'knee'), ('shin', 'knee', 'ankle'), ('uarm', 'sh', 'elbow'), ('farm', 'elbow', 'hand')]:
            px = seg_px(L, m, tr(j[p + s]), tr(j[q + s]), 1.6 * k)
            if len(px):
                out[nm + s] = np.median(px, 0).round(1).tolist() + [len(px)]
    return out


def part_tone(cls):
    pre = {'warrior': 'hero', 'archer': 'archer', 'mage': 'mage'}[cls]
    out = {}
    for nm in ['thigh', 'shin', 'foot', 'uarm', 'farm']:
        for s in 'LR':
            f = ROOT / f'art/gen/{pre}__{nm}{s}.png'
            if not f.exists():
                continue
            im = np.asarray(Image.open(f).convert('RGBA')).astype(int)
            sel = im[..., 3] > 128
            px = lab(im[..., :3][sel])
            core = px[px[:, 0] > 12]
            out[nm + s] = np.median(core, 0).round(1).tolist() + [int(sel.sum())]
    return out


# Lab hue angle h_ab bins; dark is L* < 15 (outline and deep shade), neutral is chroma < 9 (steel, grey hair, bone)
HUES = [('red', (345, 40)), ('brown-orange', (40, 72)), ('gold-yellow', (72, 100)), ('olive-green', (100, 160)), ('teal', (160, 230)), ('blue', (230, 300)), ('violet', (300, 345))]


def shares(rgb, mask):
    L = lab(rgb[mask])
    C = np.hypot(L[:, 1], L[:, 2]); h = np.degrees(np.arctan2(L[:, 2], L[:, 1])) % 360
    dark = L[:, 0] < 15; neutral = ~dark & (C < 9); rest = ~dark & ~neutral
    out = {'dark': dark.mean(), 'neutral': neutral.mean()}
    med = {}
    for n, (lo, hi) in HUES:
        sel = rest & (((h >= lo) | (h < hi)) if lo > hi else ((h >= lo) & (h < hi)))
        out[n] = sel.mean()
        if sel.sum() > 20:
            med[n] = np.median(L[sel], 0).round(0).astype(int).tolist()
    r = {k: round(float(v) * 100, 1) for k, v in out.items()}
    r['Lab'] = med
    return r


def main():
    res = {'ref': {}, 'arch': {}, 'world': {}, 'tone_arch': {}, 'tone_world': {}, 'tone_parts': {}, 'shares': {}}
    for c, r in REF.items():
        res['ref'][c] = {k: round(v, 3) for k, v in ref_numbers(r).items()}
        a = J['arch_' + c]
        res['arch'][c] = {k: round(v, 3) for k, v in game_numbers(a['joints'], GAME_CHIN[c], a['at'][2]).items()}
        res['world'][c] = {k: round(v, 3) for k, v in game_numbers(J[f'rest_{c}_right']['joints']).items()}
        res['tone_arch'][c] = limb_tone('arch_' + c, a['at'][2], a['at'])
        res['tone_world'][c] = limb_tone(f'rest_{c}_right')
        res['tone_parts'][c] = part_tone(c)
        sh = {}
        for n, f in [('ref_big', f'ref_{c}_big.png'), ('ref_small', f'ref_{c}_small.png'), ('arch', f'hero_arch_{c}.png'), ('world', f'hero_rest_{c}_right.png')]:
            im = np.asarray(Image.open(OUT / f).convert('RGB'))
            m = np.abs(im.astype(int) - np.array([28, 28, 36])).sum(2) > 6
            sh[n] = shares(im, m)
        res['shares'][c] = sh
    for c in REF:
        for side in ['tone_arch', 'tone_world', 'tone_parts']:
            t = res[side][c]
            res[side][c]['dE'] = {n: round(float(np.linalg.norm(np.subtract(t[n + 'L'][:3], t[n + 'R'][:3]))), 1)
                                  for n in ['thigh', 'shin', 'foot', 'uarm', 'farm'] if n + 'L' in t and n + 'R' in t}
    json.dump(res, open(OUT / 'measure.json', 'w'), indent=1)
    keys = ['head', 'shoulders', 'hip_h', 'knee_h', 'kneeL', 'kneeR', 'elbowL', 'elbowR', 'handL_h', 'handR_h', 'ankles', 'feet', 'gap', 'sole_dy', 'footlen', 'shinL_tilt', 'shinR_tilt']
    for c in REF:
        print(f'\n== {c}  (ref / arch / world)')
        for k in keys:
            print(f'{k:11s}', '  '.join(f"{res[s][c].get(k, float('nan')):7.3f}" for s in ['ref', 'arch', 'world']))
        for side in ['tone_arch', 'tone_world', 'tone_parts']:
            print(side, 'dE L/R', res[side][c]['dE'], ' L*:', {n: (res[side][c][n + 'L'][0], res[side][c][n + 'R'][0]) for n in res[side][c]['dE']})
        for n, s in res['shares'][c].items():
            print(f'  shares {n:9s}', s)


if __name__ == '__main__':
    main()
