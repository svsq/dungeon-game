import sys,numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
# fordgap.py path x0 y0 x1 y1: slabs = dark components inside the box; gap = least pixel distance between neighbours, and lava share of the straight line joining their nearest points
def run(p,b,minA=120,maxgap=26):
  a=np.asarray(Image.open(p).convert('RGB')).astype(float)[b[1]:b[3],b[0]:b[2]]
  L,C,H=LCH(a.reshape(-1,3)); L=L.reshape(a.shape[:2]); C=C.reshape(a.shape[:2])
  lava=(L>=38)&(C>=45); sl=nd.binary_opening(~lava,iterations=1); lab,n=nd.label(sl)
  objs=[(i,(lab==i)) for i in range(1,n+1) if (lab==i).sum()>=minA]
  out=[]
  for i,(ia,ma) in enumerate(objs):
    d=nd.distance_transform_edt(~ma)
    for ib,mb in objs[i+1:]:
      g=d[mb].min()
      if g<=maxgap: out.append(round(float(g),1))
  out.sort(); return len(objs),out,round(float(lava.mean()*100),1),[int(m.sum()) for _,m in objs]
for spec in sys.argv[1:]:
  p,*bb=spec.split(':'); b=list(map(int,bb[0].split(',')))
  n,g,lv,ar=run(p,b); print(p.rsplit('/',1)[1],b,'slabs',n,'areas',ar,'lava%',lv,'gaps',g,'>=6:',sum(x>=6 for x in g),'/',len(g))
