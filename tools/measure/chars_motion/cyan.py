# python3 tools/measure/chars_motion/cyan.py <sheet.png>... : bright cyan pixels (staff crystal, orb) per tile of a qashot sheet (6 columns)
import sys
from PIL import Image
for f in sys.argv[1:]:
    im = Image.open(f).convert('RGB'); W, H = im.size; tw = W // 6; rows = round(H / tw); px = im.load(); out = []
    for r in range(rows):
        for c in range(6):
            n = 0
            for y in range(r * tw, (r + 1) * tw, 3):
                for x in range(c * tw, (c + 1) * tw, 3):
                    R, G, B = px[x, y]
                    if B > 180 and G > 140 and R < 140 and B - R > 80: n += 1
            out.append(n)
    m = max(out) or 1
    print(f.split('/')[-1].ljust(30), ' '.join(f'{v:4d}' for v in out), f' min/max {min(out) / m:.2f}')
