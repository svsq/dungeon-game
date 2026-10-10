# re-split a rigcut arm at its real elbow: the upper arm is the part inside a polygon (rig px), the forearm the rest
#   python3 tools/armsplit.py NAME L "x,y;x,y;..." ex,ey [R "..." ex,ey]
import sys, json, re; import numpy as np; from PIL import Image, ImageDraw
name, args = sys.argv[1], sys.argv[2:]
R = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip())); rg = R[name]
for i in range(0, len(args), 3):
    side, poly, el = args[i], [tuple(map(float, p.split(','))) for p in args[i + 1].split(';')], list(map(float, args[i + 2].split(',')))
    up = np.array(Image.open(f'art/gen/{name}__uarm{side}.png').convert('RGBA')); fo = np.array(Image.open(f'art/gen/{name}__farm{side}.png').convert('RGBA'))
    arm = np.where(up[..., 3:4] >= fo[..., 3:4], up, fo); msk = Image.new('L', (arm.shape[1], arm.shape[0])); ImageDraw.Draw(msk).polygon(poly, fill=255); m = np.array(msk) > 0
    u2 = arm.copy(); u2[~m, 3] = 0; f2 = arm.copy(); f2[m, 3] = 0
    Image.fromarray(u2).save(f'art/gen/{name}__uarm{side}.png'); Image.fromarray(f2).save(f'art/gen/{name}__farm{side}.png'); rg['elbow' + side] = el
    print(side, 'upper', int((u2[..., 3] > 0).sum()), 'fore', int((f2[..., 3] > 0).sum()))
txt = 'window.RIGS = ' + json.dumps(R) + ';\n'; open('live/rigs.js', 'w').write(txt)
