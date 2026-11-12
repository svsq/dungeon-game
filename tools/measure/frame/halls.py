# halls.py (r15): tone of the special halls and other QA frames without the ref-B HUD: black (L*<3) %, hot %, L* p10/50/90
import os, sys, numpy as np
from PIL import Image
ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
def lstar(a):
    a=a/255.; l=(a<=.04045)*a/12.92+(a>.04045)*((a+.055)/1.055)**2.4; Y=.2126*l[...,0]+.7152*l[...,1]+.0722*l[...,2]; return 116*np.cbrt(Y)-16
for n in sys.argv[1:] or ['magma_hall_sanctum','magma_hall_forge','magma_hall_nest','magma_hall_prison','magma_arena','magma_lake','magma_cave','zone_magma']:
    a=np.asarray(Image.open(ROOTP+'frames/qa/'+n+'.png').convert('RGB')).astype(float); m=np.ones(a.shape[:2],bool)
    m[:320,:390]=0; m[:350,1520:]=0; m[930:,230:1690]=0; m[885:935,1010:]=0
    v=lstar(a); hot=(a[...,0]>170)&(a[...,1]>70)&(a[...,2]<110)&(v>45)
    print(n,'black %.1f hot %.1f L* p10/50/90 %s'%((v[m]<3).mean()*100,hot[m].mean()*100,np.percentile(v[m],[10,50,90]).round(0)))
