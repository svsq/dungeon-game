import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
import sys,re,json,numpy as np
from PIL import Image,ImageDraw
from scipy import ndimage as nd
sys.argv=['x']; 
F=ROOTP+'frames/fidelity_r14/'; M='./'
import shoremap as S  # runs table; output discarded by caller
