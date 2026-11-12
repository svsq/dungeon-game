import sys
from PIL import Image, ImageDraw
# crops.py out zoom "path:x0,y0,x1,y1" ...
o=sys.argv[1]; z=int(sys.argv[2]); ims=[]
for s in sys.argv[3:]:
  p,b=s.split(':'); b=tuple(map(int,b.split(','))); a=Image.open(p).convert('RGB').crop(b); ims.append((a.resize((a.width*z,a.height*z),Image.NEAREST),p.split('/')[-1]+' '+str(b)))
w=sum(a.width for a,_ in ims)+8*(len(ims)-1); h=max(a.height for a,_ in ims)+14
c=Image.new('RGB',(w,h),(30,30,30)); d=ImageDraw.Draw(c); x=0
for a,t in ims: c.paste(a,(x,14)); d.text((x+2,1),t,fill=(255,255,255)); x+=a.width+8
c.save(o); print(c.size)
