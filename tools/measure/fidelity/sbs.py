import sys
from PIL import Image, ImageDraw
# sbs.py out scale  refpath x0 y0 w h  ourpath x0 y0 [k_ref]
out,s=sys.argv[1],int(sys.argv[2]); rp=sys.argv[3]; rx,ry,w,h=map(int,sys.argv[4:8]); op=sys.argv[8]; ox,oy=map(int,sys.argv[9:11]); k=float(sys.argv[11]) if len(sys.argv)>11 else 1.05
r=Image.open(rp).convert('RGB').crop((rx,ry,rx+round(w/k),ry+round(h/k))).resize((w,h),Image.NEAREST)
o=Image.open(op).convert('RGB').crop((ox,oy,ox+w,oy+h))
im=Image.new('RGB',(w*2*s+8,h*s),(255,0,255)); im.paste(r.resize((w*s,h*s),Image.NEAREST),(0,0)); im.paste(o.resize((w*s,h*s),Image.NEAREST),(w*s+8,0)); im.save(out)
