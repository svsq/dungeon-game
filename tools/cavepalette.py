import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image


def measure(path, roi=None):
    im = Image.open(path).convert('RGB')
    if roi:
        im = im.crop(roi)
    rgb = np.array(im, dtype=float) / 255
    lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    xyz = lin @ np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]]).T
    xyz /= np.array([0.95047, 1, 1.08883])
    f = np.where(xyz > (6 / 29) ** 3, np.cbrt(xyz), xyz / (3 * (6 / 29) ** 2) + 4 / 29)
    light = 116 * f[..., 1] - 16
    aa, bb = 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])
    chroma = np.hypot(aa, bb)
    hue = np.degrees(np.arctan2(bb, aa)) % 360
    lit = light >= 5
    colored = lit & (chroma >= 5)
    ranges = {name: (hue >= lo) & (hue < hi) for name, lo, hi in [('warm', 0, 60), ('yellow_green', 60, 120), ('green', 120, 180), ('cyan', 180, 240), ('blue', 240, 300)]}
    return {'roi': roi if roi else 'full reference', 'L_p10_p50_p90_p99': np.percentile(light[lit], [10, 50, 90, 99]).round(2).tolist(), 'C_p50_p90': np.percentile(chroma[lit], [50, 90]).round(2).tolist(), 'C_gt40_pct': round(float((chroma[lit] > 40).mean()) * 100, 2), 'Lab_hue_C_ge5_pct': {k: round(float((mask & colored).sum() / max(1, colored.sum())) * 100, 2) for k, mask in ranges.items()}}


parser = argparse.ArgumentParser()
parser.add_argument('--frames', default='frames/cave_palette')
parser.add_argument('--out', default='frames/cave_palette/metrics.json')
parser.add_argument('--roi', default='380,120,1550,1000')
args = parser.parse_args()
roi = [int(v) for v in args.roi.split(',')]
if len(roi) != 4 or roi[2] <= roi[0] or roi[3] <= roi[1]:
    parser.error('--roi requires left,top,right,bottom')
result = {name: measure(Path('study/refs') / (name + '.png')) for name in ['ref_cave_water', 'ref_cave_water_camera_v2']}
for name in ['zone_cave', 'cave_hall', 'cave_water', 'cave_crossing']:
    result[name] = measure(Path(args.frames) / (name + '.png'), roi)
Path(args.out).write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, ensure_ascii=False))
