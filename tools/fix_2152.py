"""TASKS 2152, the archer in the world (study/critique/chars_style_r1.md findings 1, 4, 5):
  1. the shoulder caps (tools/measure/caps_2146.py laid the cream sleeve's top onto the bodies) and the sleeve's top on the upper arm
     become the olive mantle of the small ref (art/char_refs/archer_a_small_r4.png: olive over both shoulders, cream sleeve below);
  2. the quiver goes down and back off the head, its fletching muted, so the face is not ringed by three light spots;
  3. olive and leather lifted off the brown floor: olive lighter and greener than the ref's (L 43, a -8, b 32):
     the brazier light warms it, and only a greener texture still reads olive in the world, leather a step
     lighter; skin, hair (the head's rows) and the cream sleeves stay.
  python3 tools/fix_2152.py OUT|install"""
import json, re, sys
import numpy as np
sys.path.insert(0, 'tools')
from labtone import lab, rgb, lch, source, write

STAMP = '20261117-2152'
RIG = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip()))['archer']
NECK, NECK_BACK = 77, 58                  # tools/gear.py NEW_LOOK archer: the cell head and beard above, kept as drawn
CAP_R = 20                                # caps_2146 laid 16 px round sh; the rest catches its antialiased rim
SLEEVE_TOP = 22                           # the mantle hangs this far below sh on the upper arm, the cream sleeve shows under it
Q_SHIFT = (-9, 24)                        # 3 world cells down, one back: a dark cell of cape between fletching and head
CAPPED = ('body', 'body_menu', 'body_nh')
BODIES = CAPPED + ('body_hd', 'body_hd_nh')
BACKS = ('body_back', 'body_back_nh', 'body_back_hd', 'body_back_hd_nh')
LIMBS = ('cape', 'uarmL', 'uarmR', 'uarmL_hd', 'uarmR_hd', 'farmL', 'farmR', 'thighL', 'thighR', 'thighL_hd', 'thighR_hd',
         'shinL', 'shinR', 'footL', 'footR')


def classes(a):
    L, A, B = lab(a[..., :3].astype(float)); C, h = lch(L, A, B); op = a[..., 3] > 127
    skin = op & (L > 50) & (h < 72) & (C > 30)
    cream = op & (h >= 68) & (h <= 88) & (L > 42) & (C < 45) & ~skin
    olive = op & (h > 88) & (h < 135) & (C > 8)
    leather = op & (h > 20) & (h < 85) & (L > 12) & ~skin & ~cream
    return L, A, B, cream, olive, leather


def mantle(a, sel):
    """cream pixels in sel repainted as the olive mantle: the cream's own light ramp kept as the cloth's folds"""
    L, A, B, cream, *_ = classes(a); m = sel & cream
    if not m.any(): return a
    t = np.clip((L - 45) / 40, 0, 1)
    nL, nA, nB = 20 + 20 * t, -8 - 3 * t, 18 + 12 * t
    out = a.copy(); out[m, :3] = rgb(nL, nA, nB)[m]; return out


def lift(a, head_rows):
    L, A, B, cream, olive, leather = classes(a)
    keep = np.zeros(L.shape, bool); keep[:head_rows] = True
    lo = L.copy(); la, lb = A.copy(), B.copy()
    w = np.clip((L - 8) / 12, 0, 1)
    o = olive
    lo[o] += 5 * w[o]; la[o] -= 5 * w[o]; lb[o] += 3 * w[o]
    le = leather & ~keep
    lo[le] += 5 * w[le]
    out = a.copy(); m = o | le; out[m, :3] = rgb(lo, la, lb)[m]; return out


def quiver(a):
    L, A, B = lab(a[..., :3].astype(float)); light = (a[..., 3] > 127) & (L > 62)
    nL = np.where(light, 50 + (L - 62) * 0.45, L)
    out = a.copy(); out[light, :3] = rgb(nL, A * 0.7, B * 0.7)[light]
    dx, dy = Q_SHIFT; sh = np.zeros_like(out); H, W = out.shape[:2]
    sh[dy:, max(0, dx):W + min(0, dx)] = out[:H - dy, max(0, -dx):W - max(0, dx)]; return sh


def main(out):
    yy, xx = np.mgrid[:360, :RIG['w']]
    near = {s: np.hypot(xx - RIG['sh' + s][0], yy - RIG['sh' + s][1]) < CAP_R for s in 'LR'}
    caps = near['L'] | near['R']
    for n in BODIES + BACKS + LIMBS:
        name = 'archer__' + n; a = source(name, STAMP)
        if n in CAPPED: a = mantle(a, caps)
        if n in ('uarmL', 'uarmR'):
            a = mantle(a, yy < RIG['sh' + n[-1]][1] + SLEEVE_TOP)
        a = lift(a, NECK if n in BODIES else NECK_BACK if n in BACKS else 0)
        write(name, a, STAMP, out); print(name)
    write('archer__quiver', quiver(source('archer__quiver', STAMP)), STAMP, out); print('archer__quiver')


main(sys.argv[1])
