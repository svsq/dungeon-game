#!/usr/bin/env python3
"""TASKS 2177: the weapon arm (R) is the far arm of the rig's 3/4 view and rests under the torso, the mirror of the cape-side arm of 2167.
Its shoulder shows over the torso as a cap (the arm's own pauldron or sleeve, laid into the torso by caps_2146 in CAP px round shR);
below the cap the torso's edge lies over the upper arm, as on the refs, and only the forearm and fist come out past it.
The zone is the cap: the torso's pixels within CAP of shR (not further in than INNER) where the R arm, turned as it rests (look.arm.hold, rest_r1), lies under
them. A pixel there that is a hole or not the arm's colour (OKLab ΔE > 0.05) is a socket cut in front of the shoulder.
  python3 tools/fix_2177.py run       lays the turned arm into the zone of every body (world from art/gen, arch from _menu; old ones in
                                      art/old/<name>-20261117-2177.png) where the count is not 0, and prints the prep line
  heroShoulderCheck holds the shoulders now (TASKS 2201: socket.py is gone, its L zone predates the arm drawn over the torso and its R count never reached 0)
  run takes --rig R (a new look: its own look.arm.hold from live/data_hero.js) and --fresh (art/gen frozen again as the 2177 copy)"""
import json, math, os, re, shutil, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fix_2167 import BODIES, body_sets, rigs, load, exists
import rigarg

TAG, CAP, INNER, CELLS = '20261117-2177', 16, 8, 42
HOLD = lambda rig: {c['look']['rig']: c['look']['arm']['hold'] for c in classes()}[rig] if rigarg.accepted(rig) else rigarg.look(rig)['arm']['hold']

def classes():
    src = open('live/data_hero.js').read()
    out = []
    for m in re.finditer(r"look: \{ rig: '(\w+)'.*?arm: \{ behind: 1, hold: \[([\d.]+), ([\d.]+)\] \}", src):
        out.append({'look': {'rig': m.group(1), 'arm': {'hold': [float(m.group(2)), float(m.group(3))]}}})
    return out

def rest_r1(g, hold):
    """the upper arm's turn at ease, as drawHero's reach gives it for the hand at hold"""
    S, E, H = (np.array(g[k]) for k in ('shR', 'elbowR', 'handR')); l1, l2 = np.linalg.norm(E - S), np.linalg.norm(H - E); L = l1 + l2
    tx, ty = hold[0] * L, hold[1] * L; d = min(math.hypot(tx, ty), L - 0.5); b = math.atan2(ty, tx)
    a1 = b + math.acos(max(-1, min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))))
    return (a1 - math.atan2(E[1] - S[1], E[0] - S[0]) + math.pi) % (2 * math.pi) - math.pi

def arm_names(rig, body):
    sfx = body[4:].replace('_nh', '')
    return [f'{rig}__uarmR{sfx}' if exists(f'art/gen/{rig}__uarmR{sfx}.png') else f'{rig}__uarmR']

def turned_arm(rig, body, menu, g):
    n = arm_names(rig, body)[0]; p = f'art/gen/{n}_menu.png' if menu and exists(f'art/gen/{n}_menu.png') else f'art/gen/{n}.png'
    r1 = rest_r1(g, HOLD(rig))
    return np.array(Image.open(p).convert('RGBA').rotate(-math.degrees(r1), center=tuple(g['shR']), resample=Image.NEAREST))

def zone(body, arm, g, menu=True):
    """the cap: CAP px round shR, no further in than INNER px from it (the clasps and collars past that are the torso's own), where
    the turned arm lies under the torso; in the world whole cells of the grid, those mostly inside it"""
    yy, xx = np.mgrid[0:body.shape[0], 0:body.shape[1]] + 0.5
    z = (np.hypot(xx - g['shR'][0], yy - g['shR'][1]) < CAP) & (xx > g['shR'][0] - INNER) & (arm[..., 3] > 0) & (body[..., 3] > 0)
    if menu: return z
    C = g['h'] / CELLS; cy, cx = (yy // C).astype(int), (xx // C).astype(int); out = np.zeros_like(z)
    for key in set(zip(cy[z], cx[z])):
        m = (cy == key[0]) & (cx == key[1])
        if z[m].mean() > 0.5: out |= m & (arm[..., 3] > 0) & (body[..., 3] > 0)
    return out

def oklab(rgb):
    c = rgb / 255.0; c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    l = np.cbrt(c @ np.array([[0.4122214708, 0.2119034982, 0.0883024619], [0.5363325363, 0.6806995451, 0.2817188376], [0.0514459929, 0.1073969566, 0.6299787005]]))
    return l @ np.array([[0.2104542553, 1.9779984951, 0.0259040371], [0.7936177850, -2.4285922050, 0.7827717662], [-0.0040720468, 0.4505937099, -0.8086757660]])

def count(body, arm, g, menu=True):
    z = zone(body, arm, g, menu); d = np.linalg.norm(oklab(body[..., :3].astype(float)) - oklab(arm[..., :3].astype(float)), axis=-1)
    return int((z & ((d > 0.05) | (body[..., 3] < 255))).sum()), int(z.sum())

def body_path(rig, b, menu):
    n = f'{rig}__{b}'; return f'art/gen/{n}_menu.png' if menu and exists(f'art/gen/{n}_menu.png') else f'art/gen/{n}.png'

if __name__ == '__main__' and sys.argv[1:2] == ['run']:
    os.chdir(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
    sel, fresh = rigarg.take(())
    R = rigs(); names = []
    for rig, bodies in body_sets(sel or None).items():
        for b in bodies:
            for menu in (False, True):
                p = body_path(rig, b, menu); body = load(p); arm = turned_arm(rig, b, menu, R[rig]); c, z = count(body, arm, R[rig], menu)
                if not c: continue
                n = os.path.basename(p)[:-4]
                if fresh or not exists(f'art/old/{n}-{TAG}.png'): shutil.copyfile(p, f'art/old/{n}-{TAG}.png')
                m = zone(body, arm, R[rig], menu); body[m] = arm[m]; Image.fromarray(body).save(p); names.append(n)
                print(f'{n:26s} capped {c:4d} of {z:4d} px')
    print('python3 tools/prep.py --only ' + ','.join(names) if names else 'nothing to cap')
