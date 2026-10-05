"""Analyse the HENN plan's blue water fill; output vector geometry, no raster asset.
Colour threshold and contour approximation are recorded for reproducible review.
"""
from PIL import Image
import numpy as np,json,pathlib,math
from collections import deque,defaultdict
R=pathlib.Path(__file__).resolve().parents[1]
img=np.asarray(Image.open(R/'references/henn_westlakeuniversity_plan_masterplan.jpg').convert('RGB')).astype(int);r,g,b=img[:,:,0],img[:,:,1],img[:,:,2]
mask=(b-r>7)&(b-g>3)&(r>100)&(g>110)&(b>120);mask[:,1400:]=False
H,W=mask.shape;seen=np.zeros_like(mask);polys=[]
def simplify(points,e=1.3):
 if len(points)<3:return points
 a=np.array(points[0]);b=np.array(points[-1]);v=b-a;den=np.linalg.norm(v)
 ds=[np.linalg.norm(np.array(q)-a) if den==0 else abs(v[0]*(q[1]-a[1])-v[1]*(q[0]-a[0]))/den for q in points];k=int(np.argmax(ds))
 return simplify(points[:k+1],e)[:-1]+simplify(points[k:],e) if ds[k]>e else [points[0],points[-1]]
for y,x in zip(*np.nonzero(mask)):
 if seen[y,x]:continue
 todo=deque([(int(x),int(y))]);seen[y,x]=True;pts=[]
 while todo:
  xx,yy=todo.popleft();pts.append((xx,yy))
  for nx,ny in [(xx-1,yy),(xx+1,yy),(xx,yy-1),(xx,yy+1)]:
   if 0<=nx<W and 0<=ny<H and mask[ny,nx] and not seen[ny,nx]:seen[ny,nx]=True;todo.append((nx,ny))
 if len(pts)<500:continue
 if max(v[0] for v in pts)<145:continue
 pixels=set(pts);edges=defaultdict(list)
 for x,y in pts:
  if (x,y-1)not in pixels:edges[(x,y)].append((x+1,y))
  if (x+1,y)not in pixels:edges[(x+1,y)].append((x+1,y+1))
  if (x,y+1)not in pixels:edges[(x+1,y+1)].append((x,y+1))
  if (x-1,y)not in pixels:edges[(x,y+1)].append((x,y))
 loops=[]
 while edges:
  start=next(iter(edges));q=start;loop=[]
  for _ in range(len(pts)*8):
   loop.append(q);targets=edges.get(q)
   if not targets:break
   nxt=targets.pop()
   if not targets:del edges[q]
   q=nxt
   if q==start:break
  if len(loop)>5:
   area=abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(loop,loop[1:]+[loop[0]])))/2
   if area>200:loops.append((area,loop))
 if not loops:continue
 loop=max(loops,key=lambda v:v[0])[1];k=len(loop)//2;reduced=simplify(loop[:k+1])[:-1]+simplify(loop[k:]+[loop[0]])[:-1]
 for _ in range(2):
  reduced=[q for a,b in zip(reduced,reduced[1:]+reduced[:1]) for q in [(a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25),(a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75)]]
 holes=[]
 for area,hole in sorted(loops,reverse=True)[1:]:
  k=len(hole)//2;ring=simplify(hole[:k+1])[:-1]+simplify(hole[k:]+[hole[0]])[:-1]
  if area>260:holes.append([[round(x*1888/W,2),round(y*1334/H,2)] for x,y in ring])
 polys.append({'id':'plan-water-'+str(len(polys)+1),'outer':[[round(x*1888/W,2),round(y*1334/H,2)] for x,y in reduced],'inner':holes[0] if holes else [],'holes':holes[1:],'pixels':len(pts)})
result={'sourceId':'HENN-henn_westlakeuniversity_plan_masterplan','method':'blue fill segmentation on original 1920x1357 JPEG; 4-connected contours; RDP tolerance 1.3 source pixels; two Chaikin corner passes; uniform mapping to 1888x1334 preview','note':'Bridges appear as white interruptions in the design drawing. North curved bridge forms follow the newer 2025 built aerial. No reference image is shipped as a runtime texture.','waterBodies':polys}
(R/'assets-src/water-plan.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(len(polys),'vector water components')
