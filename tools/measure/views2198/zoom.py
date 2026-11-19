# python3 tools/measure/views2198/zoom.py out.png sheet.png [row] [frames] [K]: frames of one row of a sheet.cjs sheet side by side at ×K/3
import sys
from PIL import Image
out, src = sys.argv[1], sys.argv[2]; row = int(sys.argv[3]) if len(sys.argv) > 3 else 1
fr = [int(v) for v in (sys.argv[4] if len(sys.argv) > 4 else '0,3,6,9').split(',')]; K = int(sys.argv[5]) if len(sys.argv) > 5 else 6
im = Image.open(src); FW, FH = 90 * 3, 112 * 3
crops = [im.crop((f * FW, row * FH, f * FW + FW - 6, row * FH + FH - 6)) for f in fr]
sh = Image.new('RGB', (len(crops) * (FW - 6), FH - 6), (20, 20, 20))
for i, c in enumerate(crops): sh.paste(c, (i * (FW - 6), 0))
sh.resize((sh.width * K // 3, sh.height * K // 3), Image.NEAREST).save(out)
