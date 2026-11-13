import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
import sys,re,numpy as np
from PIL import Image
from scipy import ndimage as nd
F=ROOTP+'frames/'
# column tops: dark basalt tops over lava
def cols(p):
  a=np.asarray(Image.open(p).convert('RGB')).astype(int); a=a[150:1040,380:1540]
  dark=(a.sum(-1)<170)&(a[...,0]<110)
  dark=nd.binary_opening(dark,iterations=3); l,n=nd.label(dark); s=np.array([(l==i).sum() for i in range(1,n+1)]); return n,int((s>=300).sum()),int(s.sum())
for n in 'magma_lava magma_lake magma_lake_shore magma_crossing magma_islet magma_river magma_terrace'.split():
  print(n,'r11',cols(F+'fidelity_r11/mag_new/'+n+'.png'),'r12',cols(F+'fidelity_r14/mag_new/'+n+'.png'))
