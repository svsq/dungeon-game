# stairsheet.py <shot log> <shot dir> <out.png>: crops 320x280 round each stairs point printed by stairs.js, 6 per row, 1:1
import sys, os, json
from PIL import Image, ImageDraw
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
p = lambda s: s if os.path.isabs(s) else os.path.join(ROOT, s)
log, d, out = map(p, sys.argv[1:4]); rows = []
for ln in open(log):
    n, _, js = ln.strip().partition(' ')
    if js.startswith('{'): rows.append((n, json.loads(js)))
W, H = 320, 280; cols = 6; S = Image.new('RGB', (cols * W, ((len(rows) + cols - 1) // cols) * (H + 14)), (40, 40, 40)); g = ImageDraw.Draw(S)
for i, (n, js) in enumerate(rows):
    im = Image.open(os.path.join(d, n + '.png')).convert('RGB'); x, y = js['at']
    c = im.crop((x - W // 2, y - H // 2 - 20, x + W // 2, y + H // 2 - 20)); X, Y = (i % cols) * W, (i // cols) * (H + 14)
    S.paste(c, (X, Y + 14)); g.text((X + 3, Y + 1), n, fill=(255, 255, 255))
S.save(out); print(out, S.size)
