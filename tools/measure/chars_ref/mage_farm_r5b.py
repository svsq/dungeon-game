# ref critic r5b, task 2204: the mage's far arm in the arch by layer (all / only uarmR / only farmR / only cuffR / only fistR), x8,
# for a few outfits and both weapons, so the eye sees what each part shows of the sleeve, the forearm and the cuff
import os, numpy as np
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
D = os.path.join(ROOT, os.environ.get('REF_FRAMES', 'frames/critic_chars_r5b_ref'), 'mage_arm')
O = os.path.join(ROOT, os.environ.get('REF_FRAMES', 'frames/critic_chars_r5b_ref'), 'z')
for n in ['arch_robe_none_staff', 'arch_robe_none_wand', 'arch_cloak_none_staff', 'arch_leather_armor_none_staff']:
    al = Image.open(os.path.join(D, f'{n}__all.png')).convert('RGB'); a = np.asarray(al).astype(int)
    no = np.asarray(Image.open(os.path.join(D, f'{n}__none.png')).convert('RGB')).astype(int)
    m = np.zeros(a.shape[:2], bool)
    for k in ['uarmR', 'farmR', 'cuffR', 'fistR']:
        m |= np.abs(np.asarray(Image.open(os.path.join(D, f'{n}__only_{k}.png')).convert('RGB')).astype(int) - no).sum(2) > 24
    ys, xs = np.where(m); box = (xs.min() - 30, ys.min() - 10, xs.max() + 10, ys.max() + 10)
    ims = [al.crop(box)] + [Image.open(os.path.join(D, f'{n}__{k}.png')).convert('RGB').crop(box) for k in ['only_uarmR', 'only_farmR', 'only_cuffR', 'no_body']]
    w, h = ims[0].size; s = 8; out = Image.new('RGB', ((w * s + 10) * len(ims), h * s), (255, 0, 255))
    for i, im in enumerate(ims): out.paste(im.resize((w * s, h * s), Image.NEAREST), (i * (w * s + 10), 0))
    out.save(os.path.join(O, f'z8_farm_{n}.png')); print(n, box)
