# python3 tools/measure/motion/poptown.py pops_town.json — the whole town at 1/60 s: per actor the largest joint step in the actor's own frame (joint - ground), the frame where it happens, whether its facing flipped there; and the root's step beyond speed/60
import json, math, sys
D = json.load(open(sys.argv[1]))['rows']
names = list(D[0]['f'].keys())
for n in names:
    best = []; root = 0; rootAt = 0
    for a, b in zip(D, D[1:]):
        A, B = a['f'][n], b['f'][n]
        if not A['j'] or not B['j']: continue
        ga, gb = A['j'].get('ground'), B['j'].get('ground')
        if ga and gb:
            dr = math.hypot(gb[0] - ga[0], gb[1] - ga[1]) - B['spd'] / 60
            if dr > root: root, rootAt = dr, b['t']
        for k, p in B['j'].items():
            q = A['j'].get(k)
            if k == 'ground' or not q or not ga or not gb: continue
            d = math.hypot((p[0] - gb[0]) - (q[0] - ga[0]), (p[1] - gb[1]) - (q[1] - ga[1]))
            best.append((d, k, b['t'], A['face'] != B['face']))
    best.sort(reverse=True)
    print(n, 'root excess step %.1f px at %.2f' % (root, rootAt), '| top joint steps:', ['%.1f %s@%.2f%s' % (d, k, t, ' FLIP' if fl else '') for d, k, t, fl in best[:4]])
cart = [(r['t'], r['c']) for r in D if r['c']]
print('cart rows', len(cart))
