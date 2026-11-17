"""ref critic r2: the rig's traced bones drawn over the arch hero (cyan = L, the cape side; yellow = R, the weapon side).
   python3 tools/measure/chars_ref/overlay.py [frames/critic_chars_r2_ref]"""
import json, os, sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(os.environ.get('ROOT', Path(__file__).resolve().parents[3]))
OUT = ROOT / (sys.argv[1] if len(sys.argv) > 1 else 'frames/critic_chars_r2_ref')
J = json.load(open(OUT / 'game/joints.json'))
tiles = []
for c in ['warrior', 'archer', 'mage']:
    r = J['arch_' + c]; j = r['joints']; bx, by = r['box'][:2]; ax, ay, k = r['at']
    im = Image.open(OUT / f'game/arch_{c}_all.png').convert('RGB'); d = ImageDraw.Draw(im)
    P = lambda n: (ax + (j[n][0] - ax) * k - bx, ay + (j[n][1] - ay) * k - by)
    for s, col in [('L', (0, 255, 255)), ('R', (255, 230, 0))]:
        for a, b in [('sh', 'elbow'), ('elbow', 'hand'), ('hip', 'knee'), ('knee', 'ankle'), ('heel', 'toe')]:
            d.line([P(a + s), P(b + s)], fill=col, width=2)
    tiles.append(im.crop((180, 150, 480, 460)))
S = Image.new('RGB', (sum(t.width for t in tiles), tiles[0].height))
for i, t in enumerate(tiles):
    S.paste(t, (i * t.width, 0))
S.resize((S.width * 2, S.height * 2), Image.NEAREST).save(OUT / 'arch_bones.png')
