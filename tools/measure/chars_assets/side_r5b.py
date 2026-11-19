# python3 tools/measure/chars_assets/side_r5b.py OUT x0 y0 x1 y1 Z name1 name2 ...: r5 (top) vs r5b (bottom) arch crops of gearsheet frames, xZ nearest
import sys; from PIL import Image
out, x0, y0, x1, y1, z = sys.argv[1], *map(int, sys.argv[2:7]); names = sys.argv[7:]
A, B = 'frames/critic_chars_r5_assets/gear/arch/', 'frames/critic_chars_r5b_assets/gear/arch/'
w, h = (x1 - x0) * z, (y1 - y0) * z; O = Image.new('RGB', (w * len(names) + 4 * (len(names) - 1), h * 2 + 4), (255, 0, 255))
for k, n in enumerate(names):
    for r, D in enumerate((A, B)):
        O.paste(Image.open(D + n + '.png').convert('RGB').crop((x0, y0, x1, y1)).resize((w, h), Image.NEAREST), (k * (w + 4), r * (h + 4)))
O.save(out)
