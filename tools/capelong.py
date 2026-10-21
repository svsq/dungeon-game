#!/usr/bin/env python3
"""capelong.py — lengthen the hero's cape (painted into hero__body / hero__body_back) to mid-calf.
Front: the flap behind the torso moves out of hero__body into its own part hero__cape, drawn over the far arm (as painted) but
under the legs (a long cape inside the body would hang over them). Back: the cape stays in hero__body_back, which is drawn over the legs.
Each column of cloth below y0 is stretched down by EXT px while its bottom HEM rows keep their size, so the outline at the hem
stays as thick as the painter drew it. Reads the originals from art/old/capelong/ (saved there on the first run), so it can rerun.
usage: python3 tools/capelong.py"""
import os, shutil
import numpy as np
from PIL import Image, ImageDraw

EXT, HEM, OLD = 70, 5, 'art/old/capelong'
os.makedirs(OLD, exist_ok=True)
def src(n):
    if not os.path.exists(f'{OLD}/{n}.png'): shutil.copy(f'art/gen/{n}.png', f'{OLD}/{n}.png')
    return np.array(Image.open(f'{OLD}/{n}.png').convert('RGBA'))

def stretch(a, y0):
    out = a.copy(); out[y0:] = 0
    for x in range(a.shape[1]):
        ys = np.nonzero(a[y0:, x, 3] > 8)[0]
        if not len(ys): continue
        b = y0 + ys[-1] + 1; top = max(y0, b - HEM)
        n = top - y0 + EXT
        if n > 0 and top > y0: out[y0:y0 + n, x] = a[y0 + (np.arange(n) * (top - y0) / n).astype(int), x]
        out[top + EXT:b + EXT, x] = a[top:b, x]
    return out

def mask(shape, poly):
    m = Image.new('L', (shape[1], shape[0]), 0); ImageDraw.Draw(m).polygon(poly, fill=255); return np.array(m) > 0

body = src('hero__body')
flap = mask(body.shape, [(0, 78), (40, 78), (40, 124), (60, 124), (60, 242), (0, 242)])
cape = np.where(flap[..., None], body, 0).astype(np.uint8)
body[flap] = 0
Image.fromarray(body).save('art/gen/hero__body.png')
Image.fromarray(stretch(cape, 140)).save('art/gen/hero__cape.png')
Image.fromarray(stretch(src('hero__body_back'), 165)).save('art/gen/hero__body_back.png')
print('hero__body, hero__cape, hero__body_back written; originals in', OLD)
