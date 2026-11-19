"""ref critic r2: an image with a labelled coordinate grid, to read reference landmarks by eye.
   python3 tools/measure/chars_ref/grid.py <in.png> <out.png> [step] [scale]"""
import sys
from PIL import Image, ImageDraw

src, dst = sys.argv[1], sys.argv[2]
step = int(sys.argv[3]) if len(sys.argv) > 3 else 50
k = float(sys.argv[4]) if len(sys.argv) > 4 else 1
im = Image.open(src).convert('RGB')
im = im.resize((round(im.width * k), round(im.height * k)), Image.NEAREST)
d = ImageDraw.Draw(im)
for x in range(0, round(im.width / k), step):
    d.line([(x * k, 0), (x * k, im.height)], fill=(0, 255, 120) if x % (step * 2) == 0 else (0, 140, 70), width=1)
    d.text((x * k + 2, 2), str(x), fill=(255, 255, 0))
for y in range(0, round(im.height / k), step):
    d.line([(0, y * k), (im.width, y * k)], fill=(0, 255, 120) if y % (step * 2) == 0 else (0, 140, 70), width=1)
    d.text((2, y * k + 2), str(y), fill=(255, 255, 0))
im.save(dst)
