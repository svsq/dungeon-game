# python3 tools/measure/motion/footslide.py film_walk.json — foot slide of each walker from the film's ankle joints at 1/12 s (screen zoom 1 = world px): ankle world = actor + (ankle - ground);
# a foot is on the ground while its ankle is the lower one (larger screen y); slide = its world speed then, px/s (0 = planted, the actor's speed = it rides the body)
import json, math, sys
D = json.load(open(sys.argv[1]))['rows']
for role in ('porter', 'mason', 'child'):
    R = D[role]; dt = R[1]['t'] - R[0]['t']; v = sum(math.hypot(r['vx'], r['vy']) for r in R) / len(R); out = []
    for k in range(len(R) - 1):
        a, b = R[k], R[k + 1]
        for s in 'LR':
            o = 'R' if s == 'L' else 'L'
            wa = (a['x'] + a['j']['ankle' + s][0] - a['j']['ground'][0], a['y'] + a['j']['ankle' + s][1] - a['j']['ground'][1]); wb = (b['x'] + b['j']['ankle' + s][0] - b['j']['ground'][0], b['y'] + b['j']['ankle' + s][1] - b['j']['ground'][1])
            lower = a['j']['ankle' + s][1] > a['j']['ankle' + o][1] and b['j']['ankle' + s][1] > b['j']['ankle' + o][1]
            if lower: out.append(math.hypot(wb[0] - wa[0], wb[1] - wa[1]) / dt)
    print(role, 'actor speed %.0f px/s' % v, 'stance-foot world speed: mean %.0f, max %.0f over %d steps' % (sum(out) / len(out), max(out), len(out)), [round(x) for x in out])
