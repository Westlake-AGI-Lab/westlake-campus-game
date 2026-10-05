"""Region-by-region plan refinements. Coordinates refer to the unchanged HENN preview.
Photos determine facades; plan bounds determine footprint. Heights remain estimates.
"""
import math,json,pathlib

def refine(D,p,S):
    by={b['id']:b for b in D['buildings']}
    def setparts(id,rects,**attrs):
        b=by[id]; b.update(attrs); b['parts']=[{**p(x,z),'w':round(w*S,2),'d':round(d*S,2),'h':h,'floors':f,'rotation':0} for x,z,w,d,h,f in rects]
        b['x']=sum(a['x'] for a in b['parts'])/len(b['parts']); b['z']=sum(a['z'] for a in b['parts'])/len(b['parts']);b['h']=max(a['h'] for a in b['parts'])
    def add(id,name,x,z,w,d,h,kind='service',floors=1,color='#a99c82'):
        b={'id':id,'name':name,**p(x,z),'w':w*S,'d':d*S,'h':h,'floors':floors,'rotation':0,'kind':kind,'color':color,'sourceIds':['OFFICIAL-MAP','HENN-henn_westlakeuniversity_plan_masterplan'],'confidence':{'layout':'observed','dimensions':'estimated','appearance':'estimated'}};D['buildings'].append(b);by[id]=b;return b
    # Match the four-storey loop section and the taller five-storey lab bars.
    for id in ['E1-E3','E4-E5','E6-E7','E8-E9']:
        for a in by[id]['parts']:a['h']=23.2 if a['floors']==4 else 28.6
        by[id]['h']=max(a['h'] for a in by[id]['parts'])
    # The teaching centre is north of the research centre, opposite the library.
    setparts('teaching',[(730,454,21,88,25,4),(797,444,112,26,25,4),(750,466,42,20,16,3),(788,494,47,36,16,3)],name='教学中心',color='#789397')
    setparts('research',[(907,543,82,22,25,4),(872,573,27,42,18,3),(898,576,24,43,18,3),(930,602,89,38,25,4)],name='科研中心',color='#789397')
    by['teaching']['sourceIds']+=['phase3-teaching','skyline-2025-1','skyline-2025-2'];by['research']['sourceIds']+=['phase3-research','skyline-2025-2']
    setparts('training',[(950,215,86,33,22,4),(982,247,22,97,22,4),(950,286,86,21,22,4),(930,253,9,46,16,3)],name='实验实训楼')
    setparts('general',[(449,166,15,44,15,3),(466,148,34,13,15,3),(466,184,34,13,15,3)])
    setparts('support',[(381,132,56,27,24,5),(380,177,56,23,24,5),(394,153,23,17,24,5)],name='后勤综合楼')
    by['logistics']['name']='北入口配套楼 · 东';by['animal-north']['name']='实验动物中心';by['swing']['name']='试剂周转房'
    setparts('swing',[(196,126,43,13,8,1),(196,183,43,13,8,1),(183,154,6,14,5,1)])
    # Four handed, open-courtyard footprints, not repeated copies of the same U.
    setparts('H1',[(1126,278,17,76,28,6),(1159,248,83,17,28,6),(1200,262,16,45,28,6),(1139,308,41,16,28,6)],name='本科生书院 H1',color='#b76d4e')
    setparts('H2',[(1155,375,17,42,28,6),(1189,376,83,17,28,6),(1230,350,17,69,28,6),(1217,318,43,17,28,6)],name='本科生书院 H2',color='#ae5c49')
    setparts('H3',[(1126,453,17,75,28,6),(1160,424,84,17,28,6),(1200,438,17,44,28,6),(1139,481,42,16,28,6)],name='本科生书院 H3',color='#bd754e')
    setparts('H4',[(1155,535,17,45,28,6),(1189,550,83,17,28,6),(1230,523,17,73,28,6),(1217,493,43,17,28,6)],name='本科生书院 H4',color='#ca804f')
    for id in ['H1','H2','H3','H4']:by[id]['sourceIds']+=['phase3-college','college-2025-1','skyline-2025-1']
    setparts('H5',[(1026,354,52,59,20,4),(1065,379,51,54,14,3),(1056,367,20,35,12,2)],kind='student',color='#839599')
    by['H5']['sourceIds']+=['phase3-H5'];by['training']['sourceIds']+=['phase3-training']
    # Library slabs share the same north/west edge, stepped down towards the axis.
    setparts('library',[(590,459,111,94,8,1),(570,447,97,75,16,2),(556,435,95,51,24,3),(552,432,49,45,32,4)],color='#7d979b')
    by['library']['sourceIds']+=['phase3-library','skyline-2025-2'];by['library']['terraces']=True
    by['beacon'].update(p(645,442));by['beacon']['h']=108
    setparts('faculty-1',[(442,353,56,74,29,6),(454,335,64,34,29,6),(455,375,24,27,20,4)],name='教师之家')
    by['faculty-2'].update(p(420,424),w=22*S,d=17*S,name='北区配套用房',kind='service',h=7,floors=1);add('north-canteen','北区食堂 F17 · 图示编号',287,442,32,27,12,'canteen',2,'#bba078')
    by['exchange'].update(name='学术交流中心 / 万信酒店',h=82,floors=18);by['exchange']['sourceIds']+=['OFFICIAL-CONFERENCE-VENUE','HENN-henn_westlakeuniversity_03_aerial']
    by['hotel'].update(name='水岸配套楼',kind='service',h=12,floors=2);setparts('hotel',[(860,1004,39,39,12,2),(888,1002,50,15,12,2),(865,1016,76,19,12,2)])
    by['A1']['sourceIds']+=['HENN-henn_westlakeuniversity_02_aerial_0'];by['A2']['sourceIds']+=['HENN-henn_westlakeuniversity_02_aerial_0']
    by['logistics'].update(w=59*S,d=28*S)
    for n,x,z,w,d in [(1,618,162,50,26),(2,612,244,43,44),(3,754,244,44,46)]:add('north-quad-'+str(n),'北入口配套楼 '+str(n),x,z,w,d,18,'lab',4,'#9b9985')
    setparts('northgate',[(652,148,3,14,8,1),(661,148,3,14,8,1),(701,148,3,14,8,1),(710,148,3,14,8,1)])
    by['southgate'].update(w=26*S,d=10*S,h=6)
    by['sports'].update(p(1161,732),w=132*S,d=84*S,h=20);by['sports']['sourceIds']+=['phase3-sports']
    by['C16'].update(p(365,1060),w=27*S,d=55*S,h=17);by['C16']['kind']='activity'
    by['canteen-west'].update(p(500,1008),w=51*S,d=51*S,name='食堂 C17 / F17',color='#c0a574');by['F18'].update(p(438,970),w=41*S,d=43*S,name='食堂 C18 / F18',color='#bea377')
    add('C19','食堂 C19',299,1110,72,30,13,'canteen',3,'#c0a574')
    add('hazard-store','危化品库房',300,595,30,8,5)
    # The southern three apartment slabs have their own numbered identities.
    for n,id in [(1,'faculty-13'),(2,'faculty-14'),(3,'faculty-15')]:by[id]['name']=f'教师周转公寓 C{n}'
    # Each residential bar was rechecked in the north and south plan crops.
    D['buildings']=[b for b in D['buildings'] if not b['id'].startswith('res-')]
    residences=[(200,282,53,19),(312,282,54,19),(255,321,53,18),(368,320,52,20),(200,354,54,18),(270,397,50,22),(355,397,51,22),(202,428,53,15),(202,496,54,18),(298,491,76,20),(213,564,55,22),(299,563,69,22),(218,834,54,20),(309,842,55,21),(373,887,53,22),(214,909,64,22),(284,958,60,23),(376,944,59,23),(213,988,63,24),(297,1048,66,28),(434,1074,81,28),(215,1069,68,27),(215,1145,68,24),(271,1183,61,20),(438,1148,84,30),(380,1200,58,22),(210,1202,55,31)]
    names={13:'C15',14:'C14',15:'C13',16:'C10',17:'C11',18:'C12',19:'C9',22:'C8',23:'C7',24:'C6',26:'C4'}
    for i,(x,z,w,d) in enumerate(residences,1):
        id=f'res-{i}';name=('生活区公寓 '+names[i]) if i in names else ('研究生 / 博士后公寓 '+str(i))
        height=48 if z<600 else 37;floors=12 if z<600 else 9;add(id,name,x,z,w,d,height,'residence',floors,'#adb7af')
        rects=[(x,z,w,d*.62,height,floors)]
        for k in range(3):rects.append((x-w/2+w*(k+.5)/3,z+d*.1,w*.18,d,height,floors))
        setparts(id,rects)
    # C1-C3 are the three traced southern residence footprints, not additional
    # large boxes laid over them. Number the whole C1-C15 set by the official guide.
    c_numbers={13:15,14:14,15:13,16:10,17:11,18:12,19:9,20:5,21:1,22:8,23:7,24:4,25:2,26:3,27:6}
    for i,n in c_numbers.items():
        by[f'res-{i}']['name']=('教师周转公寓' if n<=3 else '生活区公寓')+f' C{n}'
    D['buildings']=[b for b in D['buildings'] if b['id'] not in ['faculty-13','faculty-14','faculty-15']]
    # The professor-home garden contains eleven separately drawn dwellings.
    villas=[(204,662,34,20),(269,662,17,20),(302,665,18,21),(196,692,33,20),(241,705,34,20),(193,723,34,21),(314,724,35,20),(271,734,34,20),(216,762,34,20),(259,769,35,21),(303,765,35,20)]
    for i,(x,z,w,d) in enumerate(villas):
        id=f'faculty-{i+3}' if i<10 else 'professor-11'
        if id not in by:add(id,'讲席教授公寓 11',x,z,w,d,12,'residence',3)
        if i in [1,2]:rects=[(x,z,w,d,12,3)]
        else:rects=[(x-w*.26,z-2,w*.48,d*.76,12,3),(x+w*.26,z+2,w*.48,d*.76,12,3),(x,z,w*.58,d*.40,12,3)]
        setparts(id,rects,name='讲席教授公寓 '+str(i+1))
    for b in D['buildings']:
        if b['id'].startswith('res-'):
            north=b['z']<-150;b['h']=48 if north else 37;b['floors']=12 if north else 9
            for a in b['parts']:a['h']=b['h'];a['floors']=b['floors']
    # Reintroduce the omitted engineering return, then join each detached wing
    # component to the ring with the measured short continuation of its bar.
    b=by['E1-E3'];a=b['parts'][6];a['x']-=3.2;a['w']+=6.4; b['parts'][-1]['d']+=.6
    ring=by['E10'];ro=ring['outerRadius'];connectors=[]
    for id in ['E1-E3','E4-E5','E6-E7','E8-E9']:
        b=by[id];parts=b['parts'];groups=[];remaining=set(range(len(parts)))
        while remaining:
            group={remaining.pop()};changed=True
            while changed:
                changed=False
                for j in list(remaining):
                    a=parts[j]
                    if any(abs(a['x']-parts[k]['x'])<=(a['w']+parts[k]['w'])/2+.1 and abs(a['z']-parts[k]['z'])<=(a['d']+parts[k]['d'])/2+.1 for k in group):group.add(j);remaining.remove(j);changed=True
            groups.append(group)
        for group in groups:
            best=None
            for i in group:
                a=parts[i]
                for n in range(401):
                    angle=math.radians(ring['arc'][1])*n/400;tx=ro*math.cos(angle);tz=ro*math.sin(angle)
                    qx=max(a['x']-a['w']/2,min(tx,a['x']+a['w']/2));qz=max(a['z']-a['d']/2,min(tz,a['z']+a['d']/2));distance=math.hypot(tx-qx,tz-qz)
                    if best is None or distance<best[0]:best=(distance,qx,qz,tx,tz,i)
            dist,qx,qz,tx,tz,i=best
            if dist>.5:
                dx=tx-qx;dz=tz-qz;link={'x':(qx+tx)/2,'z':(qz+tz)/2,'w':min(parts[i]['w'],parts[i]['d'])*.85,'d':dist+3,'h':parts[i]['h'],'floors':parts[i]['floors'],'rotation':-math.atan2(dx,dz),'role':'ring-connection'};parts.append(link);connectors.append({'building':id,'gapClosedMetres':round(dist,2),'part':link})
        # The two long science wings both meet the loop, independently of their
        # shared far-end crossbar. This is visible in the ground plan and aerial.
        if id=='E4-E5':
            for a in list(parts):
                if a['d']<a['w']*3:continue
                edgez=a['z']-a['d']/2;edgex=a['x'];targetz=math.sqrt(ro*ro-edgex*edgex)
                if edgez>targetz+.3:
                    dist=edgez-targetz;link={'x':edgex,'z':(edgez+targetz)/2,'w':a['w'],'d':dist+3,'h':a['h'],'floors':a['floors'],'rotation':0,'role':'ring-connection'};parts.append(link);connectors.append({'building':id,'gapClosedMetres':round(dist,2),'part':link})
        b['connectionsChecked']=len(groups)
    D['meta']['coreConnections']=connectors
    # Vector shorelines are analysed directly from the unchanged primary plan.
    water=json.loads((pathlib.Path(__file__).parent/'water-plan.json').read_text())
    D['waterBodies']=[{'id':w['id'],'outer':[p(*v) for v in w['outer']],'inner':[p(*v) for v in w['inner']],'holes':[[p(*v) for v in h] for h in w.get('holes',[])],'sourceIds':[water['sourceId']]} for w in water['waterBodies']]
    # Every bridge now has a centreline; curved decks use the same line in physics.
    lines=[[(676,294),(676,410)],[(798,426),(851,402),(872,383),(881,360),(875,338)],[(937,486),(960,447),(974,420),(994,402)],[(969,649),(1046,649)],[(914,898),(943,921),(970,942)],[(750,965),(750,1045)],[(615,968),(615,1038)],[(432,925),(459,929),(495,933)],[(374,815),(404,815),(446,815)],[(320,610),(365,610),(425,611)],[(392,498),(419,501),(455,504)],[(467,400),(505,400),(543,400)]]
    D['bridges']=[]
    for i,line in enumerate(lines,1):
        if len(line)>2:
            curve=[]
            for k in range(len(line)-1):
                a=line[max(0,k-1)];b=line[k];c=line[k+1];d=line[min(len(line)-1,k+2)]
                for n in range(12):
                    t=n/12;t2=t*t;t3=t2*t
                    curve.append(tuple(.5*((2*b[j])+(-a[j]+c[j])*t+(2*a[j]-5*b[j]+4*c[j]-d[j])*t2+(-a[j]+3*b[j]-3*c[j]+d[j])*t3) for j in [0,1]))
            line=curve+[line[-1]]
        dense=[]
        for a,b in zip(line,line[1:]):
            count=max(1,math.ceil(math.hypot(b[0]-a[0],b[1]-a[1])*S/2))
            for n in range(count):dense.append((a[0]+(b[0]-a[0])*n/count,a[1]+(b[1]-a[1])*n/count))
        line=dense+[line[-1]]
        pts=[p(*v) for v in line];a=pts[0];b=pts[-1];dx=b['x']-a['x'];dz=b['z']-a['z'];width=34 if i==1 else 18 if i in [6,7] else 12
        D['bridges'].append({'id':f'bridge-{i:02}','x':(a['x']+b['x'])/2,'z':(a['z']+b['z'])/2,'w':width,'d':math.hypot(dx,dz),'rotation':-math.atan2(dx,dz),'points':pts,'rise':2.4 if i not in [1,7] else 1.0,'sourceIds':['HENN-henn_westlakeuniversity_plan_masterplan','skyline-2025-3','skyline-2025-6','skyline-2025-7'],'confidence':{'layout':'observed','dimensions':'estimated','appearance':'observed'}})
    def road(id,pts,width=8,style='walk',smooth=False):D['roads'].append({'id':id,'points':[p(*v) for v in pts],'width':width,'style':style,'smooth':smooth,'sourceIds':['HENN-henn_westlakeuniversity_plan_masterplan']})
    D['roads']=[r for r in D['roads'] if not (r['id'].startswith(('core-','hall-','bridge-route-','west-cross-')))]
    for r in D['roads']:
        r['style']='street' if r['id'].endswith('border') or r['id'] in ['west-main','east-main'] else 'walk';r['smooth']=r['id'] in ['west-main','east-main','north-border']
        if r['id']=='east-main':r['points']=[p(*v) for v in [(1100,215),(1100,643),(1032,699),(1032,1036),(986,1205)]]
        if r['id']=='north-border':r['points']=[p(*v) for v in [(147,110),(404,109),(680,110),(895,151),(1260,196)]]
        if r['id']=='west-main':r['points']=[p(*v) for v in [(410,112),(410,392),(347,538),(347,595),(337,682),(375,808),(342,861),(342,1210)]]
    for i,z in enumerate([251,414,518,610,808,976,1025,1128]):road(f'west-cross-{i}',[(148,z),(412,z)],7,'street')
    cross={'east-cross-0':[(1100,397),(1257,397)],'east-cross-1':[(1100,403),(1257,403)],'east-cross-3':[(1025,987),(1257,987)]}
    for r in D['roads']:
        if r['id'] in cross:r['points']=[p(*v) for v in cross[r['id']]]
    for i,pts in enumerate(lines):road(f'bridge-approach-{i+1}',[(v['x']/S+685,v['z']/S+680) for v in D['bridges'][i]['points']],D['bridges'][i]['w'])
    # Radial branches follow the plan junctions, with asymmetric leaf-shaped lawns.
    hub=(674,655)
    for i,end in enumerate([(582,565),(647,519),(695,520),(727,562),(832,646),(803,724),(754,779),(694,809),(634,798),(580,770),(553,708),(548,656)]):
        if i in [4,5,6]:pts=[{4:(808,665),5:(794,699),6:(768,709)}[i],end]
        else:pts=[hub,((hub[0]+end[0])/2+(6 if i<4 else -4),(hub[1]+end[1])/2),end]
        road(f'park-ray-{i}',pts,6,'paving',True)
    road('park-trunk',[(672,810),(682,747),(701,718),(696,693),(hub[0],hub[1]),(688,599),(699,533)],9,'paving',True)
    arc=[(685+129*math.cos(math.radians(a)),680+129*math.sin(math.radians(a))) for a in range(0,225,6)]
    road('park-arc',arc,5,'paving',True)
    # Walking strips follow both banks of each actual traced water component.
    for water in D['waterBodies']:
        edge=water['outer'];area=sum(a['x']*b['z']-b['x']*a['z'] for a,b in zip(edge,edge[1:]+edge[:1]));sign=1 if area>0 else -1;points=[]
        for i,v in enumerate(edge):
            a=edge[i-1];b=edge[(i+1)%len(edge)];dx=b['x']-a['x'];dz=b['z']-a['z'];l=math.hypot(dx,dz) or 1
            points.append(((v['x']+sign*dz/l*4)/S+685,(v['z']-sign*dx/l*4)/S+680))
        pts=points+points[:1];styles=[]
        for i in range(len(edge)):
            a=edge[i-1];b=edge[(i+1)%len(edge)];dx=b['x']-a['x'];dz=b['z']-a['z'];styles.append('running' if sign*(dz*edge[i]['x']-dx*edge[i]['z'])>0 else 'walk')
        start=0
        for i in range(1,len(edge)+1):
            if i==len(edge) or styles[i]!=styles[start]:road('waterside-'+water['id']+'-'+str(start),pts[start:i+1],3,styles[start],False);start=i
    D['courts']=[{**p(x,z),'w':19*S,'d':31*S,'kind':'basketball'} for x in [1049,1068,1087] for z in [897,929,961]]
    D['courts']+=[{**p(1015,z),'w':20*S,'d':37*S,'kind':'tennis'} for z in [907,948]]
    D['courts']+=[{**p(1080,z),'w':15*S,'d':23*S,'kind':'volleyball'} for z in [823,849]]
    # The southeastern extra oval in the design plan is not the labelled campus track.
    D['sportsFields']=[f for f in D['sportsFields'] if f['id']=='track-east']
    D['plazas']=[a for a in D['plazas'] if a['id'] not in ['plaza-2','plaza-5']]
    D['plazas'] += [{'id':'library-apron',**p(645,492),'w':20*S,'d':40*S,'sourceIds':['HENN-henn_westlakeuniversity_03_aerial']},{'id':'H5-front',**p(1055,427),'w':70*S,'d':25*S,'sourceIds':['phase3-H5']}]

    D['courts'] += [{**p(x,z),'w':17*S,'d':29*S,'kind':'basketball'} for x,z in [(284,880),(302,880),(320,880),(354,1006),(241,1035)]]
    D['courts'] += [{**p(x,z),'w':18*S,'d':27*S,'kind':'tennis'} for x,z in [(212,630),(233,630),(356,919)]]
    D['courts'] += [{**p(482,1187),'w':10*S,'d':26*S,'kind':'tennis'}]
    for r in D['roads']:
        if r['id']=='west-cross-6':r['points']=[p(*v) for v in [(148,1027),(218,1027),(218,1016),(266,1016),(266,1028),(412,1028)]]
        if r['id']=='west-main':r['width']=6.5

    by['sports-south'].update(w=85*S,d=14*S)
    for r in D['roads']:
        if r['id']=='west-border':r['points']=[p(*v) for v in [(147,125),(147,1235),(1260,1235)]]

    # Water hidden by a white bridge stroke in the drawing is inferred only
    # where both adjacent bankside samples are water. Deck/physics share points.
    def inside(q,poly):
        result=False
        for a,b in zip(poly,poly[1:]+poly[:1]):
            if (a['z']>q['z'])!=(b['z']>q['z']) and q['x']<(b['x']-a['x'])*(q['z']-a['z'])/(b['z']-a['z'])+a['x']:result=not result
        return result
    originalwater=list(D['waterBodies'])
    wet=lambda q:any(inside(q,w['outer']) and not any(inside(q,h) for h in [w['inner']]+w.get('holes',[])) for w in originalwater)
    for bridge in D['bridges']:
        pts=bridge['points']
        for n,(a,b) in enumerate(zip(pts,pts[1:])):
            dx=b['x']-a['x'];dz=b['z']-a['z'];l=math.hypot(dx,dz);nx=dz/l;nz=-dx/l;q={'x':(a['x']+b['x'])/2,'z':(a['z']+b['z'])/2};offset=bridge['w']/2+8
            if not wet(q) and all(wet({'x':q['x']+sign*nx*offset,'z':q['z']+sign*nz*offset}) for sign in [-1,1]):
                w=bridge['w']/2+1;poly=[{'x':v['x']+sign*nx*w,'z':v['z']+sign*nz*w} for v,sign in [(a,-1),(b,-1),(b,1),(a,1)]]
                D['waterBodies'].append({'id':bridge['id']+f'-under-{n}','outer':poly,'inner':[],'sourceIds':['HENN-henn_westlakeuniversity_plan_masterplan'],'confidence':'inferred below white bridge stroke'})

    # The small water-garden access is a walkway, separate from the 12 main bridges.
    a=p(566,954);b=p(591,954)
    D['waterWalkways']=[{'id':'garden-walkway','x':(a['x']+b['x'])/2,'z':a['z'],'w':4,'d':b['x']-a['x'],'rotation':-math.pi/2,'points':[a,b],'rise':.15,'sourceIds':['skyline-2025-12','HENN-henn_westlakeuniversity_plan_masterplan']}]

    h5=by['H5']['parts'][1];library=by['library']['parts'][0]
    D['stairs']=[
      {'id':'H5-stairs','x':h5['x'],'z':h5['z']+h5['d']/2+11,'w':13,'d':18,'rise':8.8,'steps':40,'landingD':2,'rotation':0},
      {'id':'library-stairs','x':library['x']+library['w']/2+9,'z':library['z']+library['d']/2+1.5,'w':18,'d':13,'rise':3,'steps':15,'landingD':3,'rotation':0},
      {'id':'south-stairs','x':-10,'z':353.9,'w':95,'d':16.2,'rise':2.88,'steps':18,'landingD':3.9,'rotation':0}]
    D['walkableSurfaces'][0]['description']='Outdoor ground with shared arched bridge decks and three stair surfaces; heights estimated from references'

    for id in ['A1','A2','H4','H5','teaching','research','training','library','exchange']:by[id]['confidence']['appearance']='observed'
    by['north-canteen']['name']='北区食堂'
