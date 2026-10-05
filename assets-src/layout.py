"""Manual digitization of HENN masterplan in the 1888x1334 review preview.
One global similarity transform; no individual warping. Pixel points editable below.
Scale 100m/82px from printed scale bar; drawing-to-built metrology unverified.
Names cross checked against OFFICIAL-MAP (not used as a metric plan).
"""
import math,json,pathlib
R=pathlib.Path(__file__).resolve().parents[1];S=100/82;OX=685;OZ=680
ref='HENN-henn_westlakeuniversity_plan_masterplan';aerial='HENN-henn_westlakeuniversity_01_aerial_0_0'
def p(x,z):return {'x':round((x-OX)*S,2),'z':round((z-OZ)*S,2)}
D={'meta':{'name':'西湖大学 · 云谷校区','units':'1 unit = 1 m (scale estimated from HENN drawing)','north':'-Z (drawing north arrow)','scaleStatus':'estimated; measured drawing scale, not surveyed as-built dimensions','bounds':{'minX':-665,'maxX':700,'minZ':-710,'maxZ':675},'referenceIds':['OFFICIAL-MAP',ref,aerial],'origin':'HENN plan preview pixel (685,680), academic loop center','alignment':{'image':'references/henn_westlakeuniversity_plan_masterplan.jpg','previewSize':[1888,1334],'scale':S,'scaleBarPixels':82,'scaleBarMetres':100,'originPixels':[OX,OZ],'method':'single global translation and uniform scale; north up; no per-building correction'}},'buildings':[],'roads':[],'plazas':[],'waterBodies':[],'bridges':[],'vegetationZones':[],'walkableSurfaces':[{'id':'ground','description':'outdoor level plane; bridges flush at y=0.08; water forbidden except bridges'},{'id':'loop-arcade','description':'academic loop ground atrium accessible through six facade openings and open ends; glazing and columns collide'}],'colliders':[],'spawnPoints':[p(672,752),p(676,752),p(668,752)],'validationViews':[]}
conf={'layout':'observed','dimensions':'estimated','appearance':'estimated'}
def building(id,name,x,z,w,d,h=28,kind='lab',color='#68797d',floors=5,parts=None,radius=None,refs=None):
 b={'id':id,'name':name,**p(x,z),'w':round(w*S,2),'d':round(d*S,2),'h':h,'rotation':0,'kind':kind,'color':color,'floors':floors,'sourceIds':['OFFICIAL-MAP',ref,aerial]+(refs or []),'confidence':dict(conf)}
 if radius:b['radius']=round(radius*S,2)
 if parts:b['parts']=[{**p(px,pz),'w':round(pw*S,2),'d':round(pd*S,2),'h':ph,'rotation':0}for px,pz,pw,pd,ph in parts]
 if kind in ['lab','hall','library','loop']:b['confidence']['appearance']='observed'
 D['buildings'].append(b)
 return b
