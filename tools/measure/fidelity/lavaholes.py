import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
# chasm pockets inside lava: void whose 12-30 px outer ring is >=40 % lava; count per frame and what its 0-12 px rim is
import sys,numpy as np; from scipy import ndimage
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
W=ROOTP+''; Q=W+'frames/critic_r15_fidelity/qa/'; R=W+'study/refs/ref_cave_lava.png'
for n,p,b,k in [('ref',R,None,1.05)]+[(n,Q+n+'.png',(0,120,1560,1040),1) for n in ['magma_crossing','magma_lava','magma_lake','magma_river','magma_islet','magma_terrace','zone_magma','magma_hall_sanctum','magma_crustfall']]:
  a=load(p,k,b); L,C,H=LCH(a)
  dark=ndimage.binary_opening(ndimage.uniform_filter(L,15)<6,iterations=3)
  lab_,nn=ndimage.label(dark); lava=(L>=45)&(C>=60); bas=(L>=5)&(C<18); res=[]
  for i in range(1,nn+1):
    m=lab_==i
    if m.sum()<1500: continue
    d12=ndimage.binary_dilation(m,iterations=12); far=ndimage.binary_dilation(d12,iterations=18)&~d12; rim=d12&~m
    if lava[far].mean()<0.4: continue
    res.append((int(m.sum()),round(100*lava[far].mean()),round(100*bas[rim].mean()),round(100*((L>=45)&(C>=60))[rim].mean())))
  print(f'{n:20s} pockets {len(res):2d}  ', ' '.join(f'{s}px:lava12-30 {l}% rim0-12 basalt {b}% lava {lv}%' for s,l,b,lv in sorted(res,reverse=True)[:4]))
