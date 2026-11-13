import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
# straight horizontal runs of bright yellow (G>150) >= 12 px in lava areas; ref at x1.05 nearest
import sys,numpy as np
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
W=ROOTP+''; R=W+'study/refs/ref_cave_lava.png'; Q=W+'frames/critic_r15_fidelity/qa/'
def runs(a,minlen):
  s=(a[...,1]>150)&(a[...,0]>230); out=[]
  for y in range(s.shape[0]):
    r=np.flatnonzero(np.diff(np.r_[0,s[y].astype(int),0])); out+=list(r[1::2]-r[::2])
  return np.array(out)
for n,p,b,k in [('ref lake R',R,(1150,200,1536,480),1.05),('ref lake BL',R,(420,700,760,1000),1.05),('ref whole',R,None,1.05),('magma_lava',Q+'magma_lava.png',(380,120,1560,1000),1),('magma_lake',Q+'magma_lake.png',(380,120,1560,1000),1),('magma_islet',Q+'magma_islet.png',(0,150,1500,1000),1),('magma_lake_shore',Q+'magma_lake_shore.png',(0,560,760,1080),1)]:
  a=load(p,k,b); L,C,H=LCH(a); lava=((L>=45)&(C>=60)).sum()
  r=runs(a,12); 
  print(f'{n:18s} runs>=12: {int((r>=12).sum())/lava*1e4:.1f}/10k lava px  runs>=20: {int((r>=20).sum())/lava*1e4:.1f}  max {r.max()}')
