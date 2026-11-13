import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
import sys,numpy as np
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
W=ROOTP+''; R=W+'study/refs/ref_cave_lava.png'; Q=W+'frames/critic_r15_fidelity/qa/'
def cats(p,box=None,k=1.0):
  a=load(p,k,box).reshape(-1,3); L,C,H=LCH(a)
  pp=lambda v:[int(x) for x in np.percentile(v,[10,25,50,75,90])]; sh=lambda m: round(float(m.mean())*100)
  lava=(L>=45)&(C>=60)
  return dict(L=pp(L),black=sh(L<5),basalt=sh((L>=5)&(L<35)&(C<18)),basalt_any=sh((L>=5)&(C<18)),warmdark=sh((L>=5)&(L<45)&(C>=18)&~lava),lava=sh(lava),seam=sh((L>=75)&(C>=40)),litgray=sh((L>=35)&(C<18)))
print('ref whole      ',cats(R))
print('ref lake R     ',cats(R,(1150,200,1536,480)))
print('ref lake BL    ',cats(R,(420,700,760,1000)))
B=(380,120,1560,1000)
for n in ['zone_magma','magma_hall','magma_lake','magma_lake_shore','magma_river','magma_chasm','magma_terrace','magma_terrace_step','magma_lava','magma_fall','magma_arch','magma_islet']:
  print(f'{n:15s}',cats(Q+n+'.png',B))
print('--- lake-only')
for n,b in [('magma_lava',(760,150,1560,700)),('magma_lake',(0,150,700,1000)),('magma_lake',(1150,560,1560,1000)),('magma_lake_shore',(0,600,760,1080))]:
  print(f'{n:15s}{b}',cats(Q+n+'.png',b))
