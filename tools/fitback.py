# fit art/gen/hero_body_back.png onto the hero rig canvas so it swaps 1:1 with hero__body: the same height (head top to hem),
# the pauldrons' midpoint on the rig's shoulder midpoint. The outfits' backs (art/gen/hero_body_back_<sfx>.png, TASKS 2011), painted
# over the plain one, take the plain one's placement, so tools/backgear.py only has to nudge them
import json, os, re; from PIL import Image; import numpy as np
from capelong import stretch
from gear import HEAD
R = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip()))['hero']
OUTFITS = ('cl', 'le', 'pw', 'hd')
# the cape's hem let down to mid-thigh, halfway from the hip to the knee (TASKS 2011): the front's height leaves it just under the hip,
# where the back read as a short slab; any longer and it hides the stride. Only the cloth below the shoulder blades stretches
CLOTH = 165
# the cape's crimson as saturated as the front's (herotone.py): painted a touch greyer, under the back view's shade it turned rose
# beside the front on a turn. Only the red cloth below the head: its green and blue are cut to this share
CAPE_GB = 0.35
def crimson(arr):
    r, g, b = arr[..., 0].astype(float), arr[..., 1].astype(float), arr[..., 2].astype(float); red = (arr[..., 3] > 0) & (r > 40) & (r > 1.8 * g) & (r > 1.8 * b); red[:HEAD['body_back']] = False
    arr[red, 1] = (g[red] * CAPE_GB).astype(np.uint8); arr[red, 2] = (b[red] * CAPE_GB).astype(np.uint8); return arr
op = lambda im: np.array(im)[:, :, 3] > 110
fy, fx = np.where(op(Image.open('art/gen/hero__body.png')))
im = Image.open('art/gen/hero_body_back.png').convert('RGBA'); a = op(im); ys, xs = np.where(a)
S = (fy.max() - fy.min()) / (ys.max() - ys.min())
band = range(ys.min() + int(0.15 * (ys.max() - ys.min())), ys.min() + int(0.35 * (ys.max() - ys.min())))
w = max(band, key=lambda y: np.ptp(np.where(a[y])[0])); row = np.where(a[w])[0]; mid = (row.min() + row.max()) / 2
ox = round((R['shL'][0] + R['shR'][0]) / 2 - mid * S); oy = round(fy.min() - ys.min() * S)

def place(im):
    small = im.resize((round(im.width * S), round(im.height * S)), Image.LANCZOS)
    out = Image.new('RGBA', (R['w'], R['h'])); out.alpha_composite(small, (max(0, ox), max(0, oy)), (max(0, -ox), max(0, -oy)))
    arr = np.array(out); arr[:, :, 3] = np.where(arr[:, :, 3] > 110, 255, 0); return arr

arr = place(im); hem = np.where(arr[:, :, 3].any(1))[0].max(); ext = max(0, round((R['hipL'][1] + R['kneeL'][1]) / 2) - hem)
Image.fromarray(crimson(stretch(arr, CLOTH, ext))).save('art/gen/hero__body_back.png')
for sfx in OUTFITS:
    p = f'art/gen/hero_body_back_{sfx}.png'
    if os.path.exists(p): Image.fromarray(crimson(stretch(place(Image.open(p).convert('RGBA')), CLOTH, ext))).save(f'art/gen/hero__body_back_{sfx}.png')
print('scale', round(S, 4), 'offset', ox, oy, 'hem', hem, '+', ext)
