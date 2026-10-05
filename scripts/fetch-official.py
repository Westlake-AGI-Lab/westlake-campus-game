import urllib.request,pathlib,json
root=pathlib.Path(__file__).resolve().parents[1];base='https://zh-ugadmissions.westlake.edu.cn/WhyWestlake/WestlakeCampus/'
files=[('OFFICIAL-HALL','学术会堂','YunguCampus/202111/W020250217529415916793.jpg',['E0']),('OFFICIAL-SCIENCE','理学楼','Academics/202111/W020220307303504062254.jpg',['E4-E5']),('OFFICIAL-ENGINEERING','工学楼','Academics/202111/W020220307301909743166.jpg',['E1-E3']),('OFFICIAL-LIFE','生命科学楼','Academics/202111/W020220307302677191658.jpg',['E8-E9']),('OFFICIAL-MEDICINE','基础医学楼','Academics/202111/W020220307303642558733.jpg',['E6-E7']),('OFFICIAL-COLLEGE','书院外观','ResidentialColleges/202111/W020211125566916386767.jpg',['H1','H2','H3','H4']),('OFFICIAL-EXCHANGE','学术交流中心','YunguCampus/202111/W020211125566039452564.png',['exchange'])]
m=json.loads((root/'references/manifest.json').read_text())
for id,title,path,covers in files:
 p=root/'references'/(id.lower()+path[path.rfind('.'):]);url=base+path
 try:
  urllib.request.urlretrieve(url,p)
  m.append({'sourceId':id,'pageUrl':base,'mediaUrl':url,'title':title,'author':'西湖大学本科招生','published':'unknown (filename dates are not verified capture dates)','captureDate':'unknown','campus':'Yungu','category':'built-photograph (to visually verify)','covers':covers,'purpose':'named exterior reference','status':'retrieved','localPath':str(p.relative_to(root)),'license':'copyright; reference only; excluded from runtime distribution'})
 except Exception as e: print(id,e)
(root/'references/manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2))
print('Official references downloaded')
