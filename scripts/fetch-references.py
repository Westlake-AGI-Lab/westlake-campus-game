import re,json,urllib.request,pathlib,concurrent.futures
root=pathlib.Path(__file__).resolve().parents[1]
html=(root/'references/henn-page.html').read_text()
urls=re.findall(r'src="(/sites/default/files/styles/xl_(?:scaled|16_9)/public/images/2025-11/[^\"]+)"',html)
urls=list(dict.fromkeys(urls))
def fetch(u):
    url='https://www.henn.com'+u.replace('&amp;','&')
    name=url.split('/')[-1].split('?')[0]
    p=root/'references'/name
    try:
        urllib.request.urlretrieve(url,p)
        return {'sourceId':'HENN-'+name.replace('.jpg',''),'pageUrl':'https://www.henn.com/en/project/westlake-university','mediaUrl':url,'title':name,'author':'HENN / project photographers (see page credits)','published':'2025-11 (media directory; capture date unknown)','campus':'Yungu','category':'drawing' if any(x in name for x in ['plan','diagram','section','mod_']) else 'built-photograph','covers':[],'purpose':'geometric and facade reference only','status':'retrieved','localPath':str(p.relative_to(root)),'license':'copyright; redistribution permission unconfirmed; excluded from runtime assets'}
    except Exception as e:
        return {'mediaUrl':url,'status':'failed','error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    result=list(pool.map(fetch,urls))
url='https://facilities.westlake.edu.cn/__local/8/37/65/06922BEF6D848A41E0A2B561394_4010C606_C2299.jpg'
p=root/'references/official-yungu-map.jpg'
try:
    urllib.request.urlretrieve(url,p)
    result.append({'sourceId':'OFFICIAL-MAP','pageUrl':'https://facilities.westlake.edu.cn/info/1063/1862.htm','mediaUrl':url,'title':'云谷校区Yungu Campus · 导览图','author':'西湖大学实验室与科研设施部','published':'2025-11-17','captureDate':'unknown','campus':'Yungu','category':'campus-guide','covers':['whole campus','building names','north arrow','roads','water','bridges'],'purpose':'primary layout and name matching','status':'retrieved','localPath':str(p.relative_to(root)),'license':'copyright; reference only; not bundled in runtime'})
except Exception as e: print(e)
(root/'references/manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print('References retrieved',len([r for r in result if r['status']=='retrieved']))
