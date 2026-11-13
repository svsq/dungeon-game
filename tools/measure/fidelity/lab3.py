import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
# r1/r2 lab.py metric (same stats, ref boxes of r1), our boxes re-picked on the r3 frames (layouts changed)
import sys,json,numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
W=ROOTP+''; REF=W+'study/refs/ref_cave_lava.png'; Q=W+'frames/critic_r15_fidelity/qa/'
def px(path,boxes,mask=None):
  im=np.asarray(Image.open(path).convert('RGB')).astype(float)
  a=np.concatenate([im[y0:y1,x0:x1].reshape(-1,3) for x0,y0,x1,y1 in boxes])
  if mask=='nolava':
    L,C,H=LCH(a); a=a[~((L>=45)&(C>=60))]
  return a
def st(a):
  L,C,H=LCH(a); p=lambda v,q:[int(round(x)) for x in np.percentile(v,q)]
  Y=a[:,0]*0.299+a[:,1]*0.587+a[:,2]*0.114
  return dict(n=len(a),Y=p(Y,[10,50,90]),L=p(L,[10,50,90]),C=p(C,[10,50,90]),hue50=int(np.median(H[C>3])) if (C>3).any() else 0,RGB50=np.median(a,0).astype(int).tolist(),
    violet=round(float(((H>270)|(H<10)&(C>2)).mean()*100)), hot70=round(float((L>=70).mean()*100)))
REG={
 'floor':   {'ref':[(REF,[(640,400,700,435),(720,400,800,435),(700,530,780,565),(820,285,900,320)])],
             'ours':[(Q+'zone_magma.png',[(560,420,700,470),(820,560,960,620),(1140,320,1260,380),(720,640,860,700)])]},
 'lava':    {'ref':[(REF,[(1140,380,1180,405),(1180,400,1220,425),(600,705,650,740),(300,515,335,545),(1210,300,1260,330)])],
             'ours':[(Q+'magma_lava.png',[(830,420,940,520),(1000,180,1080,240),(1220,650,1300,700)])]},
 'captops': {'ref':[(REF,[(1085,395,1125,415),(1135,425,1170,440),(1050,383,1075,395)])],
             'ours':[(Q+'magma_lava.png',[(1160,428,1210,445),(1290,508,1320,520),(1345,526,1380,540)])]},
 'colfaces':{'ref':[(REF,[(1090,418,1116,432),(1142,442,1166,454)])],
             'ours':[(Q+'magma_lava.png',[(1170,460,1200,500),(1300,535,1330,570),(1360,550,1390,575)])]},
 'arch_top':{'ref':[(REF,[(190,250,300,280)])],'ours':[(Q+'magma_islet.png',[(100,615,200,640)])]},
 'arch_legs':{'ref':[(REF,[(178,320,245,380)])],'ours':[(Q+'magma_islet.png',[(55,670,100,730)])]},
 'slabs':   {'ref':[(REF,[(1085,395,1125,415),(1135,425,1170,440)])],'ours':[(Q+'magma_islet.png',[(1180,280,1300,600)],'nolava')]},
 'islet_floor':{'ref':[(REF,[(640,400,700,435),(720,400,800,435)])],'ours':[(Q+'magma_islet.png',[(935,470,1000,488)])]},
 'chasm':   {'ref':[(REF,[(1030,560,1080,600),(40,560,100,640)])],'ours':[(Q+'magma_chasm.png',[(100,400,330,900)])]},
}
out={}; sheet=[]
for name,d in REG.items():
  for side in ('ref','ours'):
    a=np.concatenate([px(*e) if len(e)==3 else px(e[0],e[1]) for e in d[side]]); out[name+'/'+side]=st(a)
    for e in d[side]:
      im=Image.open(e[0]).convert('RGB')
      for bb in e[1]: sheet.append((name+'/'+side,im.crop(bb)))
  print(f'{name:12s} ref ',json.dumps(out[name+'/ref'])); print(f'{name:12s} ours',json.dumps(out[name+'/ours']))
x=y=rowh=0; canvas=Image.new('RGB',(1800,2400),(255,0,255)); d=ImageDraw.Draw(canvas)
for lab_,c in sheet:
  c=c.resize((c.width*2,c.height*2),Image.NEAREST)
  if x+c.width>1800: x=0;y+=rowh+16;rowh=0
  canvas.paste(c,(x,y+12)); d.text((x,y),lab_,fill=(255,255,255)); x+=c.width+6; rowh=max(rowh,c.height+12)
canvas.crop((0,0,1800,y+rowh+16)).save(W+'frames/fidelity_r14/boxes.png')
json.dump(out,open(W+'frames/critic_r15_fidelity/lab3.json','w'),indent=1)
