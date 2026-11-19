# ref critic r5b, task 2203: the near torso side of the warrior and the archer in the arch, by layer (all / no cape / only body /
# only cape), x6, plus the reference sheet's side at the same figure height, so the eye sees which layer paints each pixel under the arm
import os, sys, numpy as np
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
D = os.path.join(ROOT, os.environ.get('REF_FRAMES', 'frames/critic_chars_r5b_ref'))
BOX = (196, 205, 290, 350)
for c in ['warrior', 'archer']:
    for t in ['0.01', '1.2', '2.4']:
        ims = [Image.open(os.path.join(D, f'layers/arch_{c}_t{t}__{k}.png')).convert('RGB').crop(BOX) for k in ['all', 'no_cape', 'only_body', 'only_cape']]
        w, h = ims[0].size; s = 6; out = Image.new('RGB', (w * s * 4 + 30, h * s), (255, 0, 255))
        for i, im in enumerate(ims): out.paste(im.resize((w * s, h * s), Image.NEAREST), (i * (w * s + 10), 0))
        out.save(os.path.join(D, f'z/z6_side_layers_{c}_t{t}.png'))
