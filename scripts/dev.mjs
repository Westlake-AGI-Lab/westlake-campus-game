import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
if(existsSync('.env'))process.loadEnvFile('.env');
const server=spawn(process.execPath,['--env-file-if-exists=.env','--import','tsx','server/index.ts'],{stdio:'inherit'});
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js'],{stdio:'inherit'});
const stop=()=>{server.kill();vite.kill();};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
for(const child of [server,vite])child.on('exit',code=>{stop();process.exit(code||0);});
