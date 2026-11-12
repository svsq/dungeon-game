import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
# 1059 pit rims: Lab of the 0-12 px band inside the lava edge of each pocket vs the ref's basalt round its voids; local contrast (std of L in 6 px) as "stones read or not"
import sys,numpy as np; from scipy import ndimage
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
W=ROOTP+''; Q=W+'frames/critic_r15_fidelity/qa/'; R=W+'study/refs/ref_cave_lava.png'
def stats(L,C,m):
  sd=np.sqrt(np.maximum(ndimage.uniform_filter(L*L,6)-ndimage.uniform_filter(L,6)**2,0))
  return f'n {m.sum():6d} L p50/p90 {np.percentile(L[m],50):.0f}/{np.percentile(L[m],90):.0f} C50 {np.percentile(C[m],50):.0f} localSD6 {np.median(sd[m]):.1f}'
for n,p,k in [('ref',R,1.05)]+[(n,Q+n+'.png',1) for n in ['magma_crossing','magma_lava','magma_river','magma_terrace']]:
  a=load(p,k,None if n=='ref' else (0,120,1560,1040)); L,C,H=LCH(a)
  lava=(L>=45)&(C>=60); lavad=ndimage.binary_dilation(lava,iterations=2)
  dark=ndimage.binary_opening(ndimage.uniform_filter(L,15)<6,iterations=3)
  lab_,nn=ndimage.label(dark); rims=np.zeros_like(dark)
  for i in range(1,nn+1):
    m=lab_==i
    if m.sum()<1500: continue
    d12=ndimage.binary_dilation(m,iterations=12); far=ndimage.binary_dilation(d12,iterations=18)&~d12
    if lava[far].mean()<0.4: continue
    # band between the pocket and the lava: not lava, within 14 px of lava
    near=ndimage.binary_dilation(lava,iterations=14)&~lavad&ndimage.binary_dilation(m,iterations=14)
    rims|=near
  if rims.sum()<50:
    # ref: basalt band between lava and black
    blk=ndimage.binary_opening(L<3,iterations=4)
    rims=ndimage.binary_dilation(lava,iterations=14)&~lavad&ndimage.binary_dilation(blk,iterations=14)&~blk
  print(f'{n:16s}',stats(L,C,rims))
