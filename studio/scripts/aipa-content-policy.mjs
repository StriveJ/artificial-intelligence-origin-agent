import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { publicContentViolations } from '../../product/core-space/scripts/lib/public-content.mjs';
function arg(n){const i=process.argv.indexOf('--'+n);return i>=0?process.argv[i+1]:'';}
const root=arg('root')||'.';
const dir=join(root,'product');
if(!existsSync(dir)){console.error("Missing product directory");process.exit(1);}


function walk(d){const out=[];if(!existsSync(d))return out;for(const n of readdirSync(d)){const p=join(d,n);if(statSync(p).isDirectory())out.push(...walk(p));else out.push(p);}return out;}

const violations=[];
for(const f of walk(dir)){
  if(f.endsWith('origin-checksums.txt'))continue;
  let buf;
  try{buf=readFileSync(f);}catch{continue;}
  if(buf.includes(0))continue;
  const text=buf.toString('utf8');
  for(const name of publicContentViolations(text)) violations.push(`${name}: ${f.replace(/\\/g,'/')}`);
}
if(violations.length){
  for(const v of violations)console.error(v);
  console.error(`Content policy blocked ${violations.length} violations`);
  process.exit(1);
}
console.log('content-policy ok');
