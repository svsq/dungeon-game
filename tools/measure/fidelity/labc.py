import numpy as np
from PIL import Image
def lab(a):
  c=a/255.0; c=np.where(c<=0.04045,c/12.92,((c+0.055)/1.055)**2.4)
  M=np.array([[0.4124,0.3576,0.1805],[0.2126,0.7152,0.0722],[0.0193,0.1192,0.9505]])
  xyz=c@M.T; xyz/=np.array([0.95047,1.0,1.08883])
  f=np.where(xyz>216/24389,np.cbrt(xyz),(24389/27*xyz+16)/116)
  return 116*f[...,1]-16, 500*(f[...,0]-f[...,1]), 200*(f[...,1]-f[...,2])
def load(p,k=1.0,box=None):
  im=Image.open(p).convert('RGB')
  if box: im=im.crop(box)
  if k!=1.0: im=im.resize((round(im.width*k),round(im.height*k)),Image.NEAREST)
  return np.asarray(im).astype(float)
def LCH(a):
  L,A,B=lab(a); return L,np.hypot(A,B),np.degrees(np.arctan2(B,A))%360
