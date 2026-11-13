import os; ROOTP=(os.environ.get('ROOT') or os.path.abspath(__file__+'/../../../..'))+'/'
import sys,io,contextlib; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import shore
F=ROOTP+'frames/'
def real(p,k=1):
  with contextlib.redirect_stdout(io.StringIO()): r=shore.analyze(p,k)
  o=[]
  for l,ori,c,s,e,d in r:
    if d<20: continue
    x0,x1,y0,y1=(s,e,c,c) if ori=='H' else (c,c,s,e)
    if (x1<370 and y1<260) or x1>1540 or (y0>1030): continue
    o.append((l,ori,c,s,e))
  return o
print('frame                 r11 max / n>64 | r12 max / n>64 | top r12')
for n in 'magma_lake_shore magma_terrace magma_chasm magma_hall magma_crossing magma_river magma_lava magma_islet magma_lake'.split():
  a=real(F+f'fidelity_r11/mag_new/{n}.png'); b=real(F+f'fidelity_r14/mag_new/{n}.png')
  print(f"{n:20s} {max([q[0] for q in a],default=0):4d} {sum(q[0]>64 for q in a):3d} | {max([q[0] for q in b],default=0):4d} {sum(q[0]>64 for q in b):3d} | {sorted(b,reverse=True)[:3]}")
r=real(ROOTP+'study/refs/ref_cave_lava.png',1.05); print('ref',sorted(r,reverse=True)[:3], sum(q[0]>64 for q in r))
