import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
from PIL import Image; import numpy as np; from scipy import ndimage as nd
import sys
def lstar(a):
    a=a/255.; l=(a<=.04045)*a/12.92+(a>.04045)*((a+.055)/1.055)**2.4; Y=.2126*l[...,0]+.7152*l[...,1]+.0722*l[...,2]; return 116*np.cbrt(Y)-16
def stat(name,a):
    v=lstar(a.astype(float)); dark=v<30; lava=(a[...,0]>180)&(v>55)
    lab,n=nd.label(nd.binary_opening(dark,iterations=2)); s=nd.sum(np.ones_like(lab),lab,range(1,n+1)); s=s[s>120]
    H,W=dark.shape; print(name,'lava%% %.0f dark%% %.0f blobs/Mpx %.0f size p25/50/75/95 %s cv %.2f'%(100*lava.mean(),100*dark.mean(),len(s)/(W*H)*1e6,np.percentile(s,[25,50,75,95]).astype(int),s.std()/s.mean()))
R=np.array(Image.open(ROOTP+'study/refs/ref_cave_lava.png').convert('RGB'))
stat('ref lake (1040-1536,130-480)',R[130:480,1040:1536])
for n in ['lake_7f14','lake_14f15','lake_21f15','lake_28f15','lake_70f14','lake_84f15']:
    a=np.array(Image.open(n+'.png').convert('RGB'))
    stat(n,a[280:800,450:1450])
