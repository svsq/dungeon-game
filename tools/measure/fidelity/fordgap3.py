import sys,numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
# fordgap3.py path:x0,y0,x1,y1[:k] : slab cores (L 12..45, C<14, opened), neighbour pairs by centre distance, lava width on the centre line (R>=170 run, outer slab edge to edge)
def do(spec):
  p,bb,*k=spec.split(':'); b=list(map(int,bb.split(','))); k=float(k[0]) if k else 1
  im=Image.open(p).convert('RGB')
  if k!=1: im=im.resize((round(im.width*k),round(im.height*k)),Image.NEAREST)
  a=np.asarray(im).astype(float)[b[1]:b[3],b[0]:b[2]]; L,C,H=LCH(a.reshape(-1,3)); L=L.reshape(a.shape[:2]); C=C.reshape(a.shape[:2])
  core=nd.binary_opening((L>10)&(L<50)&(C<16),iterations=2); lab,n=nd.label(core); cs=[]
  for i in range(1,n+1):
    m=lab==i
    if m.sum()>=120: cs.append(nd.center_of_mass(m)+(int(m.sum()),))
  res=[]; ori=[]
  for i in range(len(cs)):
    for j in range(i+1,len(cs)):
      d=np.hypot(cs[i][0]-cs[j][0],cs[i][1]-cs[j][1])
      if d>58: continue
      ys=np.linspace(cs[i][0],cs[j][0],int(d)+1).astype(int); xs=np.linspace(cs[i][1],cs[j][1],int(d)+1).astype(int); R=a[ys,xs,0]; res.append(int((R>=170).sum())); ori.append("H" if abs(cs[i][1]-cs[j][1])>2*abs(cs[i][0]-cs[j][0]) else ("V" if abs(cs[i][0]-cs[j][0])>2*abs(cs[i][1]-cs[j][1]) else "D"))
  print("by axis",sorted(zip(ori,res))); res.sort(); print(p.rsplit('/',1)[1],b,'slabs',len(cs),'pairs',len(res),'lava px on centre lines',res,'>=6:',sum(x>=6 for x in res),'/',len(res), 'median',float(np.median(res)) if res else None)
for s in sys.argv[1:]: do(s)