# fixed landmark targets: hall, loop, library/beacon, science, engineering, medicine, life, south gate, A1/A2, sports.
building('E0','学术会堂',751,654,98,100,19,'hall','#d5cbb7',2,radius=47,refs=['OFFICIAL-HALL','HENN-henn_westlakeuniversity_05_core','HENN-henn_westlakeuniversity_section_academic_hall_0'])
b=building('E10','学术环',685,680,328,328,22,'loop','#d6d4c7',3,radius=153,refs=['HENN-henn_westlakeuniversity_07_academic_loop','HENN-henn_westlakeuniversity_section_academic_loop']);core=json.loads((R/'assets-src/academic-core.json').read_text())
coreScale=(b['radius']+27*S/2)/core['ring']['outer']
b['innerRadius']=round(core['ring']['inner']*coreScale,3);b['outerRadius']=round(core['ring']['outer']*coreScale,3)
b['radius']=(b['innerRadius']+b['outerRadius'])/2;b['bandWidth']=b['outerRadius']-b['innerRadius']
b['arc']=[0,core['ring']['endDegrees']];b['levels']=core['ring']['levels'];b['h']=b['levels'][-1]
b['facadeSlope']=core['ring']['facadeSlope']*coreScale;b['columnStep']=math.degrees(3.65/137)*3
b['doorAngles']=[35,77,116,154,190,220];b['doorHalfAngle']=1.65
b['sourceIds']+=['HENN-henn_westlakeuniversity_plan_ground_floor','HENN-henn_westlakeuniversity_04_core','HENN-henn_westlakeuniversity_08_academic_loop','HENN-GOOOOD-016','HENN-GOOOOD-017']
building('E4-E5','理学楼',676,875,143,138,29,'lab','#596f7b',5,parts=[(623,885,24,109,29),(672,894,26,104,29),(720,867,30,100,29)],refs=['HENN-henn_westlakeuniversity_10_faculty','OFFICIAL-SCIENCE'])
building('E1-E3','工学楼',859,800,130,187,29,'lab','#5488a0',5,parts=[(864,752,120,24,29),(867,803,126,25,29),(867,851,126,26,29)],refs=['HENN-henn_westlakeuniversity_12_faculty','OFFICIAL-ENGINEERING'])
building('E6-E7','基础医学楼',490,771,145,80,29,'lab','#809351',5,parts=[(494,748,130,26,29),(495,792,125,28,29)],refs=['HENN-henn_westlakeuniversity_10_faculty','OFFICIAL-MEDICINE'])
building('E8-E9','生命科学楼',482,670,158,112,29,'lab','#a37462',5,parts=[(485,648,135,27,29),(479,696,138,29,29)],refs=['HENN-henn_westlakeuniversity_13_faculty','OFFICIAL-LIFE'])
# Replace generic research bars with all 27 traced wings and return links.
for bid,lo,hi in [('E8-E9',0,7),('E6-E7',7,15),('E4-E5',15,18),('E1-E3',18,28)]:
 b=next(v for v in D['buildings']if v['id']==bid);b['parts']=[]
 for x0,z0,x1,z1,f in core['wingRectangles'][lo:hi]:
  b['parts'].append({'x':round(((x0+x1)/2-451)*core['planMetresPerPixel']*coreScale,2),'z':round(((z0+z1)/2-244)*core['planMetresPerPixel']*coreScale,2),'w':round((x1-x0)*core['planMetresPerPixel']*coreScale,2),'d':round((z1-z0)*core['planMetresPerPixel']*coreScale,2),'h':f*4.25,'floors':f,'rotation':0})
 b['x']=round(sum(v['x']for v in b['parts'])/len(b['parts']),2);b['z']=round(sum(v['z']for v in b['parts'])/len(b['parts']),2)
 b['h']=max(v['h']for v in b['parts']);b['sourceIds']+=['HENN-henn_westlakeuniversity_plan_ground_floor']
building('library','图书中心',571,450,138,115,35,'library','#75898b',6,refs=['HENN-henn_westlakeuniversity_section_library','HENN-henn_westlakeuniversity_03_aerial'])
building('beacon','图书中心 · 光锥',650,442,18,18,112,'beacon','#b6b4a2',1,radius=9,refs=['HENN-henn_westlakeuniversity_03_aerial'])
building('teaching','教学中心',897,575,129,110,24,'lab','#8c7963',4,parts=[(872,553,100,25,24),(914,603,100,30,24),(850,583,25,55,24)])
building('research','科研中心',761,469,154,101,25,'lab','#838675',5,parts=[(721,451,27,98,25),(794,443,116,24,25),(781,494,51,35,25)])
building('A1','行政楼',578,1093,96,97,19,'admin','#bd8c66',3)
building('A2','师生服务中心',796,1093,91,95,19,'admin','#ba8967',3)
building('exchange','学术交流中心',862,1170,108,66,54,'exchange','#7a9da4',12,radius=28)
building('southgate','南校门',683,1200,69,13,8,'gate','#d4c8a1',1)
building('northgate','北校门',681,137,65,13,8,'gate','#d4c8a1',1)
building('sports','综合体育馆',1170,732,114,102,20,'sports','#7f959c',3)
building('H5','学生活动中心 / 食堂 H5',1024,361,75,74,21,'lab','#798386',4,parts=[(1009,349,52,45,21),(1050,384,44,48,18)])
for id,name,x,z in [('H1','本科生书院 · 北区',1150,267),('H2','本科生书院 · 东北',1175,354),('H3','本科生书院 · 东区',1175,465),('H4','本科生书院 · 东南',1190,525)]:
 building(id,name,x,z,92,84,24,'college','#b08671',5,parts=[(x-30,z,22,84,24),(x+5,z-32,58,20,24),(x+32,z+10,22,65,24)])
