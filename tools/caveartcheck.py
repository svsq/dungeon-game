import json
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt, label

out = Path('frames/cave_art_final')
out.mkdir(parents=True, exist_ok=True)
sizes = dict((k, int(v)) for k, v in re.findall(r'(\w+): (\d+)', Path('live/sizes.js').read_text().split('const HEIGHT')[1].split('};')[0]))
actors = ['hero', 'crab__body', 'lily_cv', 'weed_cv', 'ford_a', 'ford_b', 'water_stone_a', 'water_stone_b']
sheet = Image.new('RGB', (1280, 840), '#504b48')
report = {}
for i, name in enumerate(actors):
    im = Image.open('art/gen/' + name + '.png').convert('RGBA')
    h = sizes['en_crab'] if name == 'crab__body' else sizes[name]
    a = np.array(im)
    solid = a[..., 3] > 128
    distance = distance_transform_edt(solid) * h / im.height
    dark = solid & (a[..., :3] @ np.array([0.3, 0.59, 0.11]) < 50) & (distance <= 4)
    width = float(np.median(distance[dark]) * 2)
    report[name] = {'paint_contour_median_view_px': round(width, 3), 'source_size': list(im.size), 'view_height': h, 'opaque_colors': len(np.unique(a[solid, :3], axis=0))}
    if name != 'hero':
        assert set(np.unique(a[..., 3])) == {0, 255}, name + ': partial alpha'
    w = max(1, round(im.width * h / im.height / 2))
    art = im.resize((w, max(1, round(h / 2))), Image.Resampling.BOX)
    art = art.resize((art.width * 8, art.height * 8), Image.Resampling.NEAREST)
    x, y = i % 4 * 320, i // 4 * 420
    sheet.paste(art, (x + (320 - art.width) // 2, y + 360 - art.height), art)
    ImageDraw.Draw(sheet).text((x + 10, y + 370), name + '  outline ' + str(round(width, 2)), fill='white')
hero = report['hero']['paint_contour_median_view_px']
for name in actors[1:]:
    assert report[name]['paint_contour_median_view_px'] >= hero / 1.5, name + ': paint contour too fine'
rigs = json.loads(Path('live/rigs.js').read_text().removeprefix('window.RIGS = ').strip().removesuffix(';'))
for name in ['legA', 'legB', 'armA', 'armB', 'hand', 'finger']:
    alpha = np.array(Image.open('art/gen/crab__' + name + '.png'))[..., 3]
    for key in ['root', 'end']:
        x, y = rigs['crab'][name][key]
        assert 0 <= x < alpha.shape[1] and 0 <= y < alpha.shape[0], name + ': joint outside part'
        assert alpha[y, x] == 255, name + ': transparent joint'
for name in ['skel_mage__body', 'skel_archer__body', 'drowned__body']:
    alpha = np.array(Image.open('art/gen/' + name + '.png'))[..., 3] > 0
    ids, _ = label(alpha, np.ones((3, 3)))
    counts = np.bincount(ids.ravel())[1:]
    small = counts[counts < counts.max() * 0.01]
    assert not len(small), name + ': floating specks remain'
    report[name] = {'small_alpha_islands': len(small)}
shore = np.array(Image.open('art/gen/shore_cv_tex.png').convert('RGB')).astype(float)
seam = [float(abs(shore[:, 0] - shore[:, -1]).mean()), float(abs(shore[0] - shore[-1]).mean())]
inside = [float(abs(np.diff(shore, axis=1)).mean()), float(abs(np.diff(shore, axis=0)).mean())]
assert all(s <= v for s, v in zip(seam, inside)), 'shore seam sharper than interior'
report['shore'] = {'seam_rgb_MAE': seam, 'adjacent_rgb_MAE': inside, 'colors': len(np.unique(shore.reshape(-1, 3), axis=0))}
assert report['shore']['colors'] <= 24
sheet.save(out / 'contact.png')
(out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
print('caveartcheck: ok (paint contours, binary alpha, opaque joint caps, shore seam)')
