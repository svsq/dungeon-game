# python3 tools/measure/chars_assets/archcrop.py OUT name1 name2 ...: the menu arch's hero region of gearsheet's arch frames side by side
import sys; from PIL import Image
D = 'frames/critic_chars_r1_assets/gear/arch/'; box = (790, 450, 1050, 770)
ims = [Image.open(D + n + '.png').convert('RGB').crop(box) for n in sys.argv[2:]]
O = Image.new('RGB', (sum(i.width for i in ims), ims[0].height))
for k, i in enumerate(ims): O.paste(i, (k * i.width, 0))
O.save(sys.argv[1])
