import os, sys, json, re, numpy as np
from PIL import Image
from scipy import ndimage
# shore_offset.py dir log: for every cell edge between floor (1) and lava (3) on the view, how far painted lava passes the logical edge: + into the floor cell, - short of it; px along the normal at the edge's middle; lava cell centre/floor cell centre flips
d, log = sys.argv[1:3]; T=32; off=[]; ctr=[0,0,0,0]; worst=[]
info={}
for l in open(log):
    m=re.match(r'(\S+) (\{.*\})$', l.strip())
    if m: info[m[1]]=json.loads(m[2])
for n,I in sorted(info.items()):
    a=np.asarray(Image.open(f'{d}/{n}.png').convert('RGB')).astype(int); R,B=a[...,0],a[...,2]
    lv=ndimage.binary_opening(ndimage.binary_closing((R>=150)&(R-B>=100),iterations=3),iterations=2)
    ur=I.get('under','').split('/'); rows=[''.join('u' if ur and j<len(ur) and i<len(ur[j]) and ur[j][i]=='u' and c=='1' else c for i,c in enumerate(r)) for j,r in enumerate(I['cells'].split('/'))]; h=len(rows); z=I.get('zoom') or 1; T=32*z; hs=T/2
    for j,row in enumerate(rows):
        for i,ch in enumerate(row):
            if ch not in '13': continue
            cx,cy=(i+.5)*T,(j+.5)*T
            if not (40<=cx<1500 and 40<=cy<1020) or (cx<400 and cy<280): continue
            ctr[0 if ch=='1' else 2]+=1
            v=lv[int(cy),int(cx)]
            if ch=='1' and v: ctr[1]+=1
            if ch=='3' and not v: ctr[3]+=1
            if ch!='1': continue
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                u,w=i+dx,j+dy
                if not (0<=w<h and 0<=u<len(rows[w])) or rows[w][u]!='3': continue
                ex,ey=cx+dx*hs,cy+dy*hs
                # walk from the floor centre (-16) towards the lava centre (+16): first lava px
                first=None
                for s in range(-int(hs),int(hs)+1):
                    X,Y=int(ex+dx*s),int(ey+dy*s)
                    if 0<=Y<lv.shape[0] and 0<=X<lv.shape[1] and lv[Y,X]: first=s; break
                if first is None: continue
                # + = lava enters the floor cell
                o=-first; off.append(o)
                if o>=12: worst.append((o,n,int(ex),int(ey),dx,dy,i,j))
o=np.array(off)
print('edges',len(o),'p5,p50,p95',np.percentile(o,[5,50,95]),'mean',o.mean().round(2))
print('share lava into floor >=8px',round((o>=8).mean()*100,1),'>=12',round((o>=12).mean()*100,1),'>=16',round((o>=16).mean()*100,1),'| short of edge >=8',round((o<=-8).mean()*100,1),'>=12',round((o<=-12).mean()*100,1))
print('floor cells centre painted lava',ctr[1],'of',ctr[0],'| lava cells centre painted ground',ctr[3],'of',ctr[2])
print('worst',sorted(worst,reverse=True)[:12])
import random; random.seed(7); sm=random.sample(worst,min(12,len(worst))); json.dump(sm,open(os.path.join(os.path.dirname(log),'worst.json'),'w'))
