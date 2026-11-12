import sys; sys.path.insert(0,__file__.rsplit('/',1)[0])
from shore import *
from PIL import ImageDraw
# shoresheet.py out dir names... : one 160x120 tile per straight run >64 px (±2 px), run drawn cyan
out,d=sys.argv[1:3]; b=(0,120,1536,1000); T=[]
for n in sys.argv[3:]:
  im=Image.open(f'{d}/{n}.png').convert('RGB'); a=np.asarray(im).astype(int)[b[1]:b[3],b[0]:b[2]]; m=mask(a)
  Eh=m[:-1,:]!=m[1:,:]; Ev=m[:,:-1]!=m[:,1:]
  L=[(l,'H',y,s,e) for l,y,s,e in runs(Eh) if l>64 and edgeok('H',y,s,e,a.shape[:2],b[0],b[1])]+[(l,'V',x,s,e) for l,x,s,e in runs(Ev.T) if l>64 and edgeok('V',x,s,e,a.shape[:2],b[0],b[1])]
  for l,o,c,s,e in sorted(L,reverse=True):
    x0,y0,x1,y1=(s,c,e,c) if o=='H' else (c,s,c,e); x0+=b[0];x1+=b[0];y0+=b[1];y1+=b[1]; cx,cy=(x0+x1)//2,(y0+y1)//2
    t=im.crop((cx-100,cy-75,cx+100,cy+75)); ImageDraw.Draw(t).line([(x0-cx+100,y0-cy+65),(x1-cx+100,y1-cy+65)],fill=(0,255,255),width=1); ImageDraw.Draw(t).text((2,2),f'{n[6:]} {l}{o} {x0},{y0}',fill=(255,255,255)); T.append(t)
cols=9; rows=len(T)//cols+1; c=Image.new('RGB',(cols*204,rows*154),(40,40,40))
for i,t in enumerate(T): c.paste(t,((i%cols)*204,(i//cols)*154))
c.save(out); print(len(T),c.size)