building('training','实验实训楼',950,243,105,35,22,'lab','#918468',4)
building('general','通识教育中心',805,236,55,46,21,'lab','#938870',4)
building('logistics','后勤综合楼',754,161,68,35,20,'lab','#b59b68',4)
building('animal','实验动物中心 E11',463,566,68,39,21,'lab','#a39b78',4)
building('animal-north','实验动物中心 · 北区',300,148,54,49,20,'lab','#8e9383',4)
building('support','后勤综合楼 · 西北',380,150,53,75,24,'lab','#a08b68',5)
building('swing','试剂周转房',196,151,49,63,8,'service','#8b9286',1)
building('C16','师生活动中心 C16',451,965,58,60,18,'sports','#b19d75',3)
building('canteen-west','食堂 F17',518,1012,51,77,15,'canteen','#b19c6b',3)
building('F18','食堂 F18',496,930,56,58,16,'canteen','#ad9570',3)
# individual west residential footprints, digitized by row (no random placement).
rows=[(284,[201,315]),(321,[256,367]),(359,[203]),(397,[271,355]),(434,[196]),(489,[200]),(551,[206,295]),(835,[200,295]),(906,[199,371]),(947,[284,374]),(995,[203]),(1044,[286,395]),(1085,[199]),(1142,[208]),(1185,[277,374])]
idx=0
for z,xs in rows:
 for x in xs:
  idx+=1;building('res-'+str(idx),'研究生 / 博士后公寓 '+str(idx),x,z,58,20,32 if z<560 else 25,'residence','#adb7af',7 if z<560 else 6)
# faculty homes west/south, conservative separate blocks
for i,(x,z,w,d)in enumerate([(451,350,47,74),(475,442,20,28),(251,665,24,34),(299,664,23,34),(342,665,21,37),(285,712,44,24),(330,748,20,31),(230,722,24,37),(223,776,24,35),(306,780,27,34),(383,718,26,30),(367,629,24,35),(486,1094,91,36),(475,1140,87,31),(489,1180,95,27)],1):
 building('faculty-'+str(i),'教师公寓 '+str(i),x,z,w,d,22 if i<13 else 18,'residence','#b7b4a1',5 if i<13 else 4)
# east and southern sports / ancillary facilities
building('hotel','酒店 / 交流配套',881,1004,93,47,24,'exchange','#9ca4a1',5)
building('sports-south','体育配套用房',1116,1011,135,19,8,'service','#bcac85',1)
# water perimeter is irregular, following plan north/south branches; not a perfect circular moat.
outer=[(589,64),(566,120),(556,232),(553,325),(495,355),(446,392),(412,452),(407,505),(375,541),(367,626),(403,754),(441,873),(529,936),(609,956),(649,966),(656,1021),(722,1049),(797,996),(841,1017),(988,1071),(1125,1071),(1243,1021),(1276,1020),(1276,1050),(1160,1117),(1010,1106),(847,1040),(791,1018),(734,1073),(632,1047),(626,974),(565,972),(460,915),(427,846),(390,819),(354,725),(331,610),(345,529),(388,493),(388,440),(421,374),(460,338),(508,309),(515,230),(525,122),(556,64)]
# continuous principal water loop around academic core
outerLoop=[(507,315),(624,336),(715,338),(834,359),(929,402),(1002,444),(1028,498),(1027,565),(1008,627),(996,717),(989,828),(956,926),(880,973),(795,997),(705,1045),(634,1029),(634,965),(548,950),(464,909),(430,842),(391,805),(354,718),(338,610),(352,530),(389,491),(390,440),(427,374)]
innerLoop=[(512,345),(620,364),(715,365),(819,386),(908,424),(971,461),(994,508),(998,559),(981,619),(967,710),(958,822),(929,906),(863,943),(790,967),(704,1012),(665,1007),(664,942),(556,922),(488,886),(460,819),(416,786),(380,710),(368,612),(380,547),(419,508),(420,449),(449,395)]
D['waterBodies']=[{'id':'water-loop','outer':[p(*v)for v in outerLoop],'inner':[p(*v)for v in innerLoop]}]
# northern river from north boundary to ring, as a solid polygon
D['waterBodies'].append({'id':'north-stream','outer':[p(*v)for v in [(556,64),(590,64),(566,135),(556,229),(551,325),(513,332),(517,228),(526,130)]],'inner':[]})
# south east peripheral water branch
D['waterBodies'].append({'id':'east-water','outer':[p(*v)for v in [(824,984),(980,1057),(1130,1063),(1247,1018),(1275,1009),(1275,1044),(1145,1105),(1000,1096),(815,1011)]],'inner':[]})
# west water channel (outer living loop)
D['waterBodies'].append({'id':'west-stream','outer':[p(*v)for v in [(147,218),(518,214),(518,246),(150,245)]],'inner':[]})
# twelve actual crossing connections, digitized then simplified to flat safe bridge surfaces.
bridgePoints=[((676,325),(676,385)),((848,360),(848,409)),((924,448),(1048,448)),((964,649),(1046,649)),((954,860),(1015,860)),((819,951),(819,1013)),((635,987),(704,987)),((565,916),(565,970)),((379,808),(446,808)),((339,600),(423,600)),((352,518),(430,518)),((399,405),(490,405))]
for i,(a,b)in enumerate(bridgePoints,1):
 mid=p((a[0]+b[0])/2,(a[1]+b[1])/2);dx=(b[0]-a[0])*S;dz=(b[1]-a[1])*S
 D['bridges'].append({'id':f'bridge-{i:02}',**mid,'w':16 if i not in [1,7]else 24,'d':math.hypot(dx,dz)+28,'rotation':-math.atan2(dx,dz),'sourceIds':[ref,'OFFICIAL-MAP'],'confidence':{'layout':'estimated','dimensions':'estimated','appearance':'estimated'}})
