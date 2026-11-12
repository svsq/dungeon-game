# python3 tools/measure/motion/rigsum.py [report.json] — magma rig rows and warns from a qa.mjs report, one line each
import json, os, re, sys
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
rep = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'frames/qa/report.json')
r = json.load(open(rep))
pat = re.compile(r'imp|golem|salam|colos|ember|fire_priest|magma|lava|vent|crust|amble')
keys = ['H', 'slide', 'ground', 'lift', 'limp', 'bob', 'stride', 'pop', 'pops', 'kneeL', 'kneeR', 'stretchL', 'stretchR', 'armL', 'armR', 'rigidRes', 'move']
for k, v in r['rig'].items():
    if not pat.search(k): continue
    if isinstance(v, dict):
        print(k, ' '.join(f'{a}={v[a]}' for a in v if not isinstance(v[a], (dict, list))) [:400])
print('--- warns')
for w in r['warns']:
    if pat.search(str(w)): print(str(w)[:300])
print('--- fails', r['fails'])
