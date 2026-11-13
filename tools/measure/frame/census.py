from PIL import Image; import numpy as np, glob, os
HUDB=os.environ.get('HUD','b')=='b'
def lstar(a):
    a=a/255.; l=(a<=.04045)*a/12.92+(a>.04045)*((a+.055)/1.055)**2.4; Y=.2126*l[...,0]+.7152*l[...,1]+.0722*l[...,2]; return 116*np.cbrt(Y)-16
def row(n):
    a=np.array(Image.open(n).convert('RGB')).astype(float); m=np.ones(a.shape[:2],bool); m[:270,:430]=0; m[:620,1590:]=0; m[1030:,1470:]=0; m[80:190,600:1300]=0
    if HUDB: m[:]=1; m[:320,:390]=0; m[:350,1520:]=0; m[930:,230:1690]=0; m[885:935,1010:]=0  # r15: HUD by ref B (bottom panel, hint line, minimap)
    v=lstar(a); hot=(a[...,0]>170)&(a[...,1]>70)&(a[...,2]<110)&(v>45)
    return (v[m]<3).mean()*100,hot[m].mean()*100, (v[m]>12).mean()*100
for n in sorted(glob.glob('tl_*.png')): print(n,'black %.1f hot %.2f lit %.1f'%row(n))
R=[(n,)+row(n) for n in sorted(glob.glob('cs_*.png'))]
for r in R: print(r[0],'black %.1f hot %.2f lit %.1f'%r[1:])
b=np.array([r[1] for r in R]); h=np.array([r[2] for r in R]); print('N',len(R),'black>80:',(b>80).sum(),'mean black',b.mean(),'hot<0.5:',(h<.5).sum())
