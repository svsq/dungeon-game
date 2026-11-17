# python3 tools/measure/chars_assets/gridhead.py: is a part's head painted on the world grid (RIG.h / 42 px cells)? For each body/head
# texture of the three heroes: the head box (rows above the neck) resampled to the grid and back (nearest, cell centres), the share of
# opaque pixels whose colour then moves by more than 24 (sum |dRGB|). ~0 = painted in cells; large = painted at texture resolution.
import os, glob, json, re; import numpy as np; from PIL import Image
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')); os.chdir(ROOT)
RG = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip()))
for rig in ['hero', 'archer', 'mage']:
    H = RG[rig]['h']; C = H / 42; neck = int(RG[rig]['head'][1] * 2.2)
    for f in sorted(glob.glob(f'live/assets/{rig}__body*.png') + glob.glob(f'live/assets/{rig}__head*.png')):
        a = np.array(Image.open(f).convert('RGBA')).astype(int)[:neck]; op = a[..., 3] > 128
        if op.sum() < 200: print(f'{os.path.basename(f):32s} no head'); continue
        yy, xx = np.mgrid[:a.shape[0], :a.shape[1]]
        cy = np.clip(((np.floor(yy / C) + 0.5) * C).astype(int), 0, a.shape[0] - 1); cx = np.clip(((np.floor(xx / C) + 0.5) * C).astype(int), 0, a.shape[1] - 1)
        b = a[cy, cx]; moved = (np.abs(a[..., :3] - b[..., :3]).sum(-1) > 24) & op
        print(f'{os.path.basename(f):32s} off-grid {moved.sum() / op.sum():.2f}  ({op.sum()} px)')
