import sys,glob,os,numpy as np
from PIL import Image
a,b=sys.argv[1:3]
for f in sorted(glob.glob(b+'/*.png')):
  n=os.path.basename(f); g=a+'/'+n
  if not os.path.exists(g): print(n,'no base'); continue
  x=np.asarray(Image.open(g).convert('RGB')).astype(int); y=np.asarray(Image.open(f).convert('RGB')).astype(int); d=np.abs(x-y).max(-1)
  print(f'{n:26s} >0: {(d>0).sum():7d}  >8: {(d>8).sum():7d}  >24: {(d>24).sum():7d}')
