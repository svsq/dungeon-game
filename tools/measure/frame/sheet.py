import sys
from PIL import Image, ImageDraw
out=sys.argv[1]; fs=sys.argv[2:]
W,H=960,540
cols=2; rows=(len(fs)+1)//2
S=Image.new('RGB',(W*cols,H*rows))
d=ImageDraw.Draw(S)
for i,f in enumerate(fs):
  im=Image.open(f).convert('RGB').resize((W,H),Image.LANCZOS)
  S.paste(im,((i%2)*W,(i//2)*H)); d.text(((i%2)*W+8,(i//2)*H+8),f.split('/')[-1],fill=(0,255,0))
S.save(out)
