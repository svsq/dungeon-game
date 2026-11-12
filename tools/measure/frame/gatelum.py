# gatelum.py dir log (r15): L* p95 in a 220x160 box round the middle gate of each set1.js gate shot (screen = gate - cam), by phase
import sys, json, re, numpy as np
from PIL import Image
def lstar(a):
    a=a/255.; l=(a<=.04045)*a/12.92+(a>.04045)*((a+.055)/1.055)**2.4; Y=.2126*l[...,0]+.7152*l[...,1]+.0722*l[...,2]; return 116*np.cbrt(Y)-16
d,log=sys.argv[1:3]; rows={}
for l in open(log):
    m=re.match(r'(gate_\S+) (\{.*\})$',l.strip())
    if not m: continue
    I=json.loads(m[2]); x,y=int(I['gate'][0]-I['cam'][0]),int(I['gate'][1]-I['cam'][1])
    a=np.asarray(Image.open(f'{d}/{m[1]}.png').convert('RGB')).astype(float)[max(0,y-80):y+80,max(0,x-110):x+110]
    v=lstar(a); k,ph=m[1].rsplit('_',1); rows.setdefault(k,{})[ph]=round(float(np.percentile(v,95)),1)
for k,r in rows.items(): print(k,r)
