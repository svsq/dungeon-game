#!/usr/bin/env python3
"""TASKS 2167: socket-cut pixels left visible at rest. The L arm rests under the torso; in the zone of fix_2167.zone (shoulder to
armpit, the torso's span over the arm) every torso pixel that is a hole or not the arm's own colour (OKLab ΔE > 0.05) is the
torso's socket edge or sleeve stub showing in front of the arm. World: the gridded parts as the game draws them; arch: the _menu.
  python3 tools/measure/shoulders2167/socket.py [--max N]    exits 1 when any body shows more than N (default 0)"""
import os, sys
import numpy as np
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
os.chdir(ROOT); sys.path.insert(0, os.path.join(ROOT, 'tools'))
from fix_2167 import BODIES, arm_names, zone, rigs, load, exists

def oklab(rgb):
    c = rgb / 255.0; c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    l = np.cbrt(c @ np.array([[0.4122214708, 0.2119034982, 0.0883024619], [0.5363325363, 0.6806995451, 0.2817188376], [0.0514459929, 0.1073969566, 0.6299787005]]))
    return l @ np.array([[0.2104542553, 1.9779984951, 0.0259040371], [0.7936177850, -2.4285922050, 0.7827717662], [-0.0040720468, 0.4505937099, -0.8086757660]])

def gen(n, menu):
    return load(f'art/gen/{n}_menu.png' if menu and exists(f'art/gen/{n}_menu.png') else f'art/gen/{n}.png')

def count(body, arm, g):
    z = zone(body, arm, g); hole = z & (body[..., 3] == 0)
    d = np.linalg.norm(oklab(body[..., :3].astype(float)) - oklab(arm[..., :3].astype(float)), axis=-1)
    return int((z & ~hole & (d > 0.05)).sum() + hole.sum()), int(z.sum())

if __name__ == '__main__':
    lim = int(sys.argv[sys.argv.index('--max') + 1]) if '--max' in sys.argv else 0
    R = rigs(); worst = 0
    print(f'{"body":22s} {"world":>12s} {"arch":>12s}   (cut px / zone px)')
    for rig, bodies in BODIES.items():
        for b in bodies:
            row = []
            for menu in (False, True):
                arm = None
                for n in arm_names(rig, b):
                    a = gen(n, menu)
                    if arm is None: arm = a.copy()
                    else: m = a[..., 3] > 0; arm[m] = a[m]
                c, z = count(gen(f'{rig}__{b}', menu), arm, R[rig]); worst = max(worst, c); row.append(f'{c:5d} / {z:4d}')
            print(f'{rig + "__" + b:22s} {row[0]:>12s} {row[1]:>12s}')
    sys.exit(1 if worst > lim else 0)
