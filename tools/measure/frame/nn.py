import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
from PIL import Image; import numpy as np; from scipy import ndimage as nd
def lstar(a):
    a=a/255.; l=(a<=.04045)*a/12.92+(a>.04045)*((a+.055)/1.055)**2.4; Y=.2126*l[...,0]+.7152*l[...,1]+.0722*l[...,2]; return 116*np.cbrt(Y)-16
def st(name,a,minS,sc=1):
    v=lstar(a.astype(float)); lab,n=nd.label(nd.binary_opening(v<30,iterations=2)); idx=[i for i in range(1,n+1) if (lab==i).sum()>minS]
    c=np.array(nd.center_of_mass(lab>0,lab,idx)); D=np.hypot(*(c[:,None]-c[None]).transpose(2,0,1)); np.fill_diagonal(D,1e9); d=D.min(1)
    w=[(np.ptp(np.where((lab==i).any(0))[0])+1) for i in idx]; h=[(np.ptp(np.where((lab==i).any(1))[0])+1) for i in idx]
    print(name,'n',len(idx),'NN p50 %.0f cv %.2f'%(np.median(d),d.std()/d.mean()),'w p25/75 %d/%d'%tuple(np.percentile(w,[25,75])),'h p25/75 %d/%d'%tuple(np.percentile(h,[25,75])))
R=Image.open(ROOTP+'study/refs/ref_cave_lava.png').convert('RGB').resize((1920,1280),Image.NEAREST)
st('ref@1.25',np.array(R)[160:600,1300:1920],350)
for n in ['lake_7f14','lake_14f15','lake_21f15','lake_28f15','lake_70f14','lake_84f15']: st(n,np.array(Image.open(n+'.png').convert('RGB'))[280:800,450:1450],350)