def road(id,pts,width=12):D['roads'].append({'id':id,'points':[p(*v)for v in pts],'width':width,'sourceIds':[ref]})
road('north-axis',[(676,126),(676,504)],28);road('south-entry',[(681,1214),(681,1000)],26)
road('west-main',[(403,132),(403,372),(360,539),(365,682),(403,930),(403,1210)],13)
road('east-main',[(1085,215),(1085,643),(1032,699),(1032,1036),(986,1205)],13)
road('west-border',[(147,125),(147,1210),(1260,1210)],14)
road('east-border',[(1257,185),(1257,1210)],14)
road('north-border',[(147,110),(404,109),(895,151),(1260,196)],13)
for i,z in enumerate([250,385,517,615,808,973,1061,1130]):road('west-cross-'+str(i),[(148,z),(412,z)],10)
for i,z in enumerate([280,448,649,1010,1112]):road('east-cross-'+str(i),[(1050,z),(1257,z)],10)
for i,(a,b)in enumerate(bridgePoints):
 road('bridge-route-'+str(i),[a,b],16)
# park radial paths and ring edge: all paths are visual; world permits lawns as ordinary outdoor ground.
road('core-south',[(672,826),(672,752),(724,718)],9)
road('core-west',[(554,680),(622,690),(695,650)],8)
road('core-north',[(660,520),(658,592),(697,620)],8)
road('core-east',[(833,683),(811,691),(794,692)],8)
road('core-diagonal',[(588,773),(650,716),(688,678)],7)
road('hall-north',[(676,503),(715,584),(751,596)],8)
for i,(x,z,w,d)in enumerate([(680,1095,145,125),(673,950,160,40),(674,390,220,100),(898,655,130,49),(475,612,120,42),(715,529,135,40)]):D['plazas'].append({'id':'plaza-'+str(i),**p(x,z),'w':w*S,'d':d*S,'sourceIds':[ref]})
D['sportsFields']=[{'id':'track-east',**p(1180,884),'w':82*S,'d':169*S,'rotation':0},{'id':'track-south',**p(1040,1140),'w':65*S,'d':116*S,'rotation':0}]
D['courts']=[{**p(x,z),'w':20*S,'d':32*S}for x in [1014,1040,1066,1092]for z in[860,908]]
# vegetation coordinates drawn from landscape zones; reproducible seeded tree placement within each zone.
for x,z,w,d,n in [(700,692,250,245,70),(524,516,160,100,35),(897,476,270,220,40),(900,901,90,110,25),(252,596,185,240,38),(232,1060,160,290,40),(1126,641,190,130,35),(1119,196,160,90,25),(761,285,360,135,35),(694,1170,100,55,16),(348,247,80,80,15),(1206,1156,100,100,15),(900,1115,170,80,16)]:
 D['vegetationZones'].append({**p(x,z),'w':w*S,'d':d*S,'count':n})
