import json, sys
from PIL import Image, ImageDraw
D = 'frames/pose_ref_2160/game/'
J = json.load(open(D + 'joints.json'))

def scr(r, p):
    if r.get('pre'):
        x, y, k = r['pre']; p = [x + (p[0] - x) * k, y + (p[1] - y) * k]
    return [p[0] - r['box'][0], p[1] - r['box'][1]]

for n in sys.argv[1:]:
    r = J[n]; im = Image.open(D + n + '_all.png').convert('RGB'); z = 2 if r.get('pre') else 4
    im = im.resize((im.width * z, im.height * z), Image.NEAREST); d = ImageDraw.Draw(im)
    for s, col in (('L', (0, 255, 255)), ('R', (255, 255, 0))):
        for chain in (('sh', 'elbow', 'hand'), ('hip', 'knee', 'ankle', 'toe')):
            pts = [tuple(v * z for v in scr(r, r['joints'][c + s])) for c in chain if c + s in r['joints']]
            d.line(pts, fill=col, width=2)
            for q in pts: d.ellipse((q[0] - 3, q[1] - 3, q[0] + 3, q[1] + 3), outline=col)
    im.save(D + n + '_joints.png')
