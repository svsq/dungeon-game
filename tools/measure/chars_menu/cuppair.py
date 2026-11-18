# the mage's orb hand in the arch beside mage_a_v4's at the same scale (the hero's height in both), hard pixels k×:
#   cuppair.py <arch.png> <out.png> [k]
import sys
import os
import numpy as np
from PIL import Image
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
arch, out, k = sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 8
ref = Image.open(os.path.join(ROOT, 'art/char_refs/mage_a_v4.png')).convert('RGB')
r = np.asarray(ref).astype(int)
fg = (np.abs(r - r[5, 5]).sum(2) > 40)[:, :740]
ys = np.nonzero(fg.any(1))[0]
ref_h = ys.max() - ys.min()
a = Image.open(arch).convert('RGB')
game_h = 745 - 467
s = game_h / ref_h
small = ref.resize((round(ref.width * s), round(ref.height * s)), Image.BOX)
hx, hy = round(600 * s), round(395 * s)
w = h = 60
R = small.crop((hx - w // 2, hy - h // 2, hx + w // 2, hy + h // 2)).resize((w * k, h * k), Image.NEAREST)
G = a.crop((815, 535, 815 + w, 535 + h)).resize((w * k, h * k), Image.NEAREST)
o = Image.new('RGB', (w * k * 2 + 8, h * k), (20, 20, 20)); o.paste(G, (0, 0)); o.paste(R, (w * k + 8, 0)); o.save(out)
print(f'ref height {ref_h} px, arch {game_h} px, scale {s:.3f}')
