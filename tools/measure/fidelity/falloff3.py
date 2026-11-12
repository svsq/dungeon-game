import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
import sys,numpy as np; from scipy import ndimage
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
W=ROOTP+''; Q=W+'frames/critic_r15_fidelity/qa/'
def prof(path,box=None,k=1.0):
  a=load(path,k,box); L,C,H=LCH(a)
  lava=(L>=45)&(C>=60); lava=ndimage.binary_opening(lava,iterations=2)
  d=ndimage.distance_transform_edt(~lava); surf=(~lava)&(L>2)
  bins=[(2,8),(8,16),(16,32),(32,64),(64,96),(96,128),(128,192)]
  return ' '.join(f'{b0}-{b1}:{int(np.median(L[surf&(d>=b0)&(d<b1)])) if (surf&(d>=b0)&(d<b1)).sum()>50 else "-"}' for b0,b1 in bins)
print('ref               ',prof(W+'study/refs/ref_cave_lava.png',k=1.05))
for n in ['zone_magma','magma_hall','magma_river','magma_lake_shore','magma_terrace','magma_terrace_step','magma_cave','magma_chasm','magma_islet']:
  print(f'{n:18s}',prof(Q+n+'.png',(380,120,1560,1000)))
