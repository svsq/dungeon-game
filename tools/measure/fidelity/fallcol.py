import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
# r15: colour of the lavafall sheet (hot pixels: L>=45, C>=50) and of the wall beside it (non-hot, L>=8) on magma_fall vs the ref's fall;
# boxes for the HEAD e2db68d frame (sheet 905-1000 x 320-480, wall left 805-870 x 345-450, right 1040-1080 x 345-450)
import sys,numpy as np
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
Q=ROOTP+os.environ.get('QA','frames/critic_r15_fidelity/qa/'); R=ROOTP+'study/refs/ref_cave_lava.png'
P=lambda v:'/'.join(str(int(round(x))) for x in np.percentile(v,(10,50,90))) if v.size>30 else '-'
def st(n,p,box,k=1.0,wall=False):
  a=load(p,k,box); L,C,H=LCH(a); hot=(L>=45)&(C>=50)
  if wall: m=~hot&(L>=8); print(f'{n:14s} wall n {m.sum():6d} L {P(L[m])} C {P(C[m])} hue {P(H[m])}'); return
  print(f'{n:14s} hot {100*hot.mean():4.0f}%  L {P(L[hot])} C {P(C[hot])} hue {P(H[hot])}  L>=75 {100*(L[hot]>=75).mean():4.1f}%  rows-mean L sd {np.std([L[y][hot[y]].mean() for y in range(L.shape[0]) if hot[y].sum()>5]):.1f}')
st('ref fall',R,(215,40,285,180),1.05)
st('magma_fall',Q+'magma_fall.png',(910,320,995,480))
st('ref wall',R,(100,40,200,200),1.05,True)
st('ref wall R',R,(300,40,380,200),1.05,True)
st('fall wall L',Q+'magma_fall.png',(805,345,870,450),1,True)
st('fall wall R',Q+'magma_fall.png',(1040,345,1080,450),1,True)