# Region audit refinements are applied before shared visual/physics derivation.
from region_refinements import refine
refine(D,p,S)
# Names and public codes are sourced independently of historical renderer IDs.
directory=json.loads((R/'data/building-directory.json').read_text())
for entry in directory['buildings']:
 b=next((b for b in D['buildings'] if b['id']==entry['id']),None)
 if b is None and 'geometry' in entry:
  b={'id':entry['id'],**entry['geometry'],'rotation':0,'kind':'service','color':'#adb7af','floors':1,'sourceIds':['OSM-'+entry['codes'][0]],'confidence':{'layout':'estimated','dimensions':'estimated','appearance':'estimated'}}
  D['buildings'].append(b)
 if b is None:raise ValueError('Missing directory building '+entry['id'])
 b.update(name=entry['name'],codes=entry['codes'],nameAliases=entry['aliases'])
# The old simplified west road crossed the two previously omitted F6/F7
# footprints. Keep its 6.5 m corridor on their east side and rejoin to the south.
west_road=next(r for r in D['roads'] if r['id']=='west-main')
west_road['points'][2:2]=[{'x':-346,'z':-340},{'x':-346,'z':-245},{'x':-378,'z':-171}]
# colliders generated from exact visual parts. Columns keep arcade passable.
for b in D['buildings']:
 if b['kind']=='loop':
  end=b['arc'][1]
  for n in range(math.floor(end/b['columnStep'])+1):
   a=math.radians(n*b['columnStep'])
   for r in [b['outerRadius']*140.1/152,b['outerRadius']*151/152]:D['colliders'].append({'x':b['x']+math.cos(a)*r,'z':b['z']+math.sin(a)*r,'w':1.35,'d':1.35,'rotation':0,'objectId':b['id']})
  # Ground glazing follows the facade, with matching clear doors in the renderer.
  cuts=[0]+[v for a in b['doorAngles']for v in[a-b['doorHalfAngle'],a+b['doorHalfAngle']]]+[end]
  for k in range(0,len(cuts)-1,2):
   start,stop=cuts[k:k+2];count=math.ceil((stop-start)/.65)
   for n in range(count):
    aa=start+(stop-start)*n/count;bb=start+(stop-start)*(n+1)/count;a=math.radians((aa+bb)/2)
    for r in [b['innerRadius'],b['outerRadius']*151.6/152]:D['colliders'].append({'x':b['x']+math.cos(a)*r,'z':b['z']+math.sin(a)*r,'w':r*math.radians(bb-aa)+.06,'d':.20,'rotation':a+math.pi/2,'objectId':b['id']})
 elif b.get('radius')and b['kind']in['hall','beacon','exchange']:
  for n in range(32):
   a=2*math.pi*n/32;r=b['radius']-.5
   D['colliders'].append({'x':b['x']+math.cos(a)*r*.5,'z':b['z']+math.sin(a)*r*.5,'w':r,'d':r*.22+2,'rotation':a,'objectId':b['id']})
  if b['kind']=='exchange':D['colliders'].append({'x':b['x']-18,'z':b['z'],'w':b['w'],'d':b['d'],'rotation':0,'objectId':b['id']})
 elif b['kind']=='gate':
  if b['id']=='northgate':
   for a in b['parts']:D['colliders'].append({k:a[k]for k in['x','z','w','d']}|{'rotation':.25,'objectId':b['id']})
   continue
  for sign in [-1,1]:D['colliders'].append({'x':b['x']+sign*(b['w']/2-2),'z':b['z'],'w':4,'d':b['d'],'rotation':0,'objectId':b['id']})
 elif b['kind']=='library':
  for a in b['parts'][:1]:D['colliders'].append({k:a[k]for k in['x','z','w','d','rotation']}|{'objectId':b['id']})
 else:
  for a in b.get('parts',[b]):D['colliders'].append({k:a[k]for k in['x','z','w','d','rotation']}|{'objectId':b['id']})
