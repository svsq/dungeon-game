import numpy as np,sys
from PIL import Image
from scipy import ndimage as nd
F=sys.argv[1]; S=[]
for i in [40,52,60,64,66,68,70,72,74,76,78,80,84,92]:
  a=np.asarray(Image.open(f'{F}/a{i}.png').convert('RGB')).astype(int); b=np.asarray(Image.open(f'{F}/b{i}.png').convert('RGB')).astype(int)
  m=np.abs(a-b).max(-1)>24; m=nd.binary_opening(m,iterations=1); filled=nd.binary_fill_holes(m); lab,n=nd.label(m)
  hole=filled&~m; hl,hn=nd.label(hole); holes=sorted([int((hl==k).sum()) for k in range(1,hn+1)],reverse=True)[:3]
  rows=0; mx=0
  for y in range(m.shape[0]):
    xs=np.where(m[y])[0]
    if len(xs)<2: continue
    g=np.diff(xs)-1; g=g[g>0]
    if len(g) and g.max()>=3: rows+=1; mx=max(mx,int(g.max()))
  print(i,'px',int(m.sum()),'comps',n,'largest holes',holes,'rows with gap>=3',rows,'maxgap',mx)
