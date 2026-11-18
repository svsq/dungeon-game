# ref critic r5: contact sheets from grab_r5 crops: per class, the eight live run directions (rows) over the stride (columns) at x2
import sys, os
from PIL import Image, ImageDraw
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
D = os.path.join(ROOT, 'frames/critic_chars_r5_ref')
G = os.path.join(D, 'grab')
def sheet(rows, out, s=2):
    w = max(len(r[1]) for r in rows); W = Image.new('RGB', (60 + w * 140 * s, len(rows) * 150 * s), (20, 20, 20)); dr = ImageDraw.Draw(W)
    for y, (lab, fs) in enumerate(rows):
        dr.text((4, y * 150 * s + 10), lab, fill=(255, 255, 255))
        for x, f in enumerate(fs):
            p = os.path.join(G, f + '.png')
            if os.path.exists(p): W.paste(Image.open(p).convert('RGB').resize((140 * s, 150 * s), Image.NEAREST), (60 + x * 140 * s, y * 150 * s))
    W.save(os.path.join(D, out))
DIRS = ['r', 'dr', 'd', 'dl', 'l', 'ul', 'u', 'ur']
for c in ['warrior', 'archer', 'mage', 'mageorb']:
    sheet([(d, [f'live_{c}_run_{d}_{k}' for k in range(6)] + [f'live_{c}_stop_{d}']) for d in DIRS], f'sheet_run_{c}.png', 1)
    sheet([(a, [f'live_{c}_atk_{a}_{f}' for f in [3, 9, 16, 26, 38]]) for a in ['r', 'd', 'ul', 'l']] + [('hurt/death', [f'live_{c}_hurt_3', f'live_{c}_hurt_8'] + [f'live_{c}_death_{f}' for f in [5, 20, 45, 89]])], f'sheet_act_{c}.png', 1)
