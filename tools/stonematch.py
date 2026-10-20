# python3 tools/stonematch.py NAME... — scales a regenerated stone texture (art/gen/NAME.png) so its mean brightness matches the
# version it replaced (art/old/stone126/NAME.png): the biomes' light and grade were tuned on the old stone (TASKS 126)
import sys
import numpy as np
from PIL import Image
for n in sys.argv[1:]:
    old = np.asarray(Image.open(f'art/old/stone126/{n}.png').convert('RGB')).astype(float)
    im = Image.open(f'art/gen/{n}.png').convert('RGB'); new = np.asarray(im).astype(float)
    k = old.mean() / new.mean()
    Image.fromarray(np.clip(new * k, 0, 255).round().astype(np.uint8)).save(f'art/gen/{n}.png')
    print(f'{n}: ×{k:.3f}')
