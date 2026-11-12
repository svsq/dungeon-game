import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
# vertical profile of a column face, top (under the cap) to foot: median RGB, L, C per 1/5 of the height
import sys,numpy as np
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
W=ROOTP+''; R=W+'study/refs/ref_cave_lava.png'; Q=W+'frames/critic_r14_fidelity/qa/'
for n,p,(x0,y0,x1,y1) in [('ref col 1320',R,(1318,252,1342,335)),('ref col 1440',R,(1418,445,1450,520)),('ref col 1120',R,(1100,420,1125,470)),('ref arch leg',R,(185,310,235,390)),
  ('ours lava 1185',Q+'magma_lava.png',(1172,450,1198,505)),('ours lava 1315',Q+'magma_lava.png',(1302,525,1328,575)),('ours lake shore',Q+'magma_lake_shore.png',(410,700,440,760))]:
  a=np.asarray(Image.open(p).convert('RGB')).astype(float)[y0:y1,x0:x1]; h=a.shape[0]; s=[]
  for i in range(5):
    b=a[i*h//5:(i+1)*h//5].reshape(-1,3); L,C,H=LCH(b); s.append(f'{np.median(b,0).astype(int).tolist()} L{int(np.median(L))} C{int(np.median(C))}')
  print(f'{n:16s}',' | '.join(s))
