# python3 tools/measure/chars_assets/jointseam.py [rig ...]: tools/jointgap.py's test (what is covered round a joint at rest must stay
# covered when the child part turns about its pivot) on live/assets, for every outfit's own textures and with the real parent
# (body for shoulder and hip, upper arm for elbow, thigh for knee, shin for ankle), not only the body. Angles: rig rad.
import os, sys, json, re; import numpy as np; from PIL import Image
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')); os.chdir(ROOT)
RG = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip()))
A = set(f[:-4] for f in os.listdir('live/assets'))
# outfit suffix per slot, as scene_hero.js GEARS maps them (armour: body/uarm/thigh; gloves: farm; boots: shin/foot)
OUT = {'hero': {'shirt': ('cl', '', ''), 'leather': ('', '', ''), 'plate': ('pw', 'pw', 'pw'), 'cloak': ('hd', '', '')},
       'archer': {'leather': ('', '', ''), 'cloak': ('hd', '', '')},
       'mage': {'robe': ('', '', ''), 'leather': ('le', '', ''), 'cloak': ('hd', '', '')}}
# radius in rig px and ranges as the project's rig_*.sh pass jointgap.py (12 px at the shoulder, 14 at the hip; the near arm's swing
# −1.95..0.5, the far arm's −0.6..0.4); elbow, knee and ankle ranges cover the run and the strike's bend
JOINTS = [('uarm', 'body', 'sh', 12, {'R': (-1.95, 0.5), 'L': (-0.6, 0.4)}), ('farm', 'uarm', 'elbow', 12, (-1.4, 0.1)), ('thigh', 'body', 'hip', 14, (-0.7, 0.5)),
          ('shin', 'thigh', 'knee', 12, (-0.1, 1.2)), ('foot', 'shin', 'ankle', 12, (-0.3, 0.3))]
def tex(rig, n, s): k = f'{rig}__{n}' + (f'_{s}' if s and f'{rig}__{n}_{s}' in A else ''); return k
def op(k): return np.array(Image.open(f'live/assets/{k}.png').convert('RGBA'))[..., 3] > 60
rows = []
for rig in (sys.argv[1:] or ['hero', 'archer', 'mage']):
    R = RG[rig]; L = np.hypot(R['shL'][0] - R['elbowL'][0], R['shL'][1] - R['elbowL'][1])
    for oname, (ar, gl, bo) in OUT[rig].items():
        for child, parent, key, rr, rng in JOINTS:
            for side in 'LR':
                a0, a1 = rng[side] if isinstance(rng, dict) else rng
                slot = ar if child in ('uarm', 'thigh') else gl if child == 'farm' else bo
                pslot = ar if parent in ('body', 'uarm', 'thigh') else bo
                ck = tex(rig, child + side, slot); pk = tex(rig, parent + ('' if parent == 'body' else side), pslot)
                P, C = op(pk), op(ck)
                if P.shape != C.shape: rows.append((rig, oname, ck, 'SIZE', f'{C.shape} vs parent {P.shape}')); continue
                px, py = R[key + side]; Rr = rr; yy, xx = np.mgrid[:P.shape[0], :P.shape[1]]
                near = np.hypot(xx - px, yy - py) < Rr; want = near & (P | C); worst, at = 0, 0
                for a in np.linspace(a0, a1, 29):
                    c, s = np.cos(-a), np.sin(-a); sx = px + (xx - px) * c - (yy - py) * s; sy = py + (xx - px) * s + (yy - py) * c
                    ix, iy = np.round(sx).astype(int), np.round(sy).astype(int); ok = (ix >= 0) & (iy >= 0) & (ix < P.shape[1]) & (iy < P.shape[0])
                    T = np.zeros_like(P); T[ok] = C[iy[ok], ix[ok]]; g = int((want & ~(P | T)).sum())
                    if g > worst: worst, at = g, a
                lim = max(4, int(0.03 * want.sum()))
                rows.append((rig, oname, ck, 'FAIL' if worst > lim else 'ok', f'{key}{side} worst {worst} px at {at:+.2f} (limit {lim}; parent {pk}; area ≈ {worst / (R["h"] / 84) ** 2:.1f} screen px, {worst / (R["h"] / 42) ** 2:.1f} world px)'))
for r in rows: print(f'{r[3]:4s} {r[0]:6s} {r[1]:8s} {r[2]:22s} {r[4]}')
print('FAIL', sum(r[3] == 'FAIL' for r in rows), 'of', len(rows))
