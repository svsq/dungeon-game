# set extra rig values in live/rigs.js: key=number, or key=atan2:x1,y1,x0,y0 (the angle from point 0 to point 1, rig px)
import sys, json, re, math
R = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip())); rg = R[sys.argv[1]]
for kv in sys.argv[2:]:
    k, v = kv.split('=', 1)
    if v.startswith('atan2:'): x1, y1, x0, y0 = map(float, v[6:].split(',')); rg[k] = round(math.atan2(y1 - y0, x1 - x0), 3)
    else: rg[k] = float(v)
    print(k, rg[k])
txt = 'window.RIGS = ' + json.dumps(R) + ';\n'; open('live/rigs.js', 'w').write(txt)
