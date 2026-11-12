# python3 tools/measure/motion/trsum.py trace.json — per transition: largest per-frame joint step (px), entity speed at the start, lowest hip-over-ankle gap, knee below ankle frames
import json, math, sys
T = json.load(open(sys.argv[1]))
for name, v in T.items():
    if not v: print(name, 'none'); continue
    rows = v['rows']; best = (0, None, None); prev = None
    hipgap = None; kneelow = 0
    for r in rows:
        j = r['j']
        if prev:
            for k, p in j.items():
                q = prev.get(k)
                if isinstance(p, list) and isinstance(q, list) and len(p) >= 2 and len(q) >= 2:
                    d = math.hypot(p[0] - q[0], p[1] - q[1])
                    if d > best[0]: best = (d, k, r['i'])
        a = [j.get(k) for k in ('ankleL', 'ankleR') if isinstance(j.get(k), list)]
        if isinstance(j.get('hip'), list) and a:
            g = min(x[1] for x in a) - j['hip'][1]; hipgap = g if hipgap is None else min(hipgap, g)
        for s in 'LR':
            kn, an = j.get('knee' + s), j.get('ankle' + s)
            if isinstance(kn, list) and isinstance(an, list) and kn[1] > an[1] + 2: kneelow += 1
        prev = j
    e0 = rows[0]['e'] if rows else {}
    sp = [round(math.hypot(r['e'].get('vx', 0), r['e'].get('vy', 0)), 1) for r in rows[:30]]
    print(f"{name}: n={len(rows)} maxstep={best[0]:.1f}px {best[1]}@{best[2]} hipOverAnkleMin={hipgap if hipgap is None else round(hipgap,1)} kneeBelowAnkle={kneelow} speed0-30max={max(sp) if sp else '-'}")
