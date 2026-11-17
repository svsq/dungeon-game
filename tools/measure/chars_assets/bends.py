# python3 tools/measure/chars_assets/bends.py: from gearsheet's trace.json, the elbow and knee bend (screen rad, mirrored to face right)
# reached in each traced frame, to set jointseam.py's ranges on what the game draws
import os, json, math
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')); os.chdir(ROOT)
T = json.load(open(os.environ.get('OUTD', 'frames/critic_chars_r2_assets/') + 'gear/trace.json'))
ang = lambda a, b: math.atan2(b[1] - a[1], b[0] - a[0])
w = lambda x: (x + math.pi) % (2 * math.pi) - math.pi
for cls, outs in T.items():
    E, K = [], []
    for o, views in outs.items():
        for v, j in views.items():
            f = (j.get('hero_view') or {}).get('face', [1])[0] if isinstance(j.get('hero_view'), dict) else 1
            for s in 'LR':
                if all(k + s in j for k in ('sh', 'elbow', 'hand')): E.append(w(ang(j['elbow' + s], j['hand' + s]) - ang(j['sh' + s], j['elbow' + s])))
                if all(k + s in j for k in ('hip', 'knee', 'ankle')): K.append(w(ang(j['knee' + s], j['ankle' + s]) - ang(j['hip' + s], j['knee' + s])))
    print(cls, 'elbow bend min %.2f max %.2f' % (min(E), max(E)), '| knee bend min %.2f max %.2f' % (min(K), max(K)), len(E))
