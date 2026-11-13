import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
import numpy as np, sys
from PIL import Image
def rgb2lab(c):
    c=np.where(c<=0.04045,c/12.92,((c+0.055)/1.055)**2.4); M=np.array([[.4124,.3576,.1805],[.2126,.7152,.0722],[.0193,.1192,.9505]]); x=c@M.T/np.array([.9505,1,1.089])
    f=np.where(x>0.008856,np.cbrt(x),7.787*x+16/116); return np.dstack([116*f[...,1]-16,500*(f[...,0]-f[...,1]),200*(f[...,1]-f[...,2])])
B=ROOTP+'frames/fidelity_r14/'
def st(p,box=(280,60,1500,1040)):
    a=np.asarray(Image.open(p).convert('RGB'))[box[1]:box[3],box[0]:box[2]].astype(float)
    lab=rgb2lab(a/255.0); L=lab[...,0]; C=np.hypot(lab[...,1],lab[...,2])
    hot=(a[...,0]>220)&(a[...,1]>40)&(a[...,2]<70)&(C>60)
    lit=L>8
    warm=a[lit]; rgb=np.median(warm,axis=0) if lit.sum() else [0,0,0]
    return dict(L50=round(float(np.percentile(L,50)),1),L90=round(float(np.percentile(L,90)),1),L99=round(float(np.percentile(L,99)),1),lit=round(float(lit.mean()*100),1),lava=round(float(hot.mean()*100),2),rgb=[int(x) for x in rgb])
for sd in ['77','12345','4242']:
    for n in ['t12_arrive','t13_05','t13_15','t13_25','t13_40','t13_wide','t12_up','t13_again','t_town']:
        print(sd,f'{n:11s}',st(f'{B}trans_{sd}/{n}.png'))
