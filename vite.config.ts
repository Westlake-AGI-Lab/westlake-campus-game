import {defineConfig} from 'vite';
export default defineConfig({root:'.',publicDir:'public',build:{outDir:'dist',emptyOutDir:true},server:{host:process.env.HOST||'127.0.0.1',port:Number(process.env.DEV_PORT||5173),strictPort:true,proxy:{'/socket.io':{target:`http://127.0.0.1:${process.env.PORT||3000}`,ws:true},'/health':`http://127.0.0.1:${process.env.PORT||3000}`}}});
