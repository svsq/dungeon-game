import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
# brightest hero pixels (blade, steel) on the plateau: top 5 % by luminance, median and p90 RGB; G-R gap
import numpy as np; from PIL import Image
W=ROOTP+''
for n,p,b in [('zone_magma r5',W+'frames/critic_r14_fidelity/qa/zone_magma.png',(935,450,1000,540)),('zone_magma r4',W+'frames/assets_r4/zone_magma.png',(935,450,1000,540)),
              ('ref hero',W+'study/refs/ref_cave_lava.png',None)]:
  try: im=Image.open(p).convert('RGB')
  except Exception: print(n,'missing'); continue
  if b is None: continue
  a=np.asarray(im.crop(b)).reshape(-1,3).astype(int); Y=a@[0.3,0.59,0.11]; t=a[Y>=np.percentile(Y,95)]
  print(f'{n:14s} top5% med {np.median(t,0).astype(int).tolist()} p90 {np.percentile(t,90,0).astype(int).tolist()}  G>R share {100*(t[:,1]>t[:,0]+4).mean():.0f}%')
