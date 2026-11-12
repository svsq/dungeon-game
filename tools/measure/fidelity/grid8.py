import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
# 8-px block artifact in lava: share of strong edges (|dL|>8) on the best x-phase and y-phase mod 8, over the expected 1/8
import sys,numpy as np
from PIL import Image
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
W=ROOTP+''
def run(p,box,k=1.0):
  im=Image.open(p).convert('RGB')
  if k!=1.0: im=im.resize((round(im.width*k),round(im.height*k)),Image.NEAREST)
  a=np.asarray(im.crop(box)).astype(float); h,w,_=a.shape
  L,C,H=LCH(a.reshape(-1,3)); L=L.reshape(h,w); C=C.reshape(h,w)
  red=(C>60)&(L<62)&(L>25)
  dx=np.abs(np.diff(L,axis=1)); mx=red[:,1:]&red[:,:-1]&(dx>8)
  dy=np.abs(np.diff(L,axis=0)); my=red[1:,:]&red[:-1,:]&(dy>8)
  cx=np.array([mx[:,i::8].sum() for i in range(8)]); cy=np.array([my[i::8,:].sum() for i in range(8)])
  # pixel scale 2 puts all edges on one parity: compare best phase against the mean of its own parity
  ex=lambda c: c.max()/c[np.argmax(c)%2::2].mean()
  return ex(cx),ex(cy),(cx*100/cx.sum()).round(0).astype(int).tolist(),(cy*100/cy.sum()).round(0).astype(int).tolist()
for nm,p,b,k in [('ref lake R',W+'study/refs/ref_cave_lava.png',(1150,200,1536,480),1.05),('ref lake BL',W+'study/refs/ref_cave_lava.png',(420,700,760,1000),1.05),
  ('magma_lava cols',W+'frames/critic_r14_fidelity/qa/magma_lava.png',(1140,420,1460,640),1),('magma_lava open',W+'frames/critic_r14_fidelity/qa/magma_lava.png',(760,150,1100,420),1),
  ('magma_lake',W+'frames/critic_r14_fidelity/qa/magma_lake.png',(0,150,700,1000),1),('magma_islet',W+'frames/critic_r14_fidelity/qa/magma_islet.png',(0,150,1500,1000),1)]:
  x,y,px,py=run(p,b,k); print(f'{nm:16s} best 8-px phase over its parity: x {x:.2f}  y {y:.2f}  (1.00 = no grid)  x% {px}  y% {py}')
