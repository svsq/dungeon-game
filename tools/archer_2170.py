#!/usr/bin/env python3
"""TASKS 2164 (1), 2166 (2-4), 2170, the archer's second pass: every archer part rebuilt from its frozen original
(art/old/<name>-20261117-2152.png) through the earlier steps in their order, so no fix is laid over a fix:
  colour (tools/fix_2152.py: the arch's tone for the _menu copies, the darker WORLD tone for the gridded parts, the muted quiver,
  the hooded outfit's brown cape_hd) → the near forearm mirrored (2160) → both forearms cut shorter (below) → the shoulder caps to the
  armpit (2167) → the world grid (2155) → the gridded arm over the gridded torso again (2167 grid) → the fists cut from the forearms.
The back views keep their 2152 tone and are not rewritten.
Forearms: shoulder to hand was 0.38 H against 0.29-0.32 H on the refs, the forearm 0.19 H against 0.12-0.14 H, the hand 0.41 H over
the floor against 0.47-0.51 H (chars_ref_r2.md 1). CUT rows of the bracer's lacing come out, the cuff and the fist move up the
forearm's own axis, and the rig's hand points with them (live/rigs.js, the archer's entry only).
  python3 tools/archer_2170.py check     the chain at the arch's tone and no cut against the parts in the tree (max |dRGB| per part;
                                         0 before this pass, the world mantle and quiver differ by design after it)
  python3 tools/archer_2170.py run       write art/gen, art/old (the 2155 and 2167 sources), live/rigs.js; prints the prep line
  both take --rig R (a new archer look: HAND0, the hands its cut printed, must be in art/look_params.json) and --fresh"""
import json, os, re, subprocess, sys
import numpy as np
from PIL import Image

os.chdir(os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, 'tools')
import fix_2152 as F
from fix_2160 import mirror
import fix_2167 as C
import rigarg

GRID, CAPT = '20261117-2155', '20261117-2167'
HAND0 = {'L': [61.49490915227541, 212.72212409292908], 'R': [148.07824717331386, 217.02320976542725]}   # the hands as cut in 2146
RIG = 'archer'
CUT = 22, 15            # rows taken out of the bracer, and how far under the elbow they start
# (TASKS 2170) fist{L,R}: the forearm's fist alone, from FIST px over the hand down (in the world from the nearest cell row), drawn again
# over the bow so the grip passes under the fingers; the near one at rest and on the string, the far one round the bow on a shot
FIST, CELL = 13, 360 / 42
BODIES = ['body', 'body_nh', 'body_hd', 'body_hd_nh']
FRONT = BODIES + ['cape', 'cape_hd', 'quiver', 'uarmL', 'uarmR', 'uarmL_hd', 'uarmR_hd', 'farmL', 'farmR', 'thighL', 'thighR',
                  'thighL_hd', 'thighR_hd', 'shinL', 'shinR', 'footL', 'footR']
BACKS = ['body_back', 'body_back_nh', 'body_back_hd', 'body_back_hd_nh']   # checked only: from behind he was already under the floor (dL -7)
load = lambda p: np.array(Image.open(p).convert('RGBA'))
save = lambda a, p: Image.fromarray(a.astype(np.uint8)).save(p)


def rigs():
    return json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip()))


def shorten(a, E, H, d):
    """rows [y0, y0 + d) of the forearm dropped, the rows under them moved up d and along the forearm's slope"""
    y0 = int(round(E[1] + CUT[1])); sx = -int(round(d * (H[0] - E[0]) / (H[1] - E[1])))
    out = np.zeros_like(a); out[:y0] = a[:y0]; low = a[y0 + d:]; W = a.shape[1]
    out[y0:y0 + len(low), max(0, sx):W + min(0, sx)] = low[:, max(0, -sx):W - max(0, sx)]
    return out, [H[0] + sx, H[1] - d]


