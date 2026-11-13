import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
import re,json,numpy as np
from PIL import Image,ImageDraw
from scipy import ndimage as nd
F=ROOTP+'frames/fidelity_r14/'
def hot(a):
  m=(a[...,0]>=205)&(a[...,1]>=55)&(a[...,2]<=120); return nd.binary_opening(nd.binary_closing(m,iterations=3),iterations=2)
R={}
for v in ('new','base'):
  R[v]={}
  for l in open(F+f'shoremap_{v}.txt'):
    m=re.match(r'(\S+) (\{.*\})$',l.strip())
    if m: R[v][m.group(1)]=json.loads(m.group(2))
out=[]
for n in ('magma_terrace','magma_river','magma_brink'):
 for v in ('new','base'):
  j=R[v][n]; im=Image.open(F+f'shoremap_{v}/{n}.png').convert('RGB'); a=np.asarray(im).astype(int); H,W=a.shape[:2]
  cx,cy=j['cam']; cat=np.array(j['cat']).reshape(j['H'],j['W']); X,Y=np.meshgrid(np.arange(W),np.arange(H)); tx=np.floor((X+cx)/32).astype(int); ty=np.floor((Y+cy)/32).astype(int); ok=(tx>=0)&(ty>=0)&(tx<j['W'])&(ty<j['H']); C=np.full((H,W),-1); C[ok]=cat[ty[ok],tx[ok]]
  lava=C==3; hm=hot(a); L,k=nd.label(hm); keep=np.unique(L[hm&lava]); hm=np.isin(L,keep[keep>0]); walk=C==1; d=nd.distance_transform_edt(~lava); ins=hm&walk&(d>16)
  lab,c=nd.label(ins); objs=[(int((lab==i).sum()),)+nd.find_objects(lab)[i-1] for i in range(1,c+1)]; objs.sort(key=lambda q:-q[0])
  dry=(C==3)&~hm; bandL=nd.distance_transform_edt(C!=1); b=(C==3)&(bandL<=16); print('   dry band %',round(100*dry[b].mean(),1) if b.sum() else 0)
  print(n,v,[(q[0],q[2].start,q[1].start,q[2].stop,q[1].stop) for q in objs[:5]])
  if v=='new' and objs:
    q=objs[0]; x0=max(0,q[2].start-90); y0=max(0,q[1].start-70); bx=(x0,y0,x0+300,y0+220)
    c1=im.crop(bx).resize((900,660),Image.NEAREST); d0=ImageDraw.Draw(c1)
    for gx in range(int(np.ceil((x0+cx)/32))*32-int(cx),x0+300,32): d0.line([((gx-x0)*3,0),((gx-x0)*3,660)],fill=(0,255,255))
    for gy in range(int(np.ceil((y0+cy)/32))*32-int(cy),y0+220,32): d0.line([(0,(gy-y0)*3),(900,(gy-y0)*3)],fill=(0,255,255))
    out.append(c1)
sh=Image.new('RGB',(900*len(out),660)); [sh.paste(c,(i*900,0)) for i,c in enumerate(out)]; sh.save(F+'z_mapdepth.png')
