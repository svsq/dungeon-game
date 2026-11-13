import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
import sys,numpy as np; from scipy import ndimage as nd
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
W=ROOTP+''; Q=sys.argv[1]; R=W+'study/refs/ref_cave_lava.png'
P=lambda v,q=(10,50,90):'/'.join(str(int(round(x))) for x in np.percentile(v,q)) if v.size>50 else '-'
def go(name,p,box,k=1.0):
  a=load(p,k,box); L,C,H=LCH(a)
  lava=(L>=45)&(C>=60); body=nd.binary_closing(lava,iterations=3)&nd.binary_opening(nd.binary_closing(lava,iterations=6),iterations=6)
  inb=body&~lava
  sd=np.sqrt(np.maximum(nd.uniform_filter(L*L,5)-nd.uniform_filter(L,5)**2,0))
  hot=(L>=75)
  # basalt = neutral stone not lava
  bas=(L>=5)&(L<40)&(C<20)
  near=nd.binary_dilation(lava,iterations=10)&~lava
  print(f'{name:18s} lavaL {P(L[lava])} lavaC {P(C[lava])} hue {P(H[lava])} | in-lava dark {inb.sum()/max(body.sum(),1)*100:4.1f}% hot/lava {hot[lava].mean()*100:4.1f}% sd5 lava {np.median(sd[lava]):.1f} | basaltL {P(L[bas])} basaltC50 {np.median(C[bas]):.0f} hue {int(np.median(H[bas&(C>3)]))} sd5 {np.median(sd[bas]):.1f} | rim(0-10px) L {P(L[near])} C50 {np.median(C[near]):.0f}')
go('ref',R,None,1.05)
go('ref lakeR',R,(1150,200,1536,480),1.05)
B=(380,200,1560,1000)
for n in ['zone_magma','magma_lake','magma_lava','magma_lake_shore','magma_river','magma_terrace','magma_islet','magma_crossing','magma_slabs','magma_cave','magma_fall','magma_bridge','magma_hall']:
  go(n,Q+n+'.png',B)
