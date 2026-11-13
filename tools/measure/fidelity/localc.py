# local contrast inside pure-lava 24px tiles: mean per-tile sigma L, and L of seams minus L of cells
import sys,numpy as np
sys.path.insert(0,__file__.rsplit('/',1)[0]); from labc import *
from seamcol3 import tiles
