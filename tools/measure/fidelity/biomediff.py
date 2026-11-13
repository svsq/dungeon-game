import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
# r15: other biomes after the magma fixes and the dev merges: per zone_* / cave_* / town state, share of pixels outside the HUD that moved
# by more than 24 (sum RGB) between two qa runs, and Lab medians of the moved and the whole play area. usage: biomediff.py <old qa dir> <new qa dir>
import sys,numpy as np
from PIL import Image
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
A,B=sys.argv[1],sys.argv[2]
names=sys.argv[3].split(',') if len(sys.argv)>3 else ['zone_dungeon','zone_crypt','zone_lava','zone_arcane','zone_cave','cave_hall','cave_crossing','zone_town','town_services','lava_river','lava_hall','zone_magma','magma_lake','magma_hall']
for n in names:
  try: a=np.asarray(Image.open(A+n+'.png').convert('RGB')).astype(int); b=np.asarray(Image.open(B+n+'.png').convert('RGB')).astype(int)
  except Exception as e: print(f'{n:16s} missing'); continue
  H,W=a.shape[:2]; Y,X=np.mgrid[0:H,0:W]
  play=~((X<390)&(Y<310)|(X>1520)&(Y<670)|(Y>880)|(X<380)&(Y>820))
  d=np.abs(a-b).sum(2); mv=(d>24)&play
  La=LCH(a[play].astype(float))[0]; Lb=LCH(b[play].astype(float))[0]
  print(f'{n:16s} moved {100*mv.sum()/play.sum():5.1f}%  L p50/p90 old {np.median(La):5.1f}/{np.percentile(La,90):5.1f} new {np.median(Lb):5.1f}/{np.percentile(Lb,90):5.1f}')
