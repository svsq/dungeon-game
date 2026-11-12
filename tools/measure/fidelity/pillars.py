import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
import sys,numpy as np; from scipy import ndimage as nd; from scipy.spatial import cKDTree
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
W=ROOTP+''; Q=W+'frames/critic_r14_fidelity/qa/'; R=W+'study/refs/ref_cave_lava.png'
def go(n,p,box,k=1.0):
  a=load(p,k,box); L,C,H=LCH(a); lava=(L>=45)&(C>=60)
  lav=nd.binary_closing(lava,iterations=2); st=nd.binary_opening(~lav,iterations=3)
  lab,nn=nd.label(st); s=nd.sum(np.ones_like(L),lab,range(1,nn+1)); keep=[i+1 for i,v in enumerate(s) if 150<v<20000]
  if len(keep)<4: print(n,'few',len(keep)); return
  cs=np.array(nd.center_of_mass(st,lab,keep)); ar=np.array([s[i-1] for i in keep])
  d,_=cKDTree(cs).query(cs,2); d=d[:,1]
  frac=lava.mean()
  print(f'{n:22s} blobs {len(keep):3d} area p10/50/90 {np.percentile(ar,10):.0f}/{np.percentile(ar,50):.0f}/{np.percentile(ar,90):.0f} areaCV {ar.std()/ar.mean():.2f} nnCV {d.std()/d.mean():.2f} nn50 {np.median(d):.0f} lava {frac*100:.0f}%')
go('ref lakeR',R,(1150,180,1536,520),1.05)
go('ref lakeBL',R,(400,680,800,1024),1.05)
go('magma_lake L',Q+'magma_lake.png',(0,200,700,1000))
go('magma_lake R',Q+'magma_lake.png',(1150,560,1560,1000))
go('magma_lava',Q+'magma_lava.png',(900,180,1560,800))
go('magma_lake_shore',Q+'magma_lake_shore.png',(0,600,760,1040))
