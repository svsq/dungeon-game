import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage


ROOT = Path(__file__).resolve().parent.parent
NAMES = ('table_candles', 'bones', 'candles', 'vase_a', 'vase_b', 'vase_c', 'shop_gems', 'shop_scales', 'padlock',
         # generated at 1024 for 30-50 px on screen: their art pixel was finer than the world's grid (TASKS 230, 234)
         'queen_crown', 'spider_eggs', 'water_basin', 'water_spout', 'water_grate', 'water_drain', 'water_stone_a', 'water_stone_b',
         # the cave's water props, drawn finer than the world's grid too (TASKS 327)
         'lily_cv', 'weed_cv', 'ford_a', 'ford_b')
UP = 4
INK = '#060506'
PALETTES = {
    'table_candles': ['#060506', '#231010', '#36120f', '#552f25', '#733a21', '#934218', '#3e3234', '#6b5c56', '#c8b89a', '#eed68a'],
    'bones': ['#060506', '#231010', '#3e3234', '#6b5c56', '#c8b89a', '#eed68a'],
    'candles': ['#060506', '#3e3234', '#6b5c56', '#c8b89a', '#eed68a'],
    'vase_c': ['#060506', '#231010', '#36120f', '#1a4135', '#3e3234', '#6b5c56', '#9f5116', '#e2881e', '#f9ce4a', '#c8b89a'],
    'shop_gems': ['#060506', '#231010', '#c8b89a', '#eed68a', '#9f5116', '#e2881e', '#f9ce4a', '#73140d', '#f03604', '#1a4135', '#52c04f', '#64bdea'],
    'shop_scales': ['#060506', '#231010', '#36120f', '#552f25', '#733a21', '#9f5116', '#e2881e', '#f9ce4a', '#c8b89a'],
    'padlock': ['#060506', '#141420', '#252534', '#3e3234', '#6b5c56', '#c8b89a', '#9f5116', '#e2881e'],
    'queen_crown': ['#060506', '#141420', '#2a202f', '#51384e', '#895e54', '#c8b89a', '#64bdea'],
    'spider_eggs': ['#060506', '#1d131f', '#2a202f', '#5f3d60', '#a47f84', '#c8b89a'],
    'water_basin': ['#060506', '#141420', '#252534', '#3e3234', '#6b5c56', '#c8b89a', '#1a4135', '#0f2a2e'],
    'water_spout': ['#060506', '#141420', '#252534', '#3e3234', '#6b5c56', '#c8b89a', '#1a4135'],
    'water_grate': ['#060506', '#141420', '#252534', '#3e3234', '#6b5c56', '#c8b89a', '#552f25', '#733a21', '#1a4135'],
    'water_drain': ['#060506', '#141420', '#252534', '#3e3234', '#6b5c56', '#c8b89a', '#552f25', '#733a21', '#1a4135'],
    'water_stone_a': ['#060506', '#141420', '#252534', '#3e3234', '#6b5c56', '#c8b89a', '#1a4135'],
    'water_stone_b': ['#060506', '#141420', '#252534', '#3e3234', '#6b5c56', '#c8b89a', '#1a4135'],
    'lily_cv': ['#060506', '#0f2a2e', '#1a4135', '#52c04f', '#c8b89a'],
    'weed_cv': ['#060506', '#0f2a2e', '#1a4135', '#52c04f'],
    'ford_a': ['#060506', '#141420', '#252534', '#3e3234', '#6b5c56', '#c8b89a', '#1a4135'],
    'ford_b': ['#060506', '#141420', '#252534', '#3e3234', '#6b5c56', '#c8b89a', '#1a4135'],
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def lab(rgb):
    c = np.asarray(rgb, float) / 255
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]])
    m2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099], [0.0259040371, 0.7827717662, -0.8086757660]])
    return np.cbrt(c @ m1.T) @ m2.T


def hex_rgb(value):
    return [int(value[i:i + 2], 16) for i in (1, 3, 5)]


