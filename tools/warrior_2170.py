#!/usr/bin/env python3
"""TASKS 2164 (1, 2), 2166 (1), 2170: the warrior's second pass (study/critique/chars_ref_r2.md 1-2, chars_style_r2.md 3).
  arms     the forearms (farmL/R, _cl, _pw) a fifth of the height shorter: rows of the bracer (or the sleeve) between the elbow and the
           wrist cut out and the wrist and fist moved up by DY (shoulder to hand 0.38 H against the ref's 0.29-0.32, the fist hung below
           the groin); drawn sources → art/gen/<name>.png and _menu (old ones in art/old/<name>{,_menu,_drawn}-20261117-2170.png),
           then the 2155 step; the 2160 mirror of farmR is kept (each R is cut by the same rows as its L)
  rig      live/rigs.js: the hero's handL/R up by DY (ART LOCK)
  cape     the cape longer and wider: from the collar down each row is stretched to the hem at HEM and to the right by WIDEN at the hem,
           so it hangs behind both legs to the boot tops (it showed only on the cape side and ended at the knee)
  steel    after the 2155 step: the steel cells of the plate parts back to four tones (seam, shade, plate, light) by the drawn source's
           dark and light share in each cell, the lowest steel cell of each column shaded; the cell mean was two flat tones
  caps     tools/fix_2167.py grid for the hero's bodies only (the gridded arm laid again over the gridded torso)
  fist     hero__fistR{,_pw,_cl}(_menu): the near forearm's fist alone, drawn over the held weapon so the fist closes round its grip
  python3 tools/warrior_2170.py arms|cape|steel|caps|fist|rig [--rig R] [--fresh]
--rig: a new warrior look (hero_b, hero_c); its rows (CUTS, FIST, HEM, …) from art/look_params.json, else the hero's (tools/rigarg.py)"""
import json, os, re, shutil, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rigarg
os.chdir(os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
TAG, GRID = '20261117-2170', '20261117-2155'
DY = 21
# (TASKS 2157) no _cl: bare of gloves the warrior wears his look's gloves, the shirt's forearms were dead files (art/old/*-20261117-2157.png)
CUTS = {'': [(144, 147), (166, 184)], '_pw': [(145, 148), (166, 184)]}
FIST = {'': 175, '_pw': 175}
FIST_WORLD = 180
HEM, WIDEN, COLLAR = 302, 38, 90
STEEL = ['body', 'body_nh', 'body_pw', 'body_pw_nh', 'uarmL', 'uarmR', 'uarmL_pw', 'uarmR_pw']
HEAD_ROW = 69
SEAM = 0.15
DARKEN = 0.06
MOVED = 200
RIG, FRESH = 'hero', False
load = lambda p: np.array(Image.open(p).convert('RGBA'))
save = lambda a, p: Image.fromarray(a).save(p)
exists = os.path.exists

def keep(n):
    for src, dst in ((f'art/gen/{n}.png', f'art/old/{n}-{TAG}.png'), (f'art/gen/{n}_menu.png', f'art/old/{n}_menu-{TAG}.png'),
                     (f'art/old/{n}-{GRID}.png', f'art/old/{n}_drawn-{TAG}.png')):
        if exists(src) and (FRESH or not exists(dst)): shutil.copyfile(src, dst)
    return load(f'art/old/{n}_drawn-{TAG}.png')

def install(n, a):
    save(a, f'art/gen/{n}.png'); save(a, f'art/gen/{n}_menu.png')
    if exists(f'art/old/{n}-{GRID}.png'): os.remove(f'art/old/{n}-{GRID}.png')

def shorten(a, cuts):
    gone = np.zeros(a.shape[0], bool)
    for y0, y1 in cuts: gone[y0:y1] = True
    out = np.zeros_like(a); kept = a[~gone]; out[:len(kept)] = kept
    return out

def arms():
    names = []
    for sfx, cuts in CUTS.items():
        assert sum(b - a for a, b in cuts) == DY
        for side in 'LR':
            n = f'{RIG}__farm{side}{sfx}'; install(n, shorten(keep(n), cuts)); names.append(n)
    print('python3 tools/gridify_2155.py run ' + ' '.join(names))

def rigs_load():
    return json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip()))

def rig():
    R = rigs_load(); g = R[RIG]
    if g['handR'][1] < MOVED: sys.exit(f'{RIG} hands already moved')
    for s in 'LR': g['hand' + s] = [g['hand' + s][0], g['hand' + s][1] - DY]
    open('live/rigs.js', 'w').write('window.RIGS = ' + json.dumps(R) + ';\n'); print(f'{RIG} hands', g['handL'], g['handR'])

def cape():
    n = f'{RIG}__cape'; a = keep(n); h, w = a.shape[:2]; op = a[..., 3] > 0
    ys = np.nonzero(op.any(1))[0]; top, bot = ys.min(), ys.max()
    out = np.zeros_like(a); out[:COLLAR] = a[:COLLAR]
    for y in range(COLLAR, HEM + 1):
        t = (y - COLLAR) / (HEM - COLLAR); sy = min(bot, int(round(COLLAR + t * (bot - COLLAR))))
        xs = np.nonzero(op[sy])[0]
        if not len(xs): continue
        xl, xr = xs.min(), xs.max(); xr2 = min(w - 2, int(round(xr + WIDEN * t ** 0.8)))
        for x in range(xl, xr2 + 1):
            sx = int(round(xl + (x - xl) * (xr - xl) / max(1, xr2 - xl))); out[y, x] = a[sy, sx]
    install(n, out); print(f'python3 tools/gridify_2155.py run {RIG}__cape')

