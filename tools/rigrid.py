# the approved sprite as rigcut will see it (trimmed, scaled to 320 px tall) with a rig-px grid: for drawing cut polygons
import sys; import numpy as np; from PIL import Image, ImageDraw
src, out, H, k = sys.argv[1], sys.argv[2], 320, 3
im = Image.open(src).convert('RGBA'); a = np.array(im)[..., 3]; ys, xs = np.where(a > 60)
im = im.crop((max(0, xs.min() - 3), max(0, ys.min() - 3), min(im.width, xs.max() + 4), min(im.height, ys.max() + 4)))
im = im.resize((max(1, round(im.width * H / im.height)), H), Image.LANCZOS); bg = Image.new('RGBA', im.size, (40, 40, 40, 255)); bg.alpha_composite(im)
big = bg.resize((im.width * k, H * k), Image.NEAREST); d = ImageDraw.Draw(big)
for x in range(0, im.width, 20): d.line([(x * k, 0), (x * k, H * k)], fill=(0, 255, 255)); d.text((x * k + 2, 2), str(x), fill=(0, 255, 255))
for y in range(0, H, 20): d.line([(0, y * k), (im.width * k, y * k)], fill=(0, 255, 255)); d.text((2, y * k + 2), str(y), fill=(0, 255, 255))
big.save(out); print(im.size)
