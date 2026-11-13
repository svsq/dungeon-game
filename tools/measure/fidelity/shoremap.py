import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
import sys,re,json,numpy as np
from PIL import Image
from scipy import ndimage as nd
F=ROOTP+'frames/critic_r15_fidelity/'; M=F
def hot(a):
  m=(a[...,0]>=205)&(a[...,1]>=55)&(a[...,2]<=120); m=nd.binary_closing(m,iterations=3); return nd.binary_opening(m,iterations=2)
def load(v):
  R={}
  for l in open(M+f'shoremap_{v}.txt'):
    m=re.match(r'(\S+) (\{.*\})$',l.strip())
    if m: R[m.group(1)]=json.loads(m.group(2))
  return R
# r15: ui box is HUD B (bottom panel, hint bar, minimap with its legend)
def one(v,n,j):
  a=np.asarray(Image.open(F+f'shoremap_{v}/{n}.png').convert('RGB')).astype(int); H,W=a.shape[:2]
  cx,cy=j['cam']; cat=np.array(j['cat']).reshape(j['H'],j['W'])
  X,Y=np.meshgrid(np.arange(W),np.arange(H)); tx=np.floor((X+cx)/32).astype(int); ty=np.floor((Y+cy)/32).astype(int)
  ok=(tx>=0)&(ty>=0)&(tx<j['W'])&(ty<j['H']); C=np.full((H,W),-1); C[ok]=cat[ty[ok],tx[ok]]
  ui=(X<390)&(Y<310)|(X>1520)&(Y<670)|(X>280)&(X<1640)&(Y>940)|(X>1010)&(Y>880); hm=hot(a)&~ui
  walk=(C==1)&~ui; lava=C==3
  L,k=nd.label(hm); keep=np.unique(L[hm&lava]); hm=np.isin(L,keep[keep>0])
  if len(sys.argv)>1 and v=='new' and n==sys.argv[1]: Image.fromarray(((hm&walk)*255).astype('uint8')).save(F+'z_map_'+n+'.png')
  d=nd.distance_transform_edt(~lava); ins=hm&walk; n_w=walk.sum()
  dep=d[ins] if ins.sum() else np.array([0.])
  # cells of floor actually touching lava
  near=walk&(d<=32)
  # signed: which floor sides overshoot, north bank (lava south of floor) vs south
  return dict(n=n,floorpx=int(n_w),hotonfloor=int(ins.sum()),pct=round(100*ins.sum()/max(near.sum(),1),2),p90=round(float(np.percentile(dep,90)),1),p99=round(float(np.percentile(dep,99)),1),mx=round(float(dep.max()),1),over8=int((d[ins]>8).sum()),over16=int((d[ins]>16).sum()))
res={}
for v in ('base','new'):
  R=load(v); res[v]={}
  for n,j in R.items():
    try: res[v][n]=one(v,n,j)
    except Exception as e: print('err',v,n,e)
print(f"{'state':20s} | hot on floor near lava %: base new | depth p90 base new | p99 base new | max base new | px>8 base new | px>16 base new")
agg={'base':[],'new':[]}
for n in res['new']:
  a=res['base'].get(n); b=res['new'][n]
  if a is None: print(n,'no base',b); continue
  print(f"{n:20s} | {a['pct']:6.2f} {b['pct']:6.2f} | {a['p90']:5.1f} {b['p90']:5.1f} | {a['p99']:5.1f} {b['p99']:5.1f} | {a['mx']:5.1f} {b['mx']:5.1f} | {a['over8']:6d} {b['over8']:6d} | {a['over16']:6d} {b['over16']:6d}")
  agg['base'].append(a); agg['new'].append(b)
for v in agg:
  x=agg[v]
  if x: print(v,'n',len(x),'median pct',np.median([q['pct'] for q in x]),'sum>8',sum(q['over8'] for q in x),'sum>16',sum(q['over16'] for q in x),'max',max(q['mx'] for q in x))
