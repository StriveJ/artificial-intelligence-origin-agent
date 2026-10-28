import { readdirSync, readFileSync, existsSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
function arg(name){ const i=process.argv.indexOf('--'+name); return i>=0 ? process.argv[i+1] : ''; }
const dir=arg('dir')||'.';
const forbidden=['@synthetic-private',"\u9879\u76ee A","\u6211\u7684\u9879\u76ee","\u4e2a\u4eba\u753b\u50cf"];
const SKIP=new Set(['CODEOWNERS','MAINTAINERS.md']);
function scan(p){
  const st=lstatSync(p);
  if(st.isSymbolicLink())return true;
  if(st.isFile())return forbidden.some(x=>readFileSync(p,'utf8').includes(x));
  for(const name of readdirSync(p)){
    if(SKIP.has(name)) continue;
    const f=join(p,name);
    if(lstatSync(f).isSymbolicLink())return true;
    if(lstatSync(f).isDirectory()){ if(scan(f)) return true; }
    else{
      const text=readFileSync(f,'utf8');
      if(forbidden.some(x=>text.includes(x))) return true;
    }
  }
  return false;
}
if(scan(dir)){ console.error('abstract fail'); process.exit(1); }
console.log('abstract ok');
