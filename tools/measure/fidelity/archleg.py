import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
# r15: arch legs (non-lava, L>=4) on magma_arch vs the ref arch's legs; boxes for HEAD e2db68d (left leg 862-925, right 1005-1075, y 570-670)
import sys,numpy as np
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
Q=ROOTP+os.environ.get('QA','frames/critic_r15_fidelity/qa/'); R=ROOTP+'study/refs/ref_cave_lava.png'
P=lambda v:'/'.join(str(int(round(x))) for x in np.percentile(v,(10,50,90))) if v.size>30 else '-'
def st(n,p,box,k=1.0):
  a=load(p,k,box); L,C,H=LCH(a); m=~((L>=45)&(C>=60))&(L>=4)
  print(f'{n:16s} n {m.sum():6d} L {P(L[m])} C {P(C[m])} hue {P(H[m])}  red(C>=30,hue<35) {100*((C>=30)&(H<35))[m].mean():4.1f}%')
st('ref arch L leg',R,(178,300,245,390),1.05); st('ref arch R leg',R,(330,290,400,390),1.05)
st('arch L leg',Q+'magma_arch.png',(862,570,925,670)); st('arch R leg',Q+'magma_arch.png',(1005,570,1075,670))
