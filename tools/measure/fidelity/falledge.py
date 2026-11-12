import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
# lavafall sheet: per-row left/right edge (first/last hot pixel, L>=45&C>=50) -> edge std and width change top->bottom; colour of the edge band
import sys,numpy as np
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
W=ROOTP+''; R=W+'study/refs/ref_cave_lava.png'; Q=W+'frames/critic_r15_fidelity/qa/'
for n,p,b,k in [('ref fall',R,(195,20,300,190),1.05),('terrace fall L',Q+'magma_terrace.png',(1040,180,1160,315),1),('terrace fall R',Q+'magma_terrace.png',(1240,180,1400,315),1),('magma_fall',Q+'magma_fall.png',(920,345,990,480),1),('magma_fall wide',Q+'magma_fall.png',(880,310,1040,480),1)]:
  a=load(p,k,b); L,C,H=LCH(a); hot=(L>=45)&(C>=50); le=[];re=[];ec=[]
  for y in range(a.shape[0]):
    xs=np.flatnonzero(hot[y])
    if len(xs)>5: le.append(xs[0]); re.append(xs[-1]); ec+= [a[y,xs[0]],a[y,xs[-1]]]
  le=np.array(le); re=np.array(re); w=re-le; ec=np.array(ec); Le,Ce,He=LCH(ec)
  dle=np.abs(np.diff(le)); 
  print(f'{n:15s} rows {len(le)} leftEdge std {le.std():.1f} mean|step| {dle.mean():.2f}  width top/bot {int(np.median(w[:len(w)//4]))}/{int(np.median(w[-len(w)//4:]))}  edge C p10 {int(np.percentile(Ce,10))} edge med {np.median(ec,0).astype(int).tolist()}')
