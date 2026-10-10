# tint every part of a rig differently and mark its joints: a check that a cut follows the anatomy
import sys, json, re; import numpy as np; from PIL import Image, ImageDraw
name, out = sys.argv[1], sys.argv[2]; R = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip()))[name]
cols = [(255, 80, 80), (80, 255, 80), (80, 120, 255), (255, 220, 60), (255, 80, 255), (60, 230, 230), (255, 150, 60), (160, 100, 255), (150, 255, 150), (255, 255, 255), (120, 60, 0)]
base = None
for i, p in enumerate(R['parts']):
    a = np.array(Image.open(f'art/gen/{name}__{p}.png').convert('RGBA')).astype(float)
    if base is None: base = np.zeros_like(a); base[..., 3] = 255; base[..., :3] = 40
    m = a[..., 3:4] / 255; c = np.array(cols[i % len(cols)], float); base[..., :3] = base[..., :3] * (1 - m) + (a[..., :3] * 0.5 + c * 0.5) * m
im = Image.fromarray(base.astype(np.uint8)).resize((R['w'] * 3, R['h'] * 3), Image.NEAREST); d = ImageDraw.Draw(im)
for k, v in R.items():
    if isinstance(v, list) and len(v) == 2 and all(isinstance(q, (int, float)) for q in v): d.ellipse([v[0] * 3 - 5, v[1] * 3 - 5, v[0] * 3 + 5, v[1] * 3 + 5], outline=(255, 255, 255)); d.text((v[0] * 3 + 6, v[1] * 3 - 6), k, fill=(255, 255, 255))
im.save(out); print(R['parts'])
