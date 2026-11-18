#!/usr/bin/env python3
"""TASKS 2167: the torsos are drawn armless, and the cape-side arm (L) is drawn under the torso. Its shoulder cap (caps_2146, 16 px
round the pivot) covered only the shoulder ball: below it the torso's own socket edge, the blurred sleeve stub the generator left
and its dark gaps lay over the arm, a notch in front of the arm. Here the cap goes on down the upper arm to the armpit: in every row
from 12 px under the shoulder until the arm's inner edge comes within 2 px of the torso's outline, the L arm as it rests (upper and
forearm of the body's outfit) replaces the torso wherever it lies under the torso's span. A cap rather than the arm over the
torso: drawn after the body the upper arm parted from the forearm (still under it) on every stride.
  python3 tools/fix_2167.py run      drawn sources → art/gen/<body>.png, menus → art/gen/<body>_menu.png (old ones kept in
                                     art/old/<name>-20261117-2167.png), then the 2155 step with the names printed, then
  python3 tools/fix_2167.py grid     the gridded arm laid again over the gridded torso in the same zone (the 2155 step averages
                                     torso and arm into one cell and maps the cap to the torso's own tones: a seam at rest), then prep
  both take --rig R (a new look: its class's outfits, those it has) and run takes --fresh (art/gen as the source again)"""
import json, os, re, shutil, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rigarg

TAG, GRID = '20261117-2167', '20261117-2155'
BODIES = {'hero': ['body', 'body_nh', 'body_cl', 'body_cl_nh', 'body_pw', 'body_pw_nh', 'body_hd', 'body_hd_nh'],
          'archer': ['body', 'body_nh', 'body_hd', 'body_hd_nh'],
          'mage': ['body', 'body_nh', 'body_le', 'body_le_nh', 'body_hd', 'body_hd_nh']}
TOP, GAP, REACH = 12, 2, 40

def body_sets(rigs=None):
    """{rig: its torsos}: the accepted looks' BODIES as they are, a new look's those of its class it has in art/gen"""
    if rigs is None: return BODIES
    return {r: BODIES[r] if rigarg.accepted(r) else [b for b in BODIES[rigarg.base(r)] if os.path.exists(f'art/gen/{r}__{b}.png')] for r in rigs}

rigs = lambda: json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip()))
load = lambda p: np.array(Image.open(p).convert('RGBA'))
exists = os.path.exists

def arm_names(rig, body):
    sfx = body[4:].replace('_nh', '')
    return [f'{rig}__{p}L{sfx}' if exists(f'art/gen/{rig}__{p}L{sfx}.png') else f'{rig}__{p}L' for p in ('uarm', 'farm')]

def drawn(n):
    return f'art/old/{n}-{GRID}.png' if exists(f'art/old/{n}-{GRID}.png') else f'art/gen/{n}.png'

def arm_at_rest(names, menu, src=None):
    out = None
    for n in names:
        a = load(src(n) if src else f'art/gen/{n}_menu.png' if menu and exists(f'art/gen/{n}_menu.png') else drawn(n))
        if out is None: out = a.copy()
        else: m = a[..., 3] > 0; out[m] = a[m]
    return out

def zone(body, arm, g):
    """rows and columns of the torso that lie over the resting L arm, shoulder to armpit (shared with the measure)"""
    sx, sy = g['shL']; ba, aa = body[..., 3] > 0, arm[..., 3] > 0; z = np.zeros_like(ba); y = int(sy + TOP)
    while y < g['elbowL'][1]:
        bx = np.nonzero(ba[y])[0]; ax = np.nonzero(aa[y, :int(sx + REACH)])[0]
        if not len(bx) or not len(ax) or ax.max() - bx.min() <= GAP: break
        z[y, bx.min():int(sx + REACH)] = aa[y, bx.min():int(sx + REACH)]; y += 1
    return z

def cap(body, arm, g):
    out = body.copy(); z = zone(body, arm, g); out[z] = arm[z]; return out, int(z.sum())

if __name__ == '__main__':
    SEL, FRESH = rigarg.take(())
    SETS = body_sets(SEL or None)

if __name__ == '__main__' and sys.argv[1:2] == ['run']:
    os.chdir(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
    R = rigs(); names = []
    for rig, bodies in SETS.items():
        for b in bodies:
            n = f'{rig}__{b}'; arms = arm_names(rig, b)
            keep = {f'art/gen/{n}.png': f'art/old/{n}-{TAG}.png', f'art/gen/{n}_menu.png': f'art/old/{n}_menu-{TAG}.png', drawn(n): f'art/old/{n}_drawn-{TAG}.png'}
            for src, dst in keep.items():
                if FRESH or not exists(dst): shutil.copyfile(src, dst)
            world, k1 = cap(load(f'art/old/{n}_drawn-{TAG}.png'), arm_at_rest(arms, False), R[rig])
            menu, k2 = cap(load(f'art/old/{n}_menu-{TAG}.png'), arm_at_rest(arms, True), R[rig])
            Image.fromarray(world).save(f'art/gen/{n}.png'); Image.fromarray(menu).save(f'art/gen/{n}_menu.png')
            if exists(f'art/old/{n}-{GRID}.png'): os.remove(f'art/old/{n}-{GRID}.png')
            print(f'{n:22s} capped {k1:4d} px world, {k2:4d} px arch'); names.append(n)
    print('python3 tools/gridify_2155.py run ' + ' '.join(names)); print('python3 tools/fix_2167.py grid')

if __name__ == '__main__' and sys.argv[1:2] == ['grid']:
    os.chdir(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
    R = rigs(); names = []
    for rig, bodies in SETS.items():
        for b in bodies:
            n = f'{rig}__{b}'; out, k = cap(load(f'art/gen/{n}.png'), arm_at_rest(arm_names(rig, b), False, lambda a: f'art/gen/{a}.png'), R[rig])
            Image.fromarray(out).save(f'art/gen/{n}.png'); names += [n, n + '_menu']
    print('python3 tools/prep.py --only ' + ','.join(names))
