import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
import numpy as np, sys
from PIL import Image
W=ROOTP+''
def st(p,box=None,k=1.0):
  im=Image.open(p).convert('RGB')
  if k!=1.0: im=im.resize((round(im.width*k),round(im.height*k)),Image.NEAREST)
  if box: im=im.crop(box)
  a=np.asarray(im).astype(int); R,G,B=a[...,0],a[...,1],a[...,2]
  hot=(R>200)
  n=hot.sum(); g=(hot&(G>235)).sum(); w=(hot&(G>235)&(B>150)).sum(); l=(hot&(G>235)&(B<=100)).sum()
  return f"hot {n:7d}  G>235 {100*g/n:5.2f}%  lemon(B<=100) {100*l/n:5.2f}%  white(B>150) {100*w/n:5.2f}%  Gp999 {int(np.percentile(G[hot],99.9))}"
print('ref whole      ',st(W+'study/refs/ref_cave_lava.png',k=1.05))
for n in ['magma_lava','magma_lake','magma_lake_shore','magma_river','magma_islet','magma_terrace']:
  print(f'{n:15s}',st(sys.argv[1]+n+'.png'))