# Bridge edges follow the sampled curve, sharing the centreline with rendering.
for b in D['bridges']:
 pts=b['points']
 for a,c in zip(pts,pts[1:]):
  dx=c['x']-a['x'];dz=c['z']-a['z'];length=math.hypot(dx,dz);rot=-math.atan2(dx,dz)
  for side in [-1,1]:D['colliders'].append({'x':(a['x']+c['x'])/2+side*dz/length*(b['w']/2+.1),'z':(a['z']+c['z'])/2-side*dx/length*(b['w']/2+.1),'w':.2,'d':length,'rotation':rot,'objectId':b['id']})
# Stair side and landing rails share visual/physics extents.
for stair in D['stairs']:
 for side in [-1,1]:D['colliders'].append({'x':stair['x']+side*(stair['w']/2+.15),'z':stair['z']-stair['landingD']/2,'w':.2,'d':stair['d']+stair['landingD'],'rotation':0,'objectId':stair['id']})
# fence follows bounded extent and is enforced by movement bounds.
def view(id,title,pos,target,fov,refs):D['validationViews'].append({'id':id,'title':title,'position':pos,'target':target,'fov':fov,'sourceIds':refs})
view('overview','全校园俯视',[30,1530,30],[30,0,0],52,[ref,'OFFICIAL-MAP'])
view('aerial','学术核心鸟瞰',[-420,330,560],[0,0,-10],52,[aerial])
view('hall','学术会堂',[120,2,55],[80,12,-30],56,['OFFICIAL-HALL'])
view('loop','学术环',[30,2,80],[25,15,181],60,['HENN-henn_westlakeuniversity_04_core','HENN-GOOOOD-017','HENN-henn_westlakeuniversity_section_academic_loop'])
view('library','图书中心',[-17,2,-315],[-120,36,-275],56,['HENN-henn_westlakeuniversity_03_aerial'])
view('engineering','工学楼',[240,2,245],[230,15,160],60,['HENN-henn_westlakeuniversity_12_faculty','OFFICIAL-ENGINEERING'])
view('medicine','生命科学楼 E6 / E7',[-285,2,177],[-230,15,125],60,['OFFICIAL-MEDICINE'])
view('life','基础医学楼 E8 / E9',[-284,2,-68],[-245,15,-5],60,['OFFICIAL-LIFE'])
view('gate','南校门',[0,2,654],[0,7,626],60,['OFFICIAL-MAP'])
view('water','水环与桥',[-98,2,350],[-30,4,363],60,[ref,aerial])
# Facade inspection cameras for individual photo references.
for bid,title in [('A1','A1 弧形立面'),('H4','H4 书院立面'),('H5','H5 格栅与外阶梯'),('sports','体育馆曲面屋顶'),('exchange','交流中心椭圆斜顶')]:
 b=next(b for b in D['buildings'] if b['id']==bid);distance=max(b['w'],b['d'])*1.7
 view('detail-'+bid,title,[b['x']+distance*.22,max(24,b['h']*.6),b['z']+distance],[b['x'],b['h']*.48,b['z']],52,{'A1':['HENN-henn_westlakeuniversity_02_aerial_0'],'H4':['college-2025-1'],'H5':['phase3-H5'],'sports':['phase3-sports'],'exchange':['HENN-henn_westlakeuniversity_03_aerial','OFFICIAL-CONFERENCE-VENUE']}[bid])
# A matching north-up region camera for every item in the full audit registry.
regions=json.loads((R/'assets-src/region-audit.json').read_text())['regions']
for region in regions:
 x0,z0,x1,z1=region['planBounds'];q=p((x0+x1)/2,(z0+z1)/2)
 # 16:9 camera: include every edge of the registered region with margin.
 elevation=max((z1-z0)*S,(x1-x0)*S/(16/9))/(2*math.tan(math.radians(52)/2))*1.2
 view('region-'+region['id'],region['name'],[q['x'],elevation,q['z']+.01],[q['x'],0,q['z']],52,region['sourceIds'])
(R/'data/campus.json').write_text(json.dumps(D,ensure_ascii=False,indent=2)+'\n')
print('Generated',len(D['buildings']),'buildings',len(D['colliders']),'colliders',len(D['bridges']),'bridges')
