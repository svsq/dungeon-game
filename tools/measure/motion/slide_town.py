# python3 tools/measure/motion/slide_town.py pops_town.json — stance-foot slide of the walkers from the fixed-camera film (screen = world - cam, so the ankle's own motion is the foot's world motion):
# a foot is down while its ankle is the lower of the two; slide = its mean world speed while down and the actor moves faster than 25 px/s (px/s; 0 = planted, actor speed = rides the body)
import json, math, sys
D = json.load(open(sys.argv[1]))['rows']
for n in ('porter4', 'mason10', 'child6'):
    sl = []; sp = []
    for a, b in zip(D, D[1:]):
        A, B = a['f'][n], b['f'][n]
        if B['spd'] < 25 or not A['j'].get('ankleL') or not B['j'].get('ankleL'): continue
        dt = b['t'] - a['t']
        for s, o in (('L', 'R'), ('R', 'L')):
            if A['j']['ankle' + s][1] > A['j']['ankle' + o][1] and B['j']['ankle' + s][1] > B['j']['ankle' + o][1]:
                p, q = A['j']['ankle' + s], B['j']['ankle' + s]; sl.append(math.hypot(q[0] - p[0], q[1] - p[1]) / dt); sp.append(B['spd'])
    if sl: print(n, 'samples', len(sl), 'actor %.0f px/s' % (sum(sp) / len(sp)), 'stance foot world speed: mean %.1f, median %.1f, p90 %.1f px/s' % (sum(sl) / len(sl), sorted(sl)[len(sl) // 2], sorted(sl)[int(len(sl) * 0.9)]))
