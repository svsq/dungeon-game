# cut pieces out of a rig's body into their own parts (same canvas): ears that swing on a spring, a skull that rolls away
#   python3 tools/partcut.py NAME "PART:x,y;x,y;...|px,py" ...   (polygon and root pivot in rig px)
# the root stays painted on the body too: the piece turns over it without opening a gap
import json, re, sys; import numpy as np; from PIL import Image, ImageDraw
name = sys.argv[1]; rp = 'live/rigs.js'
R = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open(rp).read().strip())); RG = R[name]
B = np.array(Image.open(f'art/gen/{name}__body.png').convert('RGBA'))
for arg in sys.argv[2:]:
    part, rest = arg.split(':', 1); poly, piv = rest.split('|')
    poly = [tuple(map(float, p.split(','))) for p in poly.split(';')]; px, py = map(float, piv.split(','))
    msk = Image.new('L', (B.shape[1], B.shape[0])); ImageDraw.Draw(msk).polygon(poly, fill=255); m = np.array(msk) > 0
    E = np.zeros_like(B); E[m] = B[m]; Image.fromarray(E).save(f'art/gen/{name}__{part}.png')
    yy, xx = np.mgrid[:B.shape[0], :B.shape[1]]; keep = np.hypot(xx - px, yy - py) < 7
    B[m & ~keep, 3] = 0
    ey, ex = np.nonzero(E[..., 3] > 60); far = np.argmax(np.hypot(ex - px, ey - py))
    RG[part] = [px, py]; RG[part + 'Tip'] = [float(ex[far]), float(ey[far])]; print(part, int((E[..., 3] > 0).sum()), 'px, root', (px, py))
    if part not in RG['parts']: RG['parts'] = sorted(RG['parts'] + [part])
Image.fromarray(B).save(f'art/gen/{name}__body.png')
txt = 'window.RIGS = ' + json.dumps(R) + ';\n'; open(rp, 'w').write(txt)
