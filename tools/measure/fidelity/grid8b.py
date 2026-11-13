import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
import sys,numpy as np
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import io,contextlib
with contextlib.redirect_stdout(io.StringIO()):
  import grid8 as g
F=ROOTP+'frames/'
for n,b in [('magma_lake_shore',(860,330,1110,410)),('magma_crossing',(100,800,1400,1040)),('magma_terrace',(100,520,1400,1000)),('magma_lake_shore',(1140,880,1300,1000))]:
  for v in ('fidelity_r11','fidelity_r14'):
    x,y,px,py=g.run(F+v+'/mag_new/'+n+'.png',b); print(f'{n:18s}{str(b):26s}{v[-3:]} x {x:.2f} y {y:.2f}  y% {py}')
