#!/usr/bin/env node
// QA only, local static server with byte ranges for real audio playback/seeking.
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(process.argv[2]||'dist-qa'),port=Number(process.argv[3]||8765);
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf','.ico':'image/x-icon','.json':'application/json','.svg':'image/svg+xml','.wav':'audio/wav'};
http.createServer((req,res)=>{
 let url;try{url=decodeURIComponent(req.url.split('?')[0]);}catch{res.writeHead(400);res.end();return;}
 let file=path.resolve(root,'.'+url);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(root,'index.html');
 const size=fs.statSync(file).size;
 const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-store'};
 const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
 let start=0,end=size-1,code=200;
 if(range){start=Number(range[1]);end=range[2]?Math.min(Number(range[2]),size-1):size-1;
  if(start>end||start>=size){res.writeHead(416,{'Content-Range':'bytes */'+size});res.end();return;}
  code=206;headers['Content-Range']='bytes '+start+'-'+end+'/'+size;
 }
 headers['Content-Length']=end-start+1;res.writeHead(code,headers);
 if(req.method==='HEAD'){res.end();return;}
 const stream=fs.createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
}).listen(port,'127.0.0.1',()=>console.log('QA en http://localhost:'+port+' ('+root+')'));
