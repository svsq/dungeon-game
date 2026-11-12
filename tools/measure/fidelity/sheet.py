import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
import sys
from PIL import Image, ImageDraw
out=sys.argv[1]; names=sys.argv[2:]
W,H=960,540; cols=2; rows=(len(names)+1)//2
im=Image.new('RGB',(W*cols,H*rows),(255,0,255)); d=ImageDraw.Draw(im)
for i,n in enumerate(names):
  a=Image.open(ROOTP+f'frames/critic_r14_fidelity/qa/{n}.png').convert('RGB').resize((W,H),Image.LANCZOS)
  x,y=(i%cols)*W,(i//cols)*H; im.paste(a,(x,y)); d.rectangle([x,y,x+200,y+16],fill=(0,0,0)); d.text((x+3,y+2),n,fill=(0,255,0))
im.save(out)
