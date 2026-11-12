import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
# r15: stepping slabs (non-lava, L>=4) on a terrace bend (frames/critic_r15_fidelity/bend/bend_s77_f15.png from tools/measure/frame/bend.js)
# and on magma_terrace vs the ref's stepping stumps (tops and faces); boxes for HEAD e2db68d
import sys,numpy as np
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
F=ROOTP+'frames/critic_r15_fidelity/'; R=ROOTP+'study/refs/ref_cave_lava.png'
P=lambda v:'/'.join(str(int(round(x))) for x in np.percentile(v,(10,50,90))) if v.size>30 else '-'
def st(n,p,box,k=1.0):
  a=load(p,k,box); L,C,H=LCH(a); m=~((L>=45)&(C>=60))&(L>=4)
  print(f'{n:18s} n {m.sum():6d} share {100*m.mean():3.0f}% L {P(L[m])} C {P(C[m])} hue {P(H[m])}  cool(hue>180) {100*(H[m]>180).mean():3.0f}%')
st('ref stumps',R,(1080,385,1290,470),1.05)
st('ref stumps BR',R,(1120,440,1290,500),1.05)
st('bend s77 rows',F+'bend/bend_s77_f15.png',(390,465,1000,520))
st('terrace slabs',F+'qa/magma_terrace.png',(1040,560,1560,700))
