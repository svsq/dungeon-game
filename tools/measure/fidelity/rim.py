import sys,os,glob,numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0,__file__.rsplit('/',1)[0])
from herosep_lab import lab
d=sys.argv[1]
for n in sorted(os.path.basename(f)[:-12] for f in glob.glob(d+'/*__nohero.png')):
  a=np.asarray(Image.open(f'{d}/{n}.png').convert('RGB')).astype(float); b=np.asarray(Image.open(f'{d}/{n}__nohero.png').convert('RGB')).astype(float)
  m=np.abs(a-b).max(-1)>24; m[:,1536:]=False
  if m.sum()<300: continue
  depth=nd.distance_transform_edt(m); ring=nd.binary_dilation(m,iterations=30)&~nd.binary_dilation(m,iterations=6)
  band=m&(depth<=3); g=np.median(lab(b[ring]),0); e=np.median(lab(a[band]),0)
  hot=m&(a[...,0]>=190)&(a[...,1]>=90)&(a[...,2]<=120)
  print(f'{n:22s} band3 dE {np.linalg.norm(e-g):5.1f}  hot {100*hot.sum()/m.sum():4.1f}% of hero, deeper than 3 px {100*(hot&(depth>3)).sum()/max(hot.sum(),1):3.0f}%')
