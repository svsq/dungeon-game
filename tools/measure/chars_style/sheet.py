"""Contact sheet of PNG frames with labels: python3 tools/measure/chars_style/sheet.py OUT.png COLS IN1.png [IN2.png ...]
Paths are relative to the repo root (ROOT or three levels above this script); every tile is scaled to the first one's height by
nearest neighbour so pixel grids stay hard."""
import os
import sys
from PIL import Image, ImageDraw

ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
out, cols, ins = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
ims = [Image.open(os.path.join(ROOT, p)).convert('RGB') for p in ins]
H = ims[0].height
ims = [i if i.height == H else i.resize((max(1, round(i.width * H / i.height)), H), Image.NEAREST) for i in ims]
W = max(i.width for i in ims)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W, rows * (H + 16)), (34, 34, 34))
d = ImageDraw.Draw(sheet)
for k, (p, im) in enumerate(zip(ins, ims)):
    x, y = (k % cols) * W, (k // cols) * (H + 16)
    sheet.paste(im, (x, y + 16))
    d.text((x + 3, y + 2), os.path.basename(p), fill=(230, 230, 230))
sheet.save(os.path.join(ROOT, out))
