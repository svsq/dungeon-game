import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
import sys,numpy as np
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
W=ROOTP+''; Q=W+'frames/critic_r14_fidelity/qa/'
for n,b in [('magma_river',(885,628,945,705)),('zone_magma',(935,450,985,540))]:
  a=load(Q+n+'.png',1,b).reshape(-1,3); L,C,H=LCH(a)
  lava=(C>=60)&(L>=40)&(H>25)&(H<70); s=~lava&(L>3); a2=a[s]; L,C,H=L[s],C[s],H[s]
  yel=(H>65)&(H<100)&(C>35)&(L>55); lemon=(a2[:,1]>a2[:,0])&(C>20); khaki=(H>70)&(H<110)&(C>12)&(L<60)&(L>20)
  print(n,'n',s.sum(),'yellow%',round(yel.mean()*100,1),'lemon%',round(lemon.mean()*100,1),'khaki%',round(khaki.mean()*100,1),'neutral(C<10)%',round((C<10).mean()*100,1),'med',np.median(a2,0).astype(int).tolist())
