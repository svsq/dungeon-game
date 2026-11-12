import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
import sys,re,json,numpy as np
from PIL import Image
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
F=ROOTP+'frames/fidelity_r14/pool/'
for l in open(ROOTP+'frames/fidelity_r14/pool.txt'):
  m=re.match(r'(\d+) (\{.*\})',l)
  if not m: continue
  s,j=m.group(1),json.loads(m.group(2)); a=np.asarray(Image.open(F+f's{s}__nohero.png').convert('RGB')).astype(float)
  box=a[60:1040,420:1500]; L,C,H=LCH(box.reshape(-1,3)); hot=(L>=40)&(C>=60)&(H>25)&(H<80)
  # straight shore: longest vertical/horizontal lava-to-dark step line in the box
  lm=(box[...,0]>=170); h,w=lm.shape; dv=lm[:,1:]^lm[:,:-1]; dh=lm[1:]^lm[:-1]
  def longest(d,ax):
    best=0
    for line in (d.T if ax==0 else d):
      c=m_=0
      for v in line:
        c=c+1 if v else 0; m_=max(m_,c)
      best=max(best,m_)
    return best
  st=''
  if j.get('up'):
    x,y=j['up']; x=int(x);y=int(y); st_box=a[y-36:y+20,x-34:x+34]; L2,C2,_=LCH(st_box.reshape(-1,3)); li=L2>6; st=f"stairs L50 {np.median(L2[li]):.1f} L90 {np.percentile(L2[li],90):.1f} C50 {np.median(C2[li]):.1f} C90 {np.percentile(C2[li],90):.1f}"
  print(s,'lava%',round(hot.mean()*100,2),'lavaCells',j['lavaSeen'],'range',j['rx'],j['ry'],'vertRun',longest(dv,0),'horizRun',longest(dh,1),st)
