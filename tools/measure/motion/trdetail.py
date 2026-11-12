# python3 tools/measure/motion/trdetail.py trace.json name joint [i0 i1] — per-frame joint position and step (px) over a frame range
import json, math, sys
T = json.load(open(sys.argv[1])); name, jn = sys.argv[2], sys.argv[3]
rows = T[name]['rows']; i0 = int(sys.argv[4]) if len(sys.argv) > 4 else 0; i1 = int(sys.argv[5]) if len(sys.argv) > 5 else len(rows) - 1
prev = None
for r in rows[i0:i1 + 1]:
    p = r['j'].get(jn)
    if not isinstance(p, list): continue
    d = math.hypot(p[0] - prev[0], p[1] - prev[1]) if prev else 0
    print(r['i'], [round(x, 1) for x in p[:2]], round(d, 1), ' '.join(r['ev'])); prev = p
