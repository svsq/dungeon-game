import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
# where the long (>=24 px) straight yellow runs lie: list + overlay
import sys,numpy as np; from PIL import Image, ImageDraw
n=sys.argv[1]; W=ROOTP+''
im=Image.open(W+'frames/critic_r14_fidelity/qa/'+n+'.png').convert('RGB'); a=np.asarray(im).astype(int)
s=(a[...,1]>150)&(a[...,0]>230); d=ImageDraw.Draw(im); out=[]
for y in range(120,1000):
  r=np.flatnonzero(np.diff(np.r_[0,s[y,380:1560].astype(int),0])); st,en=r[::2],r[1::2]
  for x0,x1 in zip(st,en):
    if x1-x0>=24: out.append((y,x0+380,x1-x0)); d.rectangle([x0+380,y-2,x1+380,y+2],outline=(0,255,255))
im.save(W+'frames/fidelity_r14/hruns_'+n+'.png'); print(len(out)); [print(o) for o in out[:40]]
