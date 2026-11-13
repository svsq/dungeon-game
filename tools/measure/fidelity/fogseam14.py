import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
# lava at the fog's rim after 1047/1048: brightest pixels vs the cells around them, and their hue, by distance to the fog
import sys,numpy as np; from scipy import ndimage
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
W=ROOTP+''; Q=W+'frames/critic_r15_fidelity/qa/'; R=W+'study/refs/ref_cave_lava.png'
for n,p,b,k in [('ref',R,None,1.05),('magma_fog',Q+'magma_fog.png',(380,120,1560,1000),1),('fog noHUD B',Q+'magma_fog.png',(400,320,1500,930),1),('magma_fog_walk',Q+'magma_fog_walk.png',(0,120,760,1080),1),('fog_walk noHUD',Q+'magma_fog_walk.png',(0,340,760,1030),1),('fog_walk noHUD2',Q+'magma_fog_walk.png',(340,120,760,1030),1),
                ('r4 magma_fog',W+'frames/assets_r4/magma_fog.png',(380,120,1560,1000),1),('r4 magma_fog_walk',W+'frames/assets_r4/magma_fog_walk.png',(0,120,760,1080),1)]:
  try: a=load(p,k,b)
  except Exception as e: print(n,'missing'); continue
  L,C,H=LCH(a); rgb=a.reshape(L.shape+(3,)) if a.ndim==2 else a
  blk=ndimage.binary_opening(L<3,iterations=6); d=ndimage.distance_transform_edt(~blk)
  warm=(C>=30)&~blk&(L>5)
  out=[]
  for a0,a1 in [(0,12),(12,24),(24,48),(48,96)]:
    m=warm&(d>=a0)&(d<a1)
    if m.sum()<200: out.append(f'{a0}-{a1}: -'); continue
    l=L[m]; q90,q50=np.percentile(l,90),np.percentile(l,50)
    top=m&(L>=q90); g=rgb[...,1][top].astype(float); r=rgb[...,0][top].astype(float)
    olive=float(((g>=0.8*r)&(r<200)).mean()*100)
    out.append(f'{a0}-{a1}: L50 {q50:.0f} L90 {q90:.0f} gap {q90-q50:.0f} olive {olive:.0f}%')
  print(f'{n:15s} '+' | '.join(out))
