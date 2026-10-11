import {spawn} from 'node:child_process';import {writeFile,rename,rm,stat} from 'node:fs/promises';
const list=['package.json','package-lock.json','README.md','.env.example','.gitignore','LICENSE','启动校园.command','index.html','water.html','tsconfig.json','vite.config.ts','playwright.config.ts','client','server','shared','data','assets-src','public','scripts','tests','docs','deployment','dist','dist-server','references/manifest.json'];
await writeFile('reports/delivery-files.txt',list.join('\n')+'\n');
const output='../westlake-campus-game-delivery.zip',temp='../.westlake-campus-game-delivery-'+process.pid+'.zip';
await rm(temp,{force:true});
// Python's ZIP writer marks non-ASCII entry names as UTF-8 and keeps Unix modes.
// The system zip command omitted that flag for the Chinese launcher/trace names.
const script=String.raw`import sys
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
excluded={'reports/screenshots/report-preview.png','reports/screenshots/region-report-preview.png','reports/delivery-validation.json'}
with ZipFile(sys.argv[1],'w',compression=ZIP_DEFLATED,compresslevel=6) as archive:
 for entry in sys.argv[2:]:
  root=Path(entry)
  files=[root] if root.is_file() else sorted(p for p in root.rglob('*') if p.is_file())
  for path in files:
   name=path.as_posix()
   if '__pycache__' not in path.parts and name not in excluded and name not in {'docs/PROGRESS.md','deployment/release.json'}: archive.write(path,name)
`;
const result=await new Promise((resolve,reject)=>{const p=spawn('python3',['-c',script,temp,...list],{stdio:'inherit'});p.on('error',reject);p.on('exit',resolve);});
if(result!==0){await rm(temp,{force:true});throw Error('ZIP failed: '+result);}
await rename(temp,output);console.log('Created fresh delivery ZIP:',output,(await stat(output)).size,'bytes (no node_modules or reference originals)');
