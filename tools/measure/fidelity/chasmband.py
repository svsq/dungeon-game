import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
# chasm: big dark areas (blur-15 L<6), the 100 px band next to their edge: share of L>8 (silhouettes) and of basalt grey
import sys,numpy as np; from scipy import ndimage
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
W=ROOTP+''; Q=W+'frames/critic_r14_fidelity/qa/'; R=W+'study/refs/ref_cave_lava.png'
for n,p,b,k in [('ref',R,None,1.05),('magma_chasm',Q+'magma_chasm.png',(0,120,1560,1000),1),('magma_bridge',Q+'magma_bridge.png',(0,120,1560,1000),1)]:
  a=load(p,k,b); L,C,H=LCH(a)
  dark=ndimage.uniform_filter(L,31)<6; dark=ndimage.binary_opening(dark,iterations=5)
  lab_,nn=ndimage.label(dark); sz=np.bincount(lab_.ravel()); big=np.isin(lab_,np.flatnonzero(sz>20000)[1:] if nn else [])
  big=big&(lab_>0); d=ndimage.distance_transform_edt(big); band=big&(d<=100)
  print(f'{n:13s} chasm px {big.sum()} band {band.sum()}  L>8 {100*(L[band]>8).mean():.0f}%  basalt {100*((L[band]>=5)&(C[band]<18)).mean():.0f}%  L p90 {np.percentile(L[band],90):.0f}')