def oklab(rgb):
    from gridify_2155 import oklab as f
    return f(rgb.astype(float))

def steel_pass(n):
    from gridify_2155 import grid, srgb
    g = load(f'art/gen/{n}.png'); d = load(f'art/old/{n}-{GRID}.png'); h, w = g.shape[:2]; C, W, cy, cx = grid(h, w)
    op = d[..., 3] >= 128; lab = oklab(d[..., :3]); Cc = np.hypot(lab[..., 1], lab[..., 2])
    st = op & (Cc < 0.045) & (lab[..., 0] > 0.25)
    from scipy import ndimage
    ink = op & (lab[..., 0] < 0.36) & ndimage.binary_erosion(op, iterations=3)
    cid = cy[:, None] * W + cx[None, :]; N = 42 * W
    n_op = np.bincount(cid[op], minlength=N); n_st = np.bincount(cid[st], minlength=N); n_ink = np.bincount(cid[ink], minlength=N)
    n_hi = np.bincount(cid[st & (lab[..., 0] > 0.74)], minlength=N)
    L_st = np.bincount(cid[st], lab[..., 0][st], minlength=N) / np.maximum(n_st, 1)
    cell_row = np.arange(N) // W
    steel = (n_op > 0) & (n_st >= 0.45 * n_op) & (cell_row * C >= HEAD_ROW if 'body' in n else True)
    seam = steel & (n_ink >= SEAM * n_op) & ('uarm' not in n)
    hi = steel & ~seam & (n_hi >= 0.45 * n_st)
    gl = oklab(g[..., :3]); gop = g[..., 3] >= 128
    cur = np.stack([np.bincount(cid[gop], gl[..., i][gop], minlength=N) for i in range(3)], -1) / np.maximum(np.bincount(cid[gop], minlength=N), 1)[:, None]
    if steel.sum() < 4: return 0
    mean = cur[steel].mean(0)
    med = np.median(L_st[steel & ~seam & ~hi])
    tone = np.where(L_st < med, 1, 2); tone[hi] = 3; tone[seam] = 0
    s2 = steel.reshape(42, W); t2 = tone.reshape(42, W)
    for x in range(W):
        col = np.nonzero(s2[:, x])[0]
        for y in col:
            if (y + 1 >= 42 or not s2[y + 1, x]) and t2[y, x] > 1: t2[y, x] = 1
    tone = t2.ravel()
    TONES = np.array([-0.17, -0.08, 0.02, 0.10])
    new = np.tile(mean, (N, 1)); new[:, 0] = mean[0] + TONES[tone]
    new[:, 1] = 0.6 * mean[1] - 0.001; new[:, 2] = 0.6 * mean[2] - 0.006
    shift = new[steel, 0].mean() - (mean[0] - DARKEN); new[:, 0] -= shift
    rgbc = srgb(new); paint = steel[cid] & gop
    out = g.copy(); out[..., :3] = np.where(paint[..., None], np.round(rgbc[cid]), g[..., :3]).astype(np.uint8)
    save(out, f'art/gen/{n}.png')
    return int(steel.sum()), np.bincount(tone[steel], minlength=4)

def steel():
    for p in STEEL:
        n = f'{RIG}__' + p
        if not exists(f'art/old/{n}-{GRID}.png'): print('skip', n); continue
        print(n, steel_pass(n))

def caps():
    from fix_2167 import body_sets, arm_names, cap, arm_at_rest, rigs
    R = rigs(); names = []
    for b in body_sets([RIG])[RIG]:
        n = f'{RIG}__{b}'; out, k = cap(load(f'art/gen/{n}.png'), arm_at_rest(arm_names(RIG, b), False, lambda a: f'art/gen/{a}.png'), R[RIG])
        save(out, f'art/gen/{n}.png'); names += [n, n + '_menu']
    print('python3 tools/prep.py --only ' + ','.join(names))

def fist():
    names = []
    for sfx, y0 in FIST.items():
        for menu in (False, True):
            src = f'art/gen/{RIG}__farmR{sfx}{"_menu" if menu else ""}.png'; a = load(src); a[:y0 if menu else FIST_WORLD] = 0
            n = f'{RIG}__fistR{sfx}{"_menu" if menu else ""}'; save(a, f'art/gen/{n}.png'); names.append(n)
    print('python3 tools/prep.py --only ' + ','.join(names))

if __name__ == '__main__':
    (RIG, *more), FRESH = rigarg.take([RIG])
    if more or rigarg.base(RIG) != 'hero': sys.exit(f'one warrior rig, not {[RIG, *more]}')
    for k in ('DY', 'CUTS', 'FIST', 'FIST_WORLD', 'HEM', 'WIDEN', 'COLLAR', 'HEAD_ROW', 'MOVED'): globals()[k] = rigarg.param(RIG, 'warrior_2170', k, globals()[k])
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    {'arms': arms, 'rig': rig, 'cape': cape, 'steel': steel, 'caps': caps, 'fist': fist}.get(cmd, lambda: print(__doc__))()
