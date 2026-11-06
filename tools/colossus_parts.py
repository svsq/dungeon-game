import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


root = Path('art/gen')
meta_path = Path('live/rigs.js')
rigs = json.loads(meta_path.read_text()[14:].rstrip(';\n'))
rig = rigs['colossus']
source = Image.open(root / 'colossus.png').convert('RGBA')
ys, xs = np.where(np.array(source)[..., 3] > 60)
source = source.crop((max(0, xs.min() - 3), max(0, ys.min() - 3), min(source.width, xs.max() + 4), min(source.height, ys.max() + 4)))
source = source.resize((rig['w'], rig['h']), Image.Resampling.LANCZOS)
pixels = np.array(source)
for side, polygon in (
    ('L', [(0, 96), (75, 96), (75, 106), (63, 110), (48, 113), (39, 109), (26, 114), (0, 113)]),
    ('R', [(187, 98), (253, 98), (253, 117), (220, 117), (214, 114), (207, 113), (198, 116), (188, 110)]),
):
    mask = Image.new('L', source.size)
    ImageDraw.Draw(mask).polygon(polygon, fill=255)
    mask = np.array(mask) > 0
    mantle = np.zeros_like(pixels); mantle[mask] = pixels[mask]
    Image.fromarray(mantle).save(root / f'colossus__mantle{side}.png')
    for name in ('body', 'uarm' + side, 'farm' + side):
        path = root / f'colossus__{name}.png'
        part = np.array(Image.open(path)); part[mask] = 0
        Image.fromarray(part).save(path)
    rig['mantle' + side] = rig['sh' + side]
    if 'mantle' + side not in rig['parts']: rig['parts'].append('mantle' + side)
body = np.array(Image.open(root / 'colossus__body.png'))
yy, xx = np.mgrid[:rig['h'], :rig['w']]
for side in ('L', 'R'):
    x, y = rig['sh' + side]
    fill = (np.hypot(xx - x, yy - y) < 14) & (body[..., 3] < 128)
    body[fill] = [28, 26, 27, 255]
mask = Image.new('L', source.size)
ImageDraw.Draw(mask).polygon([(116, 188), (137, 191), (143, 207), (141, 225), (132, 234), (119, 223)], fill=255)
mask = np.array(mask) > 0
body[mask] = pixels[mask]
Image.fromarray(body).save(root / 'colossus__body.png')
for name in ('thighL', 'thighR'):
    path = root / f'colossus__{name}.png'
    part = np.array(Image.open(path)); part[mask] = 0
    Image.fromarray(part).save(path)
rig['head'] = [135, 72]
meta_path.write_text('window.RIGS = ' + json.dumps(rigs) + ';\n')
