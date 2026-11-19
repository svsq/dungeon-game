# python3 tools/measure/chars_assets/cells.py SHEET OUT "r,c r,c ..." [--box 480] [--crop x0,y0,x1,y1]: cells of a gearsheet side by side
import sys, os; from PIL import Image
a = sys.argv; S = Image.open(a[1]); B = int(a[a.index('--box') + 1]) if '--box' in a else 480
cr = tuple(map(int, a[a.index('--crop') + 1].split(','))) if '--crop' in a else (0, 0, B, B)
cells = [tuple(map(int, p.split(','))) for p in a[3].split()]
w, h = cr[2] - cr[0], cr[3] - cr[1]; O = Image.new('RGB', (w * len(cells), h))
for i, (r, c) in enumerate(cells): O.paste(S.crop((110 + c * B + cr[0], r * B + cr[1], 110 + c * B + cr[2], r * B + cr[3])), (i * w, 0))
os.makedirs(os.path.dirname(a[2]) or '.', exist_ok=True); O.save(a[2])
