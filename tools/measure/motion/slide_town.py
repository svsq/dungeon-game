# python3 tools/measure/motion/slide_town.py pops_town.json — stance-foot slide of the walkers from the fixed-camera film (screen = world - cam, so the ankle's own motion is the foot's world motion):
# a foot is down while it is lifted less off its own ground than the other; slide = its mean world speed while down and the actor moves faster than 25 px/s (px/s; 0 = planted, actor speed = rides the body)
import json, math, sys
D = json.load(open(sys.argv[1]))['rows']
for n in ('porter4', 'mason10', 'child6'):
    sl = []; sp = []
    for a, b in zip(D, D[1:]):
        A, B = a['f'][n], b['f'][n]
        if B['spd'] < 25 or not A['j'].get('ankleL') or not B['j'].get('ankleL'): continue
        dt = b['t'] - a['t']
        # the foot down is the one lifted less off its own ground (groundL/R carry the step's depth): the lower ankle was the front foot
        # walking into the screen once a step projects its depth whole (TASKS 2136), a swinging foot counted as sliding at 50-70 px/s
        lift = lambda J, s: J['ground' + s][1] - J['ankle' + s][1]
        if not A['j'].get('groundL') or not B['j'].get('groundL'): continue
        s = 'L' if lift(A['j'], 'L') + lift(B['j'], 'L') < lift(A['j'], 'R') + lift(B['j'], 'R') else 'R'
        p, q = A['j']['ankle' + s], B['j']['ankle' + s]; sl.append(math.hypot(q[0] - p[0], q[1] - p[1]) / dt); sp.append(B['spd'])
    if sl: print(n, 'samples', len(sl), 'actor %.0f px/s' % (sum(sp) / len(sp)), 'stance foot world speed: mean %.1f, median %.1f, p90 %.1f px/s' % (sum(sl) / len(sl), sorted(sl)[len(sl) // 2], sorted(sl)[int(len(sl) * 0.9)]))
