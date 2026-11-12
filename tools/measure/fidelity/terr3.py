import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
import sys,numpy as np
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
W=ROOTP+''; Q=W+'frames/critic_r14_fidelity/qa/'
for n in ['magma_terrace_step','magma_terrace']:
  a=load(Q+n+'.png',1,(380,120,1560,1000)); L,C,H=LCH(a)
  floor=(L>4)&~((L>=45)&(C>=60))&(L<45)
  print(n,' '.join(f'{120+y}:{int(np.median(L[y:y+90][floor[y:y+90]]))}' for y in range(0,880,90)))
