# crops a box of a frame and blows it up with hard pixels: crop.py <in.png> <x0> <y0> <x1> <y1> <k> <out.png>
import sys
from PIL import Image
src, x0, y0, x1, y1, k, out = sys.argv[1], *map(int, sys.argv[2:7]), sys.argv[7]
im = Image.open(src).crop((x0, y0, x1, y1))
im.resize((im.width * k, im.height * k), Image.NEAREST).save(out)
