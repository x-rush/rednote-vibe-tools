import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve(process.argv[2]||'.');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const pathname=decodeURIComponent(url.pathname);let file=resolve(root,'.'+pathname);if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return}if((await stat(file)).isDirectory())file=resolve(file,'index.html');let body=await readFile(file);if(extname(file)==='.html'&&url.searchParams.get('safe-area')==='44'){body=Buffer.from(body.toString().replace('</head>','<style>:root{--safe-area-inset-top:44px}</style></head>'));}res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(body)}catch{res.writeHead(404);res.end('Not found')}}).listen(4312,'127.0.0.1',()=>console.log('Jelly Atelier: http://127.0.0.1:4312'));
