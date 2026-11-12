import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
# lava at the fog's edge: median L of hot pixels by distance to the fog (big black area), and the glow L into the fog
import sys,numpy as np; from scipy import ndimage
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
W=ROOTP+''; Q=W+'frames/critic_r15_fidelity/qa/'; R=W+'study/refs/ref_cave_lava.png'
for n,p,b,k in [('ref',R,None,1.05),('magma_fog',Q+'magma_fog.png',(380,120,1560,1000),1),('magma_fog_walk',Q+'magma_fog_walk.png',(0,120,760,1080),1)]:
  a=load(p,k,b); L,C,H=LCH(a); hot=(L>=45)&(C>=60)
  blk=ndimage.binary_opening(L<3,iterations=6)
  dfog=ndimage.distance_transform_edt(~blk); dhot=ndimage.distance_transform_edt(~hot)
  bins=[(0,6),(6,12),(12,24),(24,48),(48,96)]
  s1=' '.join(f'{a0}-{a1}:{int(np.median(L[hot&(dfog>=a0)&(dfog<a1)])) if (hot&(dfog>=a0)&(dfog<a1)).sum()>30 else "-"}' for a0,a1 in bins)
  g=~hot&~blk
  s2=' '.join(f'{a0}-{a1}:{int(np.median(L[blk&(dhot>=a0)&(dhot<a1)])) if (blk&(dhot>=a0)&(dhot<a1)).sum()>30 else "-"}' for a0,a1 in [(0,6),(6,12),(12,24),(24,48)])
  print(f'{n:15s} lava L by dist to fog: {s1} || fog L by dist to lava: {s2}')
