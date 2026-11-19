"""TASKS 2152, the archer in the world (study/critique/chars_style_r1.md findings 1, 4, 5):
  1. the shoulder caps (tools/measure/caps_2146.py laid the cream sleeve's top onto the bodies) and the sleeve's top on the upper arm
     become the olive mantle of the small ref (art/char_refs/archer_a_small_r4.png: olive over both shoulders, cream sleeve below);
  2. the quiver goes down and back off the head, its fletching muted, so the face is not ringed by three light spots;
  3. olive and leather lifted off the brown floor: olive lighter and greener than the ref's (L 43, a -8, b 32):
     the brazier light warms it, and only a greener texture still reads olive in the world, leather a step
     lighter; skin, hair (the head's rows) and the cream sleeves stay.
  python3 tools/fix_2152.py OUT|install [--rig R] [--fresh]
--rig: a new archer look (archer_b): its head rows from tools/rigarg.head, the rest from art/look_params.json or the archer's;
tools/archer_2170.py calls use() for it"""
import json, re, sys
import numpy as np
sys.path.insert(0, 'tools')
import labtone, rigarg
from labtone import lab, rgb, lch, source, write

STAMP = '20261117-2152'
NAME = 'archer'
RIG = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip()))[NAME]
NECK, NECK_BACK = 77, 58                  # tools/gear.py NEW_LOOK archer: the cell head and beard above, kept as drawn
CAP_R = 20                                # caps_2146 laid 16 px round sh; the rest catches its antialiased rim
SLEEVE_TOP = 22                           # the mantle hangs this far below sh on the upper arm, the cream sleeve shows under it
SLEEVE_WORLD = 30                         # (TASKS 2166) in the world a cell lower: olive 12 % of the figure against the ref's 21 %
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


# TASKS 2166 (chars_style_r2.md 4): lifted for the brazier the olive read L 58 and yellow in the world, the figure the floor's own tone
# (dL -1). The world parts (gridded, tools/archer_2170.py) take WORLD instead: olive under the ref's L 43 and a step greener, leather a
# step darker, so the figure sits under the floor as the warrior does; the cream sleeves stay the one light accent. The arch keeps LIFT:
# under no brazier its olive already matched the small ref (L 37 against 43).
LIFT = dict(oL=5, oa=-5, ob=3, eL=5)
WORLD = dict(oL=-6, oa=-9, ob=3, eL=-4)


def lift(a, head_rows, k=LIFT):
    L, A, B, cream, olive, leather = classes(a)
    keep = np.zeros(L.shape, bool); keep[:head_rows] = True
    lo = L.copy(); la, lb = A.copy(), B.copy()
    w = np.clip((L - 8) / 12, 0, 1)
    o = olive
    lo[o] += k['oL'] * w[o]; la[o] += k['oa'] * w[o]; lb[o] += k['ob'] * w[o]
    le = leather & ~keep
    lo[le] += k['eL'] * w[le]
    out = a.copy(); m = o | le; out[m, :3] = rgb(lo, la, lb)[m]; return out


# (TASKS 2166, chars_style_r2.md 5) in the world the fletching still voted a cream lump at the nape: there it is a dull grey-olive
Q_WORLD = (52, 36, 0.12, 0.3)   # from L, to L, slope, chroma kept


def quiver(a, world=False):
    L, A, B = lab(a[..., :3].astype(float)); lo, q0, qk, c = (52,) + Q_WORLD[1:] if world else (62, 50, 0.45, 0.7)
    light = (a[..., 3] > 127) & (L > lo); nL = np.where(light, q0 + (L - lo) * qk, L)
    out = a.copy(); out[light, :3] = rgb(nL, A * c, B * c)[light]
    dx, dy = Q_SHIFT; sh = np.zeros_like(out); H, W = out.shape[:2]
    sh[dy:, max(0, dx):W + min(0, dx)] = out[:H - dy, max(0, -dx):W - max(0, dx)]; return sh


# (TASKS 2166, chars_assets_r2.md 4) under the hooded outfit's brown cloak the olive cape showed at the legs: archer__cape_hd is the
# cape turned to that cloak's brown (archer__body_back_hd, as drawn: L 25, a 16, b 23), its own folds kept
HD_CLOAK = (-4, 16.2, 22.7)


def cape_hd(a):
    L, A, B, cream, olive, leather = classes(a); op = a[..., 3] > 127
    oa, ob = A[olive].mean(), B[olive].mean(); dL, ca, cb = HD_CLOAK; w = np.clip((L - 8) / 12, 0, 1)
    out = a.copy(); out[op, :3] = rgb(L + dL * w, A + (ca - oa) * w, B + (cb - ob) * w)[op]; return out


def main(out):
    yy, xx = np.mgrid[:360, :RIG['w']]
    near = {s: np.hypot(xx - RIG['sh' + s][0], yy - RIG['sh' + s][1]) < CAP_R for s in 'LR'}
    caps = near['L'] | near['R']
    for n in BODIES + BACKS + LIMBS:
        name = f'{NAME}__' + n; a = source(name, STAMP)
        if n in CAPPED: a = mantle(a, caps)
        if n in ('uarmL', 'uarmR'):
            a = mantle(a, yy < RIG['sh' + n[-1]][1] + SLEEVE_TOP)
        a = lift(a, NECK if n in BODIES else NECK_BACK if n in BACKS else 0, LIFT)
        write(name, a, STAMP, out); print(name)
    write(f'{NAME}__quiver', quiver(source(f'{NAME}__quiver', STAMP)), STAMP, out); print(f'{NAME}__quiver')


def colour(n, world):
    """part n (without the rig prefix) recoloured from its frozen original: the arch's tone or the world's"""
    yy, xx = np.mgrid[:360, :RIG['w']]
    caps = np.zeros(yy.shape, bool)
    for s in 'LR': caps |= np.hypot(xx - RIG['sh' + s][0], yy - RIG['sh' + s][1]) < CAP_R
    if n == 'quiver': return quiver(source(f'{NAME}__quiver', STAMP), world)
    if n == 'cape_hd': return cape_hd(colour('cape', world))
    a = source(f'{NAME}__' + n, STAMP)
    if n in CAPPED: a = mantle(a, caps)
    if n in ('uarmL', 'uarmR'): a = mantle(a, yy < RIG['sh' + n[-1]][1] + (SLEEVE_WORLD if world else SLEEVE_TOP))
    return lift(a, NECK if n in BODIES else NECK_BACK if n in BACKS else 0, WORLD if world else LIFT)


def use(rig, fresh=False):
    """the module's parts and numbers for rig: a new archer look's own, the archer's where it sets none"""
    global NAME, RIG, NECK, NECK_BACK
    if rigarg.base(rig) != 'archer': sys.exit(f'{rig}: not an archer rig')
    labtone.FRESH = fresh
    if rig == NAME: return
    R = rigarg.read_rigs()
    if rig not in R: sys.exit(f'{rig}: no RIGS.{rig} in live/rigs.js')
    NAME, RIG = rig, R[rig]
    hd = rigarg.head(rig); NECK, NECK_BACK = hd['body'], hd['body_back']
    for k in ('CAP_R', 'SLEEVE_TOP', 'SLEEVE_WORLD', 'Q_SHIFT', 'LIFT', 'WORLD', 'Q_WORLD', 'HD_CLOAK'): globals()[k] = rigarg.param(rig, 'fix_2152', k, globals()[k])


if __name__ == '__main__':
    (rig, *more), fresh = rigarg.take([NAME])
    if more: sys.exit('one archer rig')
    use(rig, fresh); main(sys.argv[1])
