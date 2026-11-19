# the rows of light text in a box of a frame (luma > 170): where each line of text starts and ends, and the gaps between them
#   textrows.py <frame.png> <x0> <y0> <x1> <y1>
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('L'); x0, y0, x1, y1 = map(int, sys.argv[2:6])
rows = [y for y in range(y0, y1) if sum(im.getpixel((x, y)) > 170 for x in range(x0, x1)) > 3]
runs, s = [], None
for y in range(y0, y1 + 1):
    on = y in rows
    if on and s is None: s = y
    if not on and s is not None: runs.append((s, y - 1)); s = None
for i, (a, b) in enumerate(runs): print(f'line {a}–{b} ({b - a + 1} px)' + (f', gap {a - runs[i - 1][1] - 1} px' if i else ''))
