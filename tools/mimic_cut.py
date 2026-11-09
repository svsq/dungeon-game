from PIL import Image, ImageDraw

# (the chest's front band top, in its bounding box): keep in step with MIMIC_LINE in live/scene_actors.js
LINES = {'chest': ((0, .36), (.70, .56), (1, .34)), 'chest_iron': ((0, .40), (.70, .52), (1, .36)), 'chest_gold': ((0, .40), (.70, .52), (1, .33))}
for rank, (name, line) in zip(('wood', 'iron', 'gold'), LINES.items()):
    im = Image.open(f'art/gen/{name}.png').convert('RGBA')
    x0, y0, x1, y1 = im.getbbox()
    w, h = x1 - x0, y1 - y0
    im = im.crop((x0, y0, x1, y1))
    pts = [(u * w, v * h) for u, v in line]
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).polygon([(0, 0), (w, 0), *reversed(pts)], fill=255)
    out = lambda picked: Image.composite(im, Image.new('RGBA', im.size, (0, 0, 0, 0)), picked)
    out(mask).save(f'art/gen/mimic_{rank}__lid.png')
    out(mask.point(lambda v: 255 - v)).save(f'art/gen/mimic_{rank}__base.png')
    print(rank, w, h)
