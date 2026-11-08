import json
import re
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as nd

src = np.array(Image.open('art/gen/serpent_parts_sheet.png').convert('RGBA'))
labels, count = nd.label(src[..., 3] > 120)
parts = sorted(range(1, count + 1), key=lambda i: np.count_nonzero(labels == i), reverse=True)[:2]
rig = {}
soft = json.loads(Path('art/softbones.json').read_text())
for name, label in zip(['body', 'tail'], parts):
    mask = labels == label
    ys, xs = np.where(mask)
    x0, y0 = max(0, int(xs.min()) - 24), max(0, int(ys.min()) - 24)
    x1, y1 = min(src.shape[1], int(xs.max()) + 25), min(src.shape[0], int(ys.max()) + 25)
    crop = src[y0:y1, x0:x1].copy()
    crop[..., 3] = np.where(mask[y0:y1, x0:x1], 255, 0)
    Image.fromarray(crop).save(f'art/gen/serpent__{name}.png')
    w, h = crop.shape[1], crop.shape[0]
    point = lambda p: [p[0] - x0, p[1] - y0]
    poly = [[0, 0], [w, 0], [w, h], [0, h]]
    if name == 'body':
        rig.update(w=w, h=h, base=point([400, 985]), snout=point([850, 445]), top=point([380, 48]), head=point([370, 406]))
        yy, xx = np.mgrid[y0:y1, x0:x1]
        plane = yy - (300 + (xx - 225) * 175 / 240)
        for part, selected in [('head', plane < 35), ('neckU', (plane > -35) & (yy < 705)), ('neckL', yy > 595)]:
            piece = crop.copy()
            piece[~selected, 3] = 0
            Image.fromarray(piece).save(f'art/gen/serpent__{part}.png')
        bones = [
            dict(poly=poly, root=point([330, 650]), tip=point([400, 260]), t0=0, t1=0.55, feather=4),
            dict(poly=poly, root=point([400, 985]), tip=point([330, 400]), t0=0, t1=0.5, feather=4),
            dict(poly=[point(p) for p in [[200, 20], [920, 20], [920, 560], [470, 550], [290, 320]]], root=point([410, 330]), tip=point([850, 445]), t0=0, t1=0.35, feather=4)
        ]
    else:
        rig['tail'] = dict(w=w, h=h, base=point([780, 975]), tip=point([1490, 835]))
        bones = [dict(poly=poly, root=point([780, 975]), tip=point([1220, 800]), t0=0.05, t1=0.8, feather=4)]
    soft[f'serpent__{name}'] = dict(bones=bones)
path = Path('art/softbones.json')
text = re.sub(r',\n  "serpent__body":.*\n\}\s*$', '\n}', path.read_text(), flags=re.S).rstrip()[:-1].rstrip()
for name in ['serpent__body', 'serpent__tail']:
    text += ',\n  ' + json.dumps(name) + ': ' + json.dumps(soft[name])
path.write_text(text + '\n}\n')
path = Path('live/rigs.js')
rigs = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', path.read_text().strip()))
rigs['serpent'] = rig
path.write_text('window.RIGS = ' + json.dumps(rigs) + ';\n')
print(json.dumps(rig))
