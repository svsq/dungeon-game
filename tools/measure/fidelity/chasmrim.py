import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
# rim of big dark voids: 0-12 px OUTSIDE the void (what borders it: basalt / lava) and 0-30 px INSIDE (silhouettes)
import sys,numpy as np; from scipy import ndimage
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
W=ROOTP+''; Q=W+'frames/critic_r14_fidelity/qa/'; R=W+'study/refs/ref_cave_lava.png'
for n,p,b,k in [('ref',R,None,1.05),('magma_crustfall hole',Q+'magma_crustfall.png',(380,660,800,1000),1),('magma_chasm',Q+'magma_chasm.png',(0,120,1560,1000),1),('magma_bridge',Q+'magma_bridge.png',(0,120,1560,1000),1)]:
  a=load(p,k,b); L,C,H=LCH(a)
  dark=ndimage.uniform_filter(L,31)<6; dark=ndimage.binary_opening(dark,iterations=5)
  lab_,nn=ndimage.label(dark); sz=np.bincount(lab_.ravel()); big=np.isin(lab_,np.flatnonzero(sz>15000)); big&=lab_>0
  do=ndimage.distance_transform_edt(~big); out=(do>0)&(do<=12); di=ndimage.distance_transform_edt(big); inn=big&(di<=30)
  lava=(L>=45)&(C>=60); bas=(L>=5)&(C<18)
  print(f'{n:22s} outside0-12: lava {100*lava[out].mean():.0f}% basalt {100*bas[out].mean():.0f}% | inside0-30: L>8 {100*(L[inn]>8).mean():.0f}% basalt {100*bas[inn].mean():.0f}%')
