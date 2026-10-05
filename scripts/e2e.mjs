import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'westlake-e2e-')),port=process.env.E2E_PORT||'3013',url=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['dist-server/index.js'],{env:{...process.env,HOST:'127.0.0.1',PORT:port,ACCOUNT_DB:join(dir,'accounts.sqlite')},stdio:'inherit'});
let test;
const stop=()=>{test?.kill();server.kill();};process.on('SIGINT',stop);process.on('SIGTERM',stop);
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(url+'/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 if(!ready)throw Error('E2E server did not start');
 test=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test',...process.argv.slice(2)],{env:{...process.env,TEST_URL:url},stdio:'inherit'});
 process.exitCode=await new Promise((r,j)=>{test.on('error',j);test.on('exit',c=>r(c||0));});
}finally{if(server.exitCode===null){const done=new Promise(r=>server.once('exit',r));server.kill('SIGTERM');await done;}await rm(dir,{recursive:true,force:true});}
