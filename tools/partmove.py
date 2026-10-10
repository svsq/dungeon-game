# move the pixels inside a polygon (rig px) from some parts into another: a hand drawn over a thigh that rigcut gave the leg
#   python3 tools/partmove.py NAME TO "x,y;x,y;..." FROM1 [FROM2 ...]
import sys; import numpy as np; from PIL import Image, ImageDraw
name, to, poly, frm = sys.argv[1], sys.argv[2], [tuple(map(float, p.split(','))) for p in sys.argv[3].split(';')], sys.argv[4:]
T = np.array(Image.open(f'art/gen/{name}__{to}.png').convert('RGBA')); msk = Image.new('L', (T.shape[1], T.shape[0])); ImageDraw.Draw(msk).polygon(poly, fill=255); m = np.array(msk) > 0
for f in frm:
    F = np.array(Image.open(f'art/gen/{name}__{f}.png').convert('RGBA')); mv = m & (F[..., 3] > T[..., 3])
    T[mv] = F[mv]; F[m, 3] = 0; Image.fromarray(F).save(f'art/gen/{name}__{f}.png'); print(f, '→', to, int(mv.sum()), 'px')
Image.fromarray(T).save(f'art/gen/{name}__{to}.png')
