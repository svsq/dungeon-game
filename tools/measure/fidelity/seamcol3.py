import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
# seam colour (Y-percentile pixel), seam spacing/width along rows, cell blue - inside pure-lava tiles (lavatiles.py selection)
import sys,json,numpy as np
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
T=24
def tiles(a):
  L,C,H=LCH(a); bad=((C<20)&(L>=8))|(L<5); keep=np.zeros(L.shape,bool)
  for y in range(0,L.shape[0]-T+1,T):
    for x in range(0,L.shape[1]-T+1,T):
      if bad[y:y+T,x:x+T].mean()<0.02: keep[y:y+T,x:x+T]=True
  return keep
def run(n,p,box,k):
  a=load(p,k,box); keep=tiles(a); s=(a[...,1]>110)&keep
  Y=a[...,0]*.299+a[...,1]*.587+a[...,2]*.114; sp=[];sw=[]
  for y in range(a.shape[0]):
    row=s[y]; kr=keep[y]
    if kr.sum()<T: continue
    r=np.flatnonzero(np.diff(np.r_[0,row.astype(int),0])); st,en=r[::2],r[1::2]
    sw+=list(en-st); 
    if len(st)>1: sp+=list(np.diff(st))
  sp=np.array(sp)/k; sw=np.array(sw)/k
  ys=Y[s]; o=np.argsort(ys); sc=a[s][o]
  pick=lambda q: sc[min(len(sc)-1,int(q/100*len(sc)))].astype(int).tolist()
  cells=a[keep&~s]
  r=dict(spacing50=float(np.median(sp)),seamw50=float(np.median(sw)),seamshare=round(float(s.sum()/keep.sum()),2),seam_p50=pick(50),seam_p90=pick(90),seam_p99=pick(99),
     white=round(float(((a[...,2]>100)&s).sum()/max(1,s.sum()))*100,1),cell_blue=int(np.median(cells[:,2])),cell_med=np.median(cells,0).astype(int).tolist())
  print(f'{n:20s}',json.dumps(r)); return r
W=ROOTP+''; R=W+'study/refs/ref_cave_lava.png'; Q=W+'frames/critic_r14_fidelity/qa/'
if __name__!="__main__": raise SystemExit
out={}
for n,p,b,k in [('ref lake R',R,(1150,200,1536,480),1.05),('ref lake BL',R,(420,700,760,1000),1.05),('magma_lava',Q+'magma_lava.png',(380,120,1560,1000),1),('magma_lake',Q+'magma_lake.png',(380,120,1560,1000),1),('magma_river',Q+'magma_river.png',(1050,150,1580,1000),1),('magma_islet',Q+'magma_islet.png',(0,150,1500,1000),1)]:
  out[n]=run(n,p,b,k)
json.dump(out,open(W+'frames/critic_r14_fidelity/seamcol3.json','w'),indent=1)
