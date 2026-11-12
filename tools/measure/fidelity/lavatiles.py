import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
# pure-lava tiles (no basalt grey, no black) -> lava material stats and large-scale pattern
import sys,json,numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
T=24
def run(name,p,box,k,vis):
  a=load(p,k,box); L,C,H=LCH(a)
  bad=((C<20)&(L>=8))|(L<5)
  hgt,wid=L.shape; keep=np.zeros_like(L,bool); tm=[]
  im=Image.fromarray(a.astype(np.uint8)); d=ImageDraw.Draw(im)
  for y in range(0,hgt-T+1,T):
    for x in range(0,wid-T+1,T):
      if bad[y:y+T,x:x+T].mean()<0.02: keep[y:y+T,x:x+T]=True; tm.append(L[y:y+T,x:x+T].mean()); d.rectangle([x,y,x+T-1,y+T-1],outline=(0,255,255))
  im.save(vis)
  Lk=L[keep]; Ck=C[keep]
  # blur-12 sigma inside kept tiles (normalised conv)
  m=keep.astype(float); Lb=ndimage.uniform_filter(L*m,25)/np.maximum(ndimage.uniform_filter(m,25),1e-6)
  inner=ndimage.binary_erosion(keep,iterations=12)
  sig=float(Lb[inner].std()) if inner.sum()>200 else float('nan')
  dark=(L<35)&keep; lab_,n=ndimage.label(dark); sz=np.bincount(lab_.ravel())[1:] if n else np.array([0])
  pep=int(((sz>=1)&(sz<=4)).sum())
  p=lambda v,q: [int(round(x)) for x in np.percentile(v,q)]
  r=dict(tiles=len(tm),Lp=p(Lk,[10,50,90]),Cp=p(Ck,[10,50,90]),sigL12=round(sig,1),sigTile=round(float(np.std(tm)),1),
    dark35=round(float(dark.sum()/keep.sum())*100,1),blob_p90=int(np.percentile(sz,90)),blob_max=int(sz.max()),pepper_per1000=round(pep/keep.sum()*1000,2),
    blue_med=int(np.median(a[keep][:,2])))
  print(f'{name:22s}',json.dumps(r)); return r
if __name__=='__main__':
  W=ROOTP+''; R=W+'study/refs/ref_cave_lava.png'; Q=W+'frames/critic_r14_fidelity/qa/'; F=W+'frames/critic_r14_fidelity/'
  jobs=[('ref lake R',R,(1150,200,1536,480),1.05),('ref lake BL',R,(420,700,760,1000),1.05)]
  for n,b in [('magma_lava',(380,120,1560,1000)),('magma_lake',(380,120,1560,1000)),('magma_lake_shore',(0,560,760,1080)),('magma_river',(1050,150,1580,1000)),('magma_terrace_step',(380,120,1560,1000)),('magma_islet',(0,150,1500,1000))]:
    jobs.append((n,Q+n+'.png',b,1.0))
  out={}
  for n,p,b,k in jobs: out[n]=run(n,p,b,k,F+'tiles_'+n.replace(' ','_')+'.png')
  json.dump(out,open(W+'frames/critic_r14_fidelity/lavatiles.json','w'),indent=1)