def build(cut, names=FRONT):
    """{name: (world, arch)} for the archer's parts, arch None for the backs, and the hands' new rig points"""
    R = rigs()[RIG]; E = {s: R['elbow' + s] for s in 'LR'}; hands = dict(HAND0); out = {}
    for n in names:
        w = F.colour(n, True); m = F.colour('body_menu' if n == 'body' else n, False) if n in FRONT else None
        if n == 'farmR': w, m = mirror(w, E['R'], HAND0['R']), mirror(m, E['R'], HAND0['R'])
        if n in ('farmL', 'farmR') and cut:
            s = n[-1]; w, hands[s] = shorten(w, E[s], HAND0[s], cut); m, _ = shorten(m, E[s], HAND0[s], cut)
        out[n] = [w, m]
    for b in BODIES:
        sfx = b[4:].replace('_nh', ''); up = 'uarmL' + sfx if 'uarmL' + sfx in out else 'uarmL'
        armW = out[up][0].copy(); f = out['farmL'][0]; armW[f[..., 3] > 0] = f[f[..., 3] > 0]
        armM = out[up][1].copy(); f = out['farmL'][1]; armM[f[..., 3] > 0] = f[f[..., 3] > 0]
        out[b][0] = C.cap(out[b][0], armW, R)[0]; out[b][1] = C.cap(out[b][1], armM, R)[0]
    return out, hands


def check():
    F.WORLD = F.LIFT; out, _ = build(0, FRONT + BACKS)
    for n, (w, m) in out.items():
        if n == 'cape_hd': continue
        g = f'art/old/{RIG}__{n}-{GRID}.png'; dw = np.abs(load(g).astype(int) - w.astype(int)).max() if os.path.exists(g) else -1
        dm = np.abs(load(f'art/gen/{RIG}__{n}_menu.png').astype(int) - m.astype(int)).max() if m is not None else -1
        print(f'{n:18s} world source {dw:4d}   arch {dm:4d}')


def run():
    out, hands = build(CUT[0]); names = []
    for n, (w, m) in out.items():
        name = f'{RIG}__' + n
        if n in BODIES:
            pre_w = F.colour(n, True); pre_m = F.colour('body_menu' if n == 'body' else n, False)
            save(pre_w, f'art/old/{name}_drawn-{CAPT}.png'); save(pre_m, f'art/old/{name}_menu-{CAPT}.png')
        save(w, f'art/old/{name}-{GRID}.png'); save(w, f'art/gen/{name}.png'); names.append(name)
        if m is not None: save(m, f'art/gen/{name}_menu.png'); names.append(name + '_menu')
    subprocess.run([sys.executable, 'tools/gridify_2155.py', 'run'] + [f'{RIG}__' + n for n in out], check=True, stdout=subprocess.DEVNULL)
    R = rigs()
    for b in BODIES:
        n = f'{RIG}__' + b; arm = C.arm_at_rest(C.arm_names(RIG, b), False, lambda a: f'art/gen/{a}.png')
        save(C.cap(load(f'art/gen/{n}.png'), arm, R[RIG])[0], f'art/gen/{n}.png')
    for s in 'LR':
        R[RIG]['hand' + s] = hands[s]; y0 = hands[s][1] - FIST
        for menu in ('', '_menu'):
            a = load(f'art/gen/{RIG}__farm{s}{menu}.png'); a[:int(round(y0 if menu else round(y0 / CELL) * CELL))] = 0
            save(a, f'art/gen/{RIG}__fist{s}{menu}.png'); names.append(f'{RIG}__fist{s}{menu}')
    open('live/rigs.js', 'w').write('window.RIGS = ' + json.dumps(R) + ';\n')
    print('hands', hands)
    print('python3 tools/prep.py --only ' + ','.join(names))


if __name__ == '__main__':
    (RIG, *more), fresh = rigarg.take([RIG])
    if more: sys.exit('one archer rig')
    F.use(RIG, fresh)
    for k in ('CUT', 'FIST'): globals()[k] = rigarg.param(RIG, 'archer_2170', k, globals()[k])
    HAND0 = rigarg.param(RIG, 'archer_2170', 'HAND0', HAND0, required=True)
    {'check': check, 'run': run}[sys.argv[1]]()
