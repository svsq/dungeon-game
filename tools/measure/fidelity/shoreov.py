import sys; sys.path.insert(0,__file__.rsplit('/',1)[0])
from shore import *
from PIL import ImageDraw
# shoreov.py name out [x0,y0,x1,y1]: overlay of straight runs >64 px (red), tolerance ±2 px
n,o=sys.argv[1:3]; b=(0,120,1536,1000)
if len(sys.argv)>3: b=tuple(map(int,sys.argv[3].split(',')))
im=Image.open(n).convert('RGB'); a=np.asarray(im).astype(int)[b[1]:b[3],b[0]:b[2]]
m=mask(a); Eh=m[:-1,:]!=m[1:,:]; Ev=m[:,:-1]!=m[:,1:]
H=[(l,'H',y,s,e) for l,y,s,e in runs(Eh) if l>64 and edgeok('H',y,s,e,a.shape[:2],b[0],b[1])]; V=[(l,'V',x,s,e) for l,x,s,e in runs(Ev.T) if l>64 and edgeok('V',x,s,e,a.shape[:2],b[0],b[1])]
d=ImageDraw.Draw(im); lst=sorted(H+V,reverse=True)
for l,t,c,s,e in lst:
  if t=='H': d.line([(b[0]+s,b[1]+c),(b[0]+e,b[1]+c)],fill=(0,255,255),width=2)
  else: d.line([(b[0]+c,b[1]+s),(b[0]+c,b[1]+e)],fill=(0,255,255),width=2)
  print(l,t,'at',(b[0]+s,b[1]+c) if t=='H' else (b[0]+c,b[1]+s),'to',(b[0]+e,b[1]+c) if t=='H' else (b[0]+c,b[1]+e))
im.save(o)
