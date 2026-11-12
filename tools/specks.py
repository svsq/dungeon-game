# the codex's sheets of the magma monsters (TASKS 1937): the slivers left outside the silhouette, each under 2 % of the body's
# largest piece, go clear; rebuilds from art/old/specks/ so it can be re-run
import numpy as np; from PIL import Image; from scipy import ndimage as nd
for n in ['en_golem', 'en_salamander', 'en_colossus']:
    a = np.array(Image.open(f'art/old/specks/{n}.png').convert('RGBA')); lab, k = nd.label(a[..., 3] > 0, structure=np.ones((3, 3)))
    sz = np.bincount(lab.ravel()); sz[0] = 0; drop = (lab > 0) & (sz[lab] < 0.02 * sz.max())
    print(n, 'specks', int((sz[1:] < 0.02 * sz.max()).sum()), 'px', int(drop.sum())); a[drop, 3] = 0; Image.fromarray(a).save(f'art/gen/{n}.png')
