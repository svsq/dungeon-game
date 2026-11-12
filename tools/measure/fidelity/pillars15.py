import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
# r15: pillars.py plus what it drops: stone blobs under 150 px (loose stones) and over 20000 px (merged massifs), and the stone share of the box
import sys,numpy as np; from scipy import ndimage as nd
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
Q=ROOTP+os.environ.get('QA','frames/critic_r15_fidelity/qa/'); R=ROOTP+'study/refs/ref_cave_lava.png'
def go(n,p,box,k=1.0):
  a=load(p,k,box); L,C,H=LCH(a); lava=(L>=45)&(C>=60)
  lav=nd.binary_closing(lava,iterations=2); st=nd.binary_opening(~lav,iterations=3)
  lab,nn=nd.label(st); s=np.array(nd.sum(np.ones_like(L),lab,range(1,nn+1)))
  lab0,n0=nd.label(~lav); s0=np.array(nd.sum(np.ones_like(L),lab0,range(1,n0+1)))
  mid=s[(s>150)&(s<20000)]; Mp=L.size/1e6
  print(f'{n:16s} stone {100*st.mean():3.0f}%  mid {len(mid)/Mp:5.0f}/Mpx p50 {np.median(mid) if len(mid) else 0:6.0f}  big>20000 {int((s>=20000).sum())} ({100*s[s>=20000].sum()/max(st.sum(),1):3.0f}% of stone)  loose<150 before opening {(s0<150).sum()/Mp:5.0f}/Mpx')
go('ref lakeR',R,(1150,180,1536,520),1.05); go('ref lakeBL',R,(400,680,800,1024),1.05)
go('magma_lake L',Q+'magma_lake.png',(0,200,700,1000)); go('magma_lake R',Q+'magma_lake.png',(1150,560,1560,1000))
go('magma_lava',Q+'magma_lava.png',(900,180,1560,800)); go('magma_lake_shore',Q+'magma_lake_shore.png',(0,600,760,1040))
