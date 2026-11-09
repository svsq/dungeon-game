#!/usr/bin/env python3
"""live/assets/Galmuri*.ttf → live/font_data.js. Run from the project root after replacing a font."""
import base64, pathlib
A = pathlib.Path('live/assets')
licence = (A / 'Galmuri-OFL.txt').read_text(encoding='utf8').replace('*/', '* /')
# the fonts travel as a script because pack.py copies live/*.js but only PNGs from live/assets; the licence travels with them, as the OFL requires
body = ''.join(f"  {n}: '{base64.b64encode((A / (n + '.ttf')).read_bytes()).decode()}',\n" for n in ('Galmuri9', 'Galmuri11'))
pathlib.Path('live/font_data.js').write_text(f'/* {licence}*/\nwindow.FONT_DATA = {{\n{body}}};\n', encoding='utf8')
print('live/font_data.js')
