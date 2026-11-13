import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
import numpy as np
from PIL import Image
def lab(a):
    c=a/255.; c=np.where(c<=0.04045,c/12.92,((c+0.055)/1.055)**2.4); M=np.array([[.4124,.3576,.1805],[.2126,.7152,.0722],[.0193,.1192,.9505]]); x=c@M.T/np.array([.9505,1,1.089])
    f=np.where(x>0.008856,np.cbrt(x),7.787*x+16/116); return np.dstack([116*f[...,1]-16,500*(f[...,0]-f[...,1]),200*(f[...,1]-f[...,2])])
B=ROOTP+'frames/fidelity_r14/spots/'
im=lambda n: np.asarray(Image.open(B+n+'.png').convert('RGB')).astype(float)
Y,X=np.mgrid[0:1080,0:1920]
for cy in (540,):
    r=np.hypot((X-960),(Y-cy)/0.72 if False else (Y-cy))
    for n in ['sanct_live','sanct_ready','sanct_used']:
        a=im(n); l=lab(a); C=np.hypot(l[...,1],l[...,2]); h=np.degrees(np.arctan2(l[...,2],l[...,1]))%360
        rim=(r>48)&(r<76); inn=r<44
        for name,m in (('rim',rim),('inner',inn)):
            p=a[m]; t=l[m,0]>=np.percentile(l[m,0],90)
            print(n,name,'L50',round(float(np.median(l[m,0])),1),'L90',round(float(np.percentile(l[m,0],90)),1),'C50',round(float(np.median(C[m])),1),'hue50',round(float(np.median(h[m]))),'top10 rgb',[int(v) for v in np.median(p[t],axis=0)],'hue',round(float(np.median(h[m][t]))))
a0=im('islet_idle'); a1=im('islet_rocks'); l0=lab(a0)[...,0]; l1=lab(a1)[...,0]
reg=(np.abs(X-960)<340)&(np.abs(Y-540)<220)
d=np.abs(a1-a0).sum(axis=2); m=(d>70)&reg
print('islet diff px',int(m.sum()),'L idle p50',round(float(np.median(l0[m])),1),'L warn p50',round(float(np.median(l1[m])),1),'dL50',round(float(np.median((l1-l0)[m])),1),'dL p90',round(float(np.percentile((l1-l0)[m],90)),1))
