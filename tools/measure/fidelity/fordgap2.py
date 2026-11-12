import sys,numpy as np
from PIL import Image
# fordgap2.py: lava-pixel runs between slabs along horizontal and vertical probe lines; slab = R<100, hot = R>=170 (dimmed underside band counts as not lava)
def runs(v):
  out=[];i=0;n=len(v)
  while i<n:
    if v[i]==2:
      j=i
      while j<n and v[j]==2: j+=1
      out.append((i,j-i)); i=j
    else: i+=1
  return out
a=np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(int)
def cls(p):
  r=p[...,0]; return np.where(r<100,0,np.where(r>=170,2,1))
for spec in sys.argv[2:]:
  o,c,s,e=spec.split(':'); c,s,e=int(c),int(s),int(e)
  seg=a[c,s:e] if o=='h' else a[s:e,c]; v=cls(seg); 
  # gaps: lava run bounded by slab within 4px on both sides
  rs=[];
  for i,w in runs(v.tolist()):
    l=(v[max(0,i-4):i]==0).any(); r=(v[i+w:i+w+4]==0).any()
    if l and r: rs.append((s+i,w))
  print(o,c,(s,e),'bounded lava runs',rs)
