import sys,glob,os,numpy as np
from PIL import Image
from scipy import ndimage as nd
a,b=sys.argv[1:3]
for f in sorted(glob.glob(b+'/*.png')):
  n=os.path.basename(f); g=a+'/'+n
  if not os.path.exists(g): continue
  x=np.asarray(Image.open(g).convert('RGB')).astype(int); y=np.asarray(Image.open(f).convert('RGB')).astype(int); d=np.abs(x-y).max(-1)>8
  l,k=nd.label(nd.binary_dilation(d,iterations=8)); o=[(int((d[s]).sum()),s[1].start,s[0].start,s[1].stop,s[0].stop) for s in nd.find_objects(l)]; o.sort(reverse=True); print(n,o[:4])
