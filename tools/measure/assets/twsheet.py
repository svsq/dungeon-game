# twsheet.py [out] [names...]: town assets at play size. Each live/assets source is cut to its art grid (view height from live/sizes.js / PIX 2,
# box filter as the low-res target samples it), shown x4 nearest on mid-grey and on the town floor, with the name and the art size.
# Default set: every *_tw*, altar, chest. Out: frames/critic_r8_assets/twsheet.png
import os, re, sys, glob
from PIL import Image, ImageDraw
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
A = os.path.join(ROOT, 'live', 'assets')
src = open(os.path.join(ROOT, 'live', 'sizes.js')).read()
H = {m.group(1): float(m.group(2)) for m in re.finditer(r'\b([a-z_0-9]+):\s*([0-9.]+)', src)}
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'frames', 'critic_r8_assets', 'twsheet.png')
names = sys.argv[2:] or sorted(os.path.basename(p)[:-4] for p in glob.glob(os.path.join(A, '*_tw*.png')) if 'tex' not in p) + ['altar', 'chest']
K, PIX = 4, 2
floor = Image.open(os.path.join(A, 'floor_tw_tex.png')).convert('RGBA')
floor = floor.resize((floor.width // 8, floor.height // 8), Image.BOX)
cells = []
for n in names:
    im = Image.open(os.path.join(A, n + '.png')).convert('RGBA')
    vh = H.get(n, im.height / 4); ah = max(1, round(vh / PIX)); aw = max(1, round(im.width * ah / im.height))
    sm = im.resize((aw, ah), Image.BOX).resize((aw * K, ah * K), Image.NEAREST)
    cells.append((n, sm, aw, ah))
cw = max(c[1].width for c in cells) * 2 + 24; ch = max(c[1].height for c in cells) + 28
cols = max(1, 2400 // cw); rows = (len(cells) + cols - 1) // cols
sheet = Image.new('RGBA', (cols * cw, rows * ch), (40, 40, 40, 255)); d = ImageDraw.Draw(sheet)
for i, (n, sm, aw, ah) in enumerate(cells):
    x, y = (i % cols) * cw, (i // cols) * ch
    g = Image.new('RGBA', sm.size, (128, 128, 128, 255)); g.alpha_composite(sm)
    f = Image.new('RGBA', sm.size); fl = floor.resize((floor.width * K, floor.height * K), Image.NEAREST)
    for yy in range(0, sm.height, fl.height):
        for xx in range(0, sm.width, fl.width): f.paste(fl, (xx, yy))
    f.alpha_composite(sm)
    sheet.paste(g, (x + 4, y + 22)); sheet.paste(f, (x + 12 + sm.width, y + 22))
    d.text((x + 4, y + 4), f'{n} {aw}x{ah}', fill=(230, 230, 230, 255))
os.makedirs(os.path.dirname(out), exist_ok=True); sheet.convert('RGB').save(out); print(out, sheet.size, len(cells))
