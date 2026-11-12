# python3 tools/slategrade.py [NAME] [da] [db] [k] — re-tints a floor texture (art/old/slate1789/NAME.png → art/gen/NAME.png) toward
# a cool neutral slate: the torches' warm light adds about +7 a* and +9 b* in the frame, so the stone itself sits just below
# neutral for the lit floor to land on ref_dungeon's slate (a* ≈ 4, b* ≈ 7, C* ≈ 9; TASKS 1789). Lightness is kept
import sys
import numpy as np
from PIL import Image, ImageCms
n = sys.argv[1] if len(sys.argv) > 1 else 'floor_d_tex'
da, db, k = (float(v) for v in (sys.argv[2:5] if len(sys.argv) > 4 else (-4, -2, 0.5)))
fwd = ImageCms.buildTransformFromOpenProfiles(ImageCms.createProfile('sRGB'), ImageCms.createProfile('LAB'), 'RGB', 'LAB')
inv = ImageCms.buildTransformFromOpenProfiles(ImageCms.createProfile('LAB'), ImageCms.createProfile('sRGB'), 'LAB', 'RGB')
src = Image.open(f'art/old/slate1789/{n}.png').convert('RGBA')
X = np.asarray(ImageCms.applyTransform(src.convert('RGB'), fwd)).copy()
A = X[..., 1].view(np.int8).astype(float); B = X[..., 2].view(np.int8).astype(float)
X[..., 1] = np.clip(np.round(A * k + da), -128, 127).astype(np.int8).view(np.uint8)
X[..., 2] = np.clip(np.round(B * k + db), -128, 127).astype(np.int8).view(np.uint8)
out = ImageCms.applyTransform(Image.fromarray(X, 'LAB'), inv).convert('RGBA'); out.putalpha(src.getchannel('A'))
out.save(f'art/gen/{n}.png'); print(n, 'a*', da, 'b*', db, '×', k)
