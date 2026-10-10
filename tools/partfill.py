# fill a hole in a part (inside a polygon, rig px) from its nearest own pixels, darkened: the area another part used to cover
#   python3 tools/partfill.py NAME PART "x,y;x,y;..."
import sys; import numpy as np; from PIL import Image, ImageDraw; from scipy import ndimage as nd
name, part, poly = sys.argv[1], sys.argv[2], [tuple(map(float, p.split(','))) for p in sys.argv[3].split(';')]
P = np.array(Image.open(f'art/gen/{name}__{part}.png').convert('RGBA')); msk = Image.new('L', (P.shape[1], P.shape[0])); ImageDraw.Draw(msk).polygon(poly, fill=255)
hole = (np.array(msk) > 0) & (P[..., 3] < 128); src = P[..., 3] >= 128
_, (iy, ix) = nd.distance_transform_edt(~src, return_indices=True)
fill = P[iy, ix].astype(float); fill[..., :3] = nd.uniform_filter(fill[..., :3], size=(5, 5, 1)) * 0.82; fill[..., 3] = 255
P[hole] = fill[hole].astype(np.uint8); Image.fromarray(P).save(f'art/gen/{name}__{part}.png'); print(part, 'filled', int(hole.sum()), 'px')
