"""ref critic r3: arm reach in shares of height H, game rig joints (grab.mjs) against the sheet landmarks of measure.py.
   reach = shoulder to hand straight, bones = shoulder-elbow plus elbow-hand, hand_h = hand above the soles,
   hand_dx = hand out from its own shoulder (+ outward from the body's axis).
   python3 tools/measure/chars_ref/reach.py [frames/critic_chars_r3_ref]"""
import json, math, os, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from measure import REF

ROOT = Path(os.environ.get('ROOT', Path(__file__).resolve().parents[3]))
OUT = ROOT / (sys.argv[1] if len(sys.argv) > 1 else 'frames/critic_chars_r3_ref')
J = json.load(open(OUT / 'game/joints.json'))
d = lambda a, b: math.hypot(a[0] - b[0], a[1] - b[1])


def arms(p, top, g):
    H = g - top; o = {}
    for s, sg in [('L', -1), ('R', 1)]:
        sh, el, hd = p['sh' + s], p['elbow' + s], p['hand' + s]
        o[s] = dict(reach=d(sh, hd) / H, bones=(d(sh, el) + d(el, hd)) / H, upper=d(sh, el) / H, fore=d(el, hd) / H,
                    hand_h=(g - hd[1]) / H, hand_dx=sg * (hd[0] - sh[0]) / H)
    return o


rows = []
for c, r in REF.items():
    rows.append((c, 'ref', arms(r, r['top'], r['ground'])))
    for v in ['arch_' + c, f'rest_{c}_right'] + [f'run_{c}_{i}' for i in range(4)] + [f'act_{c}']:
        if v in J:
            j = J[v]['joints']; rows.append((c, v, arms(j, j['top'][1], j['ground'][1])))
out = {f'{c}:{v}': a for c, v, a in rows}
json.dump(out, open(OUT / 'reach.json', 'w'), indent=1)
print(f"{'':28s} {'L reach':>8s} {'bones':>6s} {'hand_h':>6s} {'dx':>6s} | {'R reach':>8s} {'bones':>6s} {'hand_h':>6s} {'dx':>6s}")
for c, v, a in rows:
    print(f'{c + " " + v:28s}', ' | '.join(' '.join(f'{a[s][k]:6.3f}' for k in ['reach', 'bones', 'hand_h', 'hand_dx']) for s in 'LR'))
