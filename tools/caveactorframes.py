import json
from pathlib import Path
from PIL import Image, ImageDraw

root = Path('frames/cave_actor_series')
states = json.loads((root / 'states.json').read_text())
for actor in ['skel_archer', 'skel_mage', 'drowned', 'slime']:
    selected = [(name, state) for name, state in states if name.startswith('cave_actor_' + actor + '_')]
    sheet = Image.new('RGB', (1600, 780))
    for i, (name, state) in enumerate(selected):
        run = state['run']
        enemy = run['en'][0]
        zoom = run.get('zoom', 1)
        x = (enemy['x'] - run['cam'][0]) * zoom
        y = (enemy['y'] - run['cam'][1]) * zoom
        frame = Image.open(root / (name + '.png')).convert('RGB')
        crop = frame.crop((round(x - 160), round(y - 170), round(x + 160), round(y + 70)))
        px, py = i % 5 * 320, i // 5 * 260
        sheet.paste(crop, (px, py))
        ImageDraw.Draw(sheet).text((px + 6, py + 242), name.split('_')[-1] + ' ' + enemy['st'] + (' dead' if enemy['deadT'] >= 0 else ''), fill='white')
    sheet.save(root / (actor + '_strip.png'))
