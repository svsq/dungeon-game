# ref critic r5: the world hero (live game, 1:1 crop, stopped after a run right: the first second of a floor fades in dark) beside the small reference x2 (figure 40 px -> 80 px, the world's ~84 px), both
# then x3; and the same pair at the 36 px thumbnail size (both scaled to 36 px tall by box filter), the size of slots and the HUD
import os, numpy as np
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
D = os.path.join(ROOT, 'frames/critic_chars_r5_ref')
def fig(im, bg=None):
    a = np.asarray(im.convert('RGB')).astype(int); b = a[0, 0] if bg is None else bg; m = np.abs(a - b).sum(2) > 30; ys, xs = np.where(m); return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
rows = []
for c, ref, live in [('warrior', 'warrior_a_small_r4', 'live_warrior_stop_r'), ('archer', 'archer_a_small_r4', 'live_archer_stop_r'), ('mage', 'mage_a_small_orb_r4', 'live_mageorb_stop_r'), ('mage_noorb', 'mage_a_small_noorb_r4', 'live_mage_stop_r')]:
    r = Image.open(os.path.join(ROOT, 'art/char_refs', ref + '.png')).convert('RGBA'); bgc = Image.new('RGBA', r.size, (26, 26, 36, 255)); bgc.alpha_composite(r); r = bgc.convert('RGB')
    w = Image.open(os.path.join(D, 'grab', live + '.png')).convert('RGB').crop((25, 15, 115, 140))
    r2 = r.resize((128, 128), Image.NEAREST).crop((19, 0, 109, 125))
    pair = Image.new('RGB', (190, 125), (10, 10, 10)); pair.paste(r2, (0, 0)); pair.paste(w, (100, 0)); rows.append(pair.resize((570, 375), Image.NEAREST))
    s = 36 / 84; t = Image.new('RGB', (90, 60), (10, 10, 10)); t.paste(r.resize((int(64 * 36 / 40), int(64 * 36 / 40)), Image.BOX).crop((10, 5, 50, 55)), (0, 0)); t.paste(w.resize((int(90 * s), int(125 * s)), Image.BOX), (48, 0)); t.resize((360, 240), Image.NEAREST).save(os.path.join(D, f'pair36_{c}.png'))
W = Image.new('RGB', (570, 375 * len(rows))); [W.paste(p, (0, i * 375)) for i, p in enumerate(rows)]; W.save(os.path.join(D, 'pair84_all.png'))
