import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
import sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
W=ROOTP+''
TOL=2
def edgeok(o,c,s,e,sh,xo=0,yo=0):
  H,W=sh
  if o=='H':
    return 12<=c<H-12 and not (xo+s<115 and yo+c<260)
  return 12<=c<W-12 and not (xo+c<115 and yo+s<260)
def mask(a):
  m=(a[...,0]>=150)&(a[...,0]-a[...,2]>=100)
  m=nd.binary_closing(m,iterations=4); m=nd.binary_fill_holes(m); return nd.binary_opening(m,iterations=3)
def runs(E):
  out=[]; H,Wd=E.shape
  band=np.array([E[max(0,y-TOL):y+TOL+1].any(0) for y in range(H)])
  for y in range(H):
    x=0
    while x<Wd:
      if band[y,x]:
        s=x
        while x<Wd and band[y,x]: x+=1
        if x-s>=48: out.append((x-s,y,s,x))
      else: x+=1
  out.sort(reverse=True); kept=[]; used=np.zeros(E.shape,bool)
  for r in out:
    l,y,s,e=r
    if used[max(0,y-6):y+7,s:e].mean()>0.4: continue
    kept.append(r); used[max(0,y-6):y+7,s:e]=True
  return kept
def side(L,y,s,e,hor,inv):
  return 0
def analyze(path,k=1,box=None):
  im=Image.open(path).convert('RGB')
  if k!=1: im=im.resize((round(im.width*k),round(im.height*k)),Image.NEAREST)
  a=np.asarray(im).astype(int)
  if box: a=a[box[1]:box[3],box[0]:box[2]]
  m=mask(a); lum=a.sum(-1)
  Eh=m[:-1,:]!=m[1:,:]; Ev=m[:,:-1]!=m[:,1:]
  ox,oy=(box[0],box[1]) if box else (0,0)
  H=[(l,'H',y,s,e) for l,y,s,e in runs(Eh) if edgeok('H',y,s,e,a.shape[:2],ox,oy)]; V=[(l,'V',x,s,e) for l,x,s,e in runs(Ev.T) if edgeok('V',x,s,e,a.shape[:2],ox,oy)]
  res=[]
  for l,o,c,s,e in H+V:
    dark=0
    # outside darkness: over the non-lava side at 10..24 px: is it fog-black?
    if o=='H':
      for sgn in (-1,1):
        yy=c+sgn*12
        if 0<=yy<a.shape[0]:
          if not m[yy,(s+e)//2]: dark=lum[max(0,min(yy,yy+sgn*12)):max(yy,yy+sgn*12)+1,s:e].mean()
    else:
      for sgn in (-1,1):
        xx=c+sgn*12
        if 0<=xx<a.shape[1]:
          if not m[(s+e)//2,xx]: dark=lum[s:e,max(0,min(xx,xx+sgn*12)):max(xx,xx+sgn*12)+1].mean()
    res.append((l,o,c,s,e,round(float(dark),0)))
  total=int(Eh.sum()+Ev.sum())
  long=[r for r in res if r[0]>64]; shore=[r for r in long if r[5]>=20]
  name=path.rsplit('/',1)[1]
  print(f'{name:28s} lava {100*m.mean():4.1f}%  edge {total:6d}px  runs>64: {len(long):3d} (non-black side {len(shore):3d})  max {max([r[0] for r in res],default=0):4d}  share of edge in runs>64 {100*sum(r[0] for r in long)/max(total,1):4.1f}%')
  return res
if __name__=='__main__':
  args=sys.argv[1:]; show='--list' in args; args=[x for x in args if x!='--list']
  for s in args:
    p,*r=s.split(':'); k=float(r[0]) if r and r[0] else 1; b=list(map(int,r[1].split(','))) if len(r)>1 else None
    res=analyze(p,k,b)
    if show:
      for q in res[:12]: print('   ',q)
