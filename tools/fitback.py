# fit art/gen/hero_body_back.png onto the hero rig canvas (167×360) so it swaps 1:1 with hero__body
import sys; from PIL import Image; import numpy as np
S = float(sys.argv[1]) if len(sys.argv) > 1 else 0.2245
im = Image.open('art/gen/hero_body_back.png').convert('RGBA'); a = np.array(im)[:, :, 3]
ys, xs = np.where(a > 128); top = ys.min()
sh_mid_x, sh_y = 560, 480                       # shoulder sockets' midpoint in the generated image
small = im.resize((round(im.width * S), round(im.height * S)), Image.LANCZOS)
out = Image.new('RGBA', (167, 360)); ox = round(93.6 - sh_mid_x * S); oy = round(101 - sh_y * S)
out.alpha_composite(small, (max(0, ox), max(0, oy)), (max(0, -ox), max(0, -oy)))
arr = np.array(out); arr[:, :, 3] = np.where(arr[:, :, 3] > 110, 255, 0); Image.fromarray(arr).save('art/gen/hero__body_back.png')
print('offset', ox, oy, 'head top at', oy + top * S)
