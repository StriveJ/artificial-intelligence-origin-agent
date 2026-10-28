import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
function arg(name){ const i=process.argv.indexOf('--'+name); return i>=0 ? process.argv[i+1] : ''; }
const baseDir=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const file=arg('maintainers')||join(baseDir,'..','MAINTAINERS.md');
const user=arg('user')||'';
const text=readFileSync(file,'utf8');
const accounts=[...text.matchAll(/^\s*-\s*@([\w.-]+)/gm)].map(m=>m[1]);
console.log(accounts.includes(user)?'allow':'deny');