def reduce_bones(im):
    mask = Image.new('L', im.size)
    draw = ImageDraw.Draw(mask)
    for polygon in [
        [(128, 80), (143, 47), (177, 14), (202, 3), (237, 9), (270, 37), (283, 69), (274, 101), (253, 124), (232, 151), (169, 148), (143, 119), (130, 108)],
        [(53, 82), (64, 69), (80, 71), (92, 88), (89, 103), (125, 170), (143, 181), (143, 199), (128, 215), (108, 215), (96, 204), (97, 190), (63, 117), (53, 104)],
        [(9, 152), (23, 139), (41, 138), (52, 149), (57, 160), (100, 180), (112, 174), (128, 182), (128, 199), (116, 215), (98, 212), (89, 202), (40, 182), (25, 182), (9, 172)],
        [(199, 167), (212, 156), (229, 159), (236, 172), (289, 199), (304, 195), (320, 207), (322, 223), (309, 238), (291, 237), (282, 224), (222, 194), (205, 194), (194, 181)],
    ]:
        draw.polygon(polygon, fill=255)
    out = np.array(im)
    out[..., 3] = np.minimum(out[..., 3], np.array(mask))
    return Image.fromarray(out)


def simplify(im, height, palette, name):
    im = im.crop(im.getbbox())
    w = round(height * im.width / im.height)
    a = np.array(im.resize((w, height), Image.Resampling.NEAREST))
    source_green = a[..., 1].copy()
    solid = a[..., 3] >= 128
    labels, _ = ndimage.label(solid, np.ones((3, 3)))
    counts = np.bincount(labels.ravel())
    solid &= counts[labels] >= 2
    colors = lab(palette)
    distances = ((lab(a[..., :3])[..., None, :] - colors) ** 2).sum(-1)
    ids = distances.argmin(-1)
    used = np.bincount(ids[solid], minlength=len(palette))
    ink = next(i for i, p in enumerate(palette) if list(p) == hex_rgb(INK))
    selected = [ink] + [int(i) for i in np.argsort(-used, kind='stable') if i != ink][:11]
    ids = np.array(selected)[distances[..., selected].argmin(-1)]
    edge = solid & ~ndimage.binary_erosion(solid, border_value=0)
    accent = np.zeros(solid.shape, bool)
    if name == 'shop_gems':
        r, g, b = np.moveaxis(a[..., :3].astype(float), -1, 0)
        for mask, dark, light, brightness in [
            ((g > r * 1.15) & (g > b * 1.05), '#1a4135', '#52c04f', g),
            ((b > r * 1.25) & (b > g * 1.05), '#64bdea', '#64bdea', b),
            ((r > g * 2.1) & (r > b * 1.8), '#73140d', '#f03604', r),
        ]:
            ix = [next(i for i, p in enumerate(palette) if list(p) == hex_rgb(h)) for h in (dark, light)]
            ids = np.where(mask & solid, np.where(brightness > 110, ix[1], ix[0]), ids)
            accent |= mask & solid
    for _ in range(2):
        counts = np.stack([ndimage.convolve((ids == i).astype(int), np.ones((3, 3), int), mode='constant') for i in range(len(palette))])
        best = counts.argmax(0)
        support = np.take_along_axis(counts, ids[None], axis=0)[0]
        ids = np.where(solid & ~edge & ~accent & (support <= 2) & (counts.max(0) >= 4), best, ids)
    a[..., :3] = palette[ids]
    outline = edge
    # An inner rim erases one-cell chains; the renderer supplies their outer contour.
    if name in ('shop_scales', 'vase_c'):
        steps = 2 if name == 'shop_scales' else 1
        wide = ndimage.binary_dilation(ndimage.binary_erosion(solid, iterations=steps, border_value=0), iterations=steps)
        if name == 'shop_scales':
            wide |= np.indices(solid.shape)[0] >= height * 0.78
        outline = edge & wide
        if name == 'shop_scales':
            a[solid & ~wide, :3] = hex_rgb('#e2881e')
            a[solid & ~wide & (source_green > 110), :3] = hex_rgb('#f9ce4a')
    a[outline, :3] = palette[ink]
    a[..., 3] = solid * 255
    a[~solid, :3] = 0
    canvas = Image.new('RGBA', (w + 2, height + 2))
    canvas.paste(Image.fromarray(a), (1, 1))
    return canvas.resize((canvas.width * UP, canvas.height * UP), Image.Resampling.NEAREST)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--only', default='')
    args = parser.parse_args()
    meta_path = ROOT / 'art/simplify.json'
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    sizes = (ROOT / 'live/sizes.js').read_text().split('const HEIGHT')[1].split('};')[0]
    heights = dict((n, int(h)) for n, h in re.findall(r'(\w+): (\d+)', sizes))
    bible = np.array([hex_rgb(h) for h in dict.fromkeys(re.findall(r'#[0-9a-fA-F]{6}', (ROOT / 'art/style_bible.txt').read_text()))], dtype=np.uint8)
    # the spider and water accents serve their own props only: a prop without a ramp of its own keeps the bible it was simplified with
    accents = {'#2a202f', '#51384e', '#5f3d60', '#a47f84', '#895e54', '#1d131f', '#0f2a2e'}
    palette = np.array([c for c in bible.tolist() if '#%02x%02x%02x' % tuple(c) not in accents], dtype=np.uint8)
    for name in NAMES:
        if args.only and name not in args.only.split(','):
            continue
        dest = ROOT / 'art/gen' / (name + '.png')
        backup = ROOT / 'art/old/simplify' / (name + '.png')
        source = ROOT / 'art/raw' / (name + '.png') if name in ('water_stone_a', 'water_stone_b') else backup
        if not source.exists():
            source = backup
        if not args.check:
            if backup.exists() or name not in meta or digest(dest) != meta[name]['output_sha256']:
                if not backup.exists():
                    backup.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(dest, backup)
                im = Image.open(source).convert('RGBA')
                if name == 'bones':
                    im = reduce_bones(im)
                ramp = np.array([hex_rgb(h) for h in PALETTES[name]], dtype=np.uint8) if name in PALETTES else palette
                assert all(list(color) in bible.tolist() for color in ramp), name + ': color outside style bible'
                out = simplify(im, heights[name], ramp, name)
                out.save(dest)
                meta[name] = {'source_sha256': digest(source), 'output_sha256': digest(dest), 'height': heights[name], 'cell': UP}
        entry = meta[name]
        assert digest(dest) == entry['output_sha256'], name + ': modified since simplification'
        a = np.array(Image.open(dest).convert('RGBA'))
        solid = a[..., 3] == 255
        assert set(np.unique(a[..., 3])) == {0, 255}, name + ': partial alpha'
        colors = len(np.unique(a[..., :3][solid], axis=0))
        assert colors <= 12, name + ': too many colors'
        low = a[UP // 2::UP, UP // 2::UP]
        assert np.array_equal(a, np.repeat(np.repeat(low, UP, 0), UP, 1)), name + ': inconsistent art grid'
        mask = low[..., 3] == 255
        edge = mask & ~ndimage.binary_erosion(mask, border_value=0)
        if name in ('shop_scales', 'vase_c'):
            steps = 2 if name == 'shop_scales' else 1
            wide = ndimage.binary_dilation(ndimage.binary_erosion(mask, iterations=steps, border_value=0), iterations=steps)
            if name == 'shop_scales':
                wide |= np.indices(mask.shape)[0] - 1 >= heights[name] * 0.78
            edge &= wide
        assert np.all(low[edge, :3] == hex_rgb(INK)), name + ': broken dark contour'
        assert all(list(c) in bible.tolist() for c in np.unique(a[solid, :3], axis=0)), name + ': color outside style bible'
        density = UP * heights[name] / (2 * a.shape[0])
        assert 0.4 <= density <= 0.6, name + ': incorrect density'
        r, g, b = np.moveaxis(a[..., :3].astype(float), -1, 0)
        if name == 'shop_scales':
            gold = solid & (r > 120) & (g > 70) & (r > g) & (g > b * 1.5)
            assert gold.sum() / solid.sum() >= 0.3, name + ': gold structure lost to the contour'
        if name == 'shop_gems':
            for color in [(g > r * 1.15) & (g > b * 1.05), (b > r * 1.25) & (b > g * 1.05), (r > g * 2.1) & (r > b * 1.8)]:
                assert (solid & color).sum() >= 2 * UP * UP, name + ': gemstone color lost'
        print(f'{name}: {colors} colors, {density:.3f} grid px per art pixel')
    if not args.check:
        meta_path.write_text(json.dumps(meta, indent=2) + '\n')


if __name__ == '__main__':
    main()
