#!/usr/bin/env python3
"""backgear.py — the outfits' backs (hero__body_back_<sfx>) over a redrawn hero__body_back (TASKS 2011).

gear.py paints an outfit as one generation over a sheet of all the hero's parts, so redrawing only the back that way would repaint
every outfit's front, arms and legs too. Each outfit's back is instead its own generation over the new plain back (art/prompts/
hero_body_back_<sfx>.txt, the old outfit back as its design reference), placed on the rig by tools/fitback.py. Here it is nudged
onto the plain back's alpha (gear.fit), and, as gear.py does, it keeps only what the outfit changes: below the shoulders the cape,
belt and scabbard are the plain back's, and so is the head unless the outfit is a hood. Every back gets its headless twin (_nh).
usage: python3 tools/fitback.py && python3 tools/backgear.py"""
import numpy as np
from PIL import Image
from gear import HEAD, clean, fit

GEN = 'art/gen'
OUTFITS = ('cl', 'le', 'pw', 'hd')
HOOD = 'hd'            # the outfit that paints its own head
LOWER = 170            # rows from here down are the plain back's: the outfits differ only at the shoulders and neck

load = lambda n: np.array(Image.open(f'{GEN}/{n}.png').convert('RGBA')).astype(float)
save = lambda a, n: Image.fromarray(a.clip(0, 255).astype(np.uint8)).save(f'{GEN}/{n}.png')
headless = lambda a: np.concatenate([np.zeros_like(a[:HEAD['body_back']]), a[HEAD['body_back']:]])

if __name__ == '__main__':
    base = load('hero__body_back'); save(headless(base), 'hero__body_back_nh')
    for sfx in OUTFITS:
        iou, a = fit(load(f'hero__body_back_{sfx}'), base); a = clean(a)
        a[LOWER:] = base[LOWER:]
        if sfx != HOOD: a[:HEAD['body_back']] = base[:HEAD['body_back']]
        save(a, f'hero__body_back_{sfx}'); save(headless(a), f'hero__body_back_{sfx}_nh'); print(sfx, 'fit', round(iou, 3))
