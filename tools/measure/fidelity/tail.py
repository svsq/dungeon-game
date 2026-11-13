import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
import numpy as np
from PIL import Image
def lab(a):
    c=a/255.; c=np.where(c<=0.04045,c/12.92,((c+0.055)/1.055)**2.4); M=np.array([[.4124,.3576,.1805],[.2126,.7152,.0722],[.0193,.1192,.9505]]); x=c@M.T/np.array([.9505,1,1.089])
    f=np.where(x>0.008856,np.cbrt(x),7.787*x+16/116); return np.dstack([116*f[...,1]-16,500*(f[...,0]-f[...,1]),200*(f[...,1]-f[...,2])])
Q=ROOTP+'frames/critic_r15_fidelity/qa/'
def st(n,b,path=None):
    a=np.asarray(Image.open(path or Q+n.split()[0]+'.png').convert('RGB')).astype(float)[b[1]:b[3],b[0]:b[2]]
    l=lab(a).reshape(-1,3); p=a.reshape(-1,3)
    lava=(p[:,0]>200)&(p[:,1]>30)
    k=~lava
    if k.sum()==0:k=lava*0+1>0
    C=np.hypot(l[k,1],l[k,2]);h=np.degrees(np.arctan2(l[k,2],l[k,1]))%360
    print(f'{n:18s}{str(b):26s} lava%{lava.mean()*100:5.0f} nonlava RGB',np.median(p[k],0).astype(int),'L',round(float(np.median(l[k,0])),1),'C',round(float(np.median(C)),1),'hue',round(float(np.median(h))))
ref=ROOTP+'study/refs/ref_cave_lava.png'
st('ref arch legs',(330,300,360,360),ref)
st('magma_arch legs',(875,600,905,645))
st('magma_islet ground',(1012,585,1040,640))
st('magma_islet ground2',(925,585,945,640))
st('magma_islet chest',(952,572,1006,622))
st('ref ground',(650,540,760,600),ref)
st('ref chest',(1290,670,1350,730),ref)

d=np.abs(np.asarray(Image.open(Q+'magma_rock_drop.png').convert('RGB')).astype(int)-np.asarray(Image.open(Q+'magma_rock_warn.png').convert('RGB')).astype(int)).sum(2)
d[:, :250]=0; d[:,1530:]=0; d[:130]=0
ys,xs=np.where(d>120); print('rock diff bbox',xs.min(),xs.max(),ys.min(),ys.max(),len(xs),'med',int(np.median(xs)),int(np.median(ys)))
