import sys
from PIL import Image, ImageDraw
# crop.py src x0 y0 x1 y1 scale out [grid]
src,x0,y0,x1,y1,s,out=sys.argv[1],*map(int,sys.argv[2:7]),sys.argv[7]
im=Image.open(src).convert('RGB').crop((x0,y0,x1,y1))
im=im.resize((im.width*s,im.height*s),Image.NEAREST)
if len(sys.argv)>8:
  g=int(sys.argv[8]); d=ImageDraw.Draw(im)
  for x in range((x0//g+1)*g,x1,g): d.line([((x-x0)*s,0),((x-x0)*s,im.height)],fill=(0,255,255),width=1); d.text(((x-x0)*s+2,2),str(x),fill=(0,255,255))
  for y in range((y0//g+1)*g,y1,g): d.line([(0,(y-y0)*s),(im.width,(y-y0)*s)],fill=(0,255,255),width=1); d.text((2,(y-y0)*s+2),str(y),fill=(0,255,255))
im.save(out)
