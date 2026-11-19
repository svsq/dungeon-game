# python3 tools/measure/motion/sheetgrid.py OUT.png COLS IN1.png IN2.png ... — pastes images into a grid with the file stem written on each
import sys
from PIL import Image, ImageDraw
out, cols, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
ims = [Image.open(f).convert('RGB') for f in files]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (cols * w, rows * h), (30, 30, 30))
d = ImageDraw.Draw(S)
for i, (im, f) in enumerate(zip(ims, files)):
    x, y = (i % cols) * w, (i // cols) * h
    S.paste(im, (x, y)); d.text((x + 4, y + 4), f.split('/')[-1][:-4], fill=(255, 255, 0))
S.save(out)
