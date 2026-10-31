import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps


out = Path('frames/cave_recapture')
frames = Path('frames/cave_333_delivery')


def sheet(items, name, columns, size):
    width, height = size
    image = Image.new('RGB', (columns * width, ((len(items) + columns - 1) // columns) * (height + 28)), '#181818')
    draw = ImageDraw.Draw(image)
    for i, (label, source) in enumerate(items):
        tile = ImageOps.contain(source.convert('RGB'), size)
        x, y = i % columns * width, i // columns * (height + 28)
        image.paste(tile, (x + (width - tile.width) // 2, y))
        draw.text((x + 8, y + height + 5), label, fill='white')
    image.save(out / name)


items = [(name, Image.open(frames / (name + '.png'))) for name in ['zone_cave', 'cave_hall', 'cave_water', 'cave_crossing']]
items += [(name, Image.open('study/refs/' + name + '.png')) for name in ['ref_cave_water', 'ref_cave_water_camera_v2']]
sheet(items, 'palette_comparison.png', 2, (768, 432))
states = json.loads((frames / 'report.json').read_text())['states']
items = []
for place in ['bridge', 'camp']:
    for facing in ['front', 'back', 'left', 'right']:
        name = 'cave_light_' + place + '_' + facing
        state = states[name]
        x, y = [round(a - b) for a, b in zip(state['hero'], state['cam'])]
        items.append((place + '_' + facing, Image.open(frames / (name + '.png')).crop((x - 240, y - 240, x + 240, y + 80))))
sheet(items, 'hero_facings.png', 2, (480, 320))
regions = json.loads(Path('study/CAVE_PALETTE_REGIONS.json').read_text())
items = []
for name, region in regions.items():
    source = Path(region['reference']) if 'reference' in region else frames / (region['frame'] + '.png')
    items.append((name, Image.open(source).crop(region['roi'])))
sheet(items, 'regions_comparison.png', 3, (384, 216))
sheet([(name, Image.open('frames/cave_322_materials_final/' + name + '.png')) for name in ['floor', 'wall', 'top']], 'materials.png', 3, (256, 256))
print('cavereviewsheets: four current comparison sheets')
