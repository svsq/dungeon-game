import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
import re,json,numpy as np,sys
from PIL import Image
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
B=ROOTP+'frames/'
def run(v,txt):
  rows=[]
  for l in open(txt):
    m=re.match(r'(\d+) (\{.*\})',l)
    if not m: continue
    s,j=m.group(1),json.loads(m.group(2))
    if not j.get('up'): continue
    a=np.asarray(Image.open(B+f'{v}/pool/s{s}__nohero.png').convert('RGB')).astype(float); x,y=map(int,j['up'])
    for box in (a[y-42:y+14,x-34:x-22],a[y-42:y+14,x+22:x+34]):
      L,C,H=LCH(box.reshape(-1,3)); L=L[L>6]; rows.append((np.median(L),np.percentile(L,90)))
  r=np.array(rows); print(v,'jamb strips n',len(r),'L50 med',round(np.median(r[:,0]),1),'L50 range',round(r[:,0].min(),1),round(r[:,0].max(),1),'L90 med',round(np.median(r[:,1]),1))
import os
R=ROOTP+'frames'
run('fidelity_r11',R+'/fidelity_r11/pool.txt'); run('fidelity_r14',R+'/fidelity_r14/pool.txt')
