import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
# vertical L profile down a column face; reports biggest single-row L jump (hard band edge) vs ref
import sys,numpy as np
from PIL import Image
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
W=ROOTP+''
def prof(p,x0,x1,y0,y1,k=1.0):
  im=Image.open(p).convert('RGB')
  if k!=1.0: im=im.resize((round(im.width*k),round(im.height*k)),Image.NEAREST)
  a=np.asarray(im).astype(float)[y0:y1,x0:x1]
  L=np.array([np.median(LCH(r)[0]) for r in a]); C=np.array([np.median(LCH(r)[1]) for r in a])
  d=np.abs(np.diff(L)); i=int(d.argmax())
  return L,C,d.max(),y0+i+1
for nm,p,b,k in [('ref col A',W+'study/refs/ref_cave_lava.png',(1096,1110,410,445),1.05),('ref col B',W+'study/refs/ref_cave_lava.png',(1146,1162,436,462),1.05),
  ('ref col C',W+'study/refs/ref_cave_lava.png',(1200,1218,455,485),1.05),
  ('magma_lava 1195',W+'frames/critic_r14_fidelity/qa/magma_lava.png',(1190,1205,440,520),1),('magma_lava 1265',W+'frames/critic_r14_fidelity/qa/magma_lava.png',(1258,1272,450,520),1),
  ('magma_lava 1360',W+'frames/critic_r14_fidelity/qa/magma_lava.png',(1352,1368,540,600),1),('magma_lava 1440',W+'frames/critic_r14_fidelity/qa/magma_lava.png',(1428,1446,525,600),1)]:
  L,C,dm,yy=prof(p,b[0],b[1],b[2],b[3],k)
  n=len(L); q=[int(round(L[int(n*f/5):int(n*(f+1)/5)].mean())) for f in range(5)]; c=[int(round(C[int(n*f/5):int(n*(f+1)/5)].mean())) for f in range(5)]
  print(f'{nm:16s} L by fifths {q}  C {c}  max row jump dL {dm:.0f} at y {yy}')
