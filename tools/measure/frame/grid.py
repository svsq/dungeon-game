import sys
from PIL import Image
# grid.py out cols scale file...[:x,y,w,h]
out,cols,sc=sys.argv[1],int(sys.argv[2]),float(sys.argv[3]); ims=[]
for a in sys.argv[4:]:
    p,_,b=a.partition(':'); im=Image.open(p).convert('RGB')
    if b: x,y,w,h=map(int,b.split(',')); im=im.crop((x,y,x+w,y+h))
    ims.append(im.resize((int(im.width*sc),int(im.height*sc)),Image.NEAREST if sc>=1 else Image.LANCZOS))
w,h=ims[0].size; rows=(len(ims)+cols-1)//cols; S=Image.new('RGB',(cols*w+(cols-1)*4,rows*h+(rows-1)*4),(255,0,255))
for i,im in enumerate(ims): S.paste(im,((i%cols)*(w+4),(i//cols)*(h+4)))
S.save(out)
