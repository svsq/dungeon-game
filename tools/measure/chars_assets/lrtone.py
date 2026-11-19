# python3 tools/measure/chars_assets/lrtone.py: (r3) author's remark 5: the near and far arm and leg of one tone (mean Lab of the
# opaque texture pixels, L part against R part, ΔE) for every outfit's own parts, and from gearsheet's trace.json the feet apart at rest
# (ankle distance in hero heights) and the hand height over the sole (R, the weapon hand)
import os, sys, json; import numpy as np; from PIL import Image
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')); os.chdir(ROOT)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from backhair import lab
A = set(f[:-4] for f in os.listdir('live/assets'))
def m(k): a = np.array(Image.open(f'live/assets/{k}.png').convert('RGBA')).astype(float); op = a[..., 3] > 128; return lab(a[..., :3][op]).mean(0)
worst = 0
for rig in ('hero', 'archer', 'mage'):
    for p in ('uarm', 'farm', 'thigh', 'shin', 'foot'):
        for s in ('', '_cl', '_pw', '_hd', '_le'):
            l, r = f'{rig}__{p}L{s}', f'{rig}__{p}R{s}'
            if l in A and r in A:
                d = np.linalg.norm(m(l) - m(r)); worst = max(worst, d)
                print(f'{l:22s} {m(l).round(1)}  {r:22s} {m(r).round(1)}  dE {d:4.1f}')
print('worst dE %.1f' % worst)
T = json.load(open(os.environ.get('OUTD', 'frames/critic_chars_r3_assets/') + 'gear/trace.json'))
for cls, outs in T.items():
    for o, views in outs.items():
        j = views.get('rest_r') or {}
        if not all(k in j for k in ('ankleL', 'ankleR', 'handR', 'top')): continue
        sole = max(j['ankleL'][1], j['ankleR'][1]); H = sole - j['top'][1]
        print(f'{cls:8s} {o:14s} feet apart {abs(j["ankleL"][0] - j["ankleR"][0]) / H:.3f} H  hand R over ankle {(sole - j["handR"][1]) / H:.3f} H')
