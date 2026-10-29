import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt, label

root = Path('frames/serpentmotion')
records = json.loads((root / 'trace.json').read_text())
move = json.loads(subprocess.check_output(['node', '-e', "console.log(JSON.stringify(require('./live/data.js').BOSSES.boss_serpent.moves.bite))"], text=True))
results, errors = [], []
for record in records:
    direction, frames = record['direction'], record['frames']
    masks = [np.array(Image.open(root / str(direction) / f"{f['frame']:03}.png"))[:, :, 0] > 127 for f in frames]
    if len(masks) < 60 or any(m.sum() < 30 for m in masks):
        errors.append(f'{direction}: missing silhouette frames')
        continue
    raw_masks = masks
    masks = []
    for mask in raw_masks:
        islands, _ = label(mask)
        sizes = np.bincount(islands.ravel()); sizes[0] = 0
        masks.append(np.isin(islands, np.flatnonzero(sizes >= max(4, sizes.max() * 0.005))))
    jumps = [max(distance_transform_edt(~p)[q].max(), distance_transform_edt(~q)[p].max()) * 2 for p, q in zip(masks, masks[1:])]
    h = np.array([f['head'] for f in frames])
    wind = np.array([f['t'] <= move['wind'] - 0.14 for f in frames])
    anticipation = float(np.linalg.norm(h[wind] - h[0], axis=1).max())
    worst = float(max(jumps))
    if worst > 168 * 0.12:
        errors.append(f'{direction}: silhouette jump {worst:.2f} view px at frame {int(np.argmax(jumps))}, max 20.16')
    if anticipation < 168 * 0.08:
        errors.append(f'{direction}: wind head movement {anticipation:.2f} view px, min 13.44')
    results.append({'direction': direction, 'frames': len(masks), 'max_silhouette_jump_view_px': worst, 'wind_head_shift_view_px': anticipation, 'jumps': jumps})
    sheet = Image.new('RGB', (960, 720))
    for j, frame in enumerate(np.linspace(0, len(masks) - 1, 12).astype(int)):
        sheet.paste(Image.open(root / str(direction) / f'{frame:03}.png').convert('RGB'), ((j % 4) * 240, (j // 4) * 240))
    sheet.save(root / f'bite_{direction}_sheet.png')
report = {'mask_filter': 'connected components >= max(4 art pixels, 0.5% of largest); excludes isolated waterline pixels', 'height_view_px': 168, 'sampling_fps': 60, 'results': results, 'errors': errors}
(root / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
for r in results:
    print(f"direction {r['direction']}: silhouette {r['max_silhouette_jump_view_px']:.2f}, wind head {r['wind_head_shift_view_px']:.2f} view px")
print('\n'.join(errors) if errors else 'serpentmotion: ok')
raise SystemExit(2 if errors else 0)
