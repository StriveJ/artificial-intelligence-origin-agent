import { readFileSync, writeFileSync, existsSync, cpSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { resolveWithin, assertWithin } from '../../product/core-space/scripts/lib/safe-path.mjs';
function arg(n){const i=process.argv.indexOf('--'+n);return i>=0?process.argv[i+1]:'';}
const origin=arg('origin'), id=arg('id'), decision=arg('decision'), reviewer=arg('reviewer')||'', reason=arg('reason')||'';
if(!origin||!id||!decision){console.error("Missing --origin / --id / --decision");process.exit(1);}
if (!['approve', 'reject'].includes(decision)) { console.error("--decision accepts only approve / reject"); process.exit(1); }
if (!/^[A-Za-z0-9_-]+$/.test(id) || /[\r\n]/.test(reviewer + reason)) { console.error("Invalid contribution ID or multiline review fields"); process.exit(1); }
const cd=resolveWithin(join(origin,'studio','contributions'),id,{rejectLinks:true});
if(!existsSync(cd)){console.error("Contribution does not exist: "+id);process.exit(1);}
const src=readFileSync(join(cd,'source.yaml'),'utf8');
const type=(src.match(/^type:\s*(.+)$/m)||[])[1]?.trim();
const sourcePath=(src.match(/^source:\s*(.+)$/m)||[])[1]?.trim();
const name=basename(sourcePath||'');
const abstracted=join(cd,'abstracted');

function destFor(o,t,n){
  switch(t){
    case 'skill':return join(o,'product','core-space','common','skills',n);
    case 'mentor':return join(o,'product','core-space','mentors',n);
    case 'template':return join(o,'product','templates','personal',n);
    case 'framework':throw new Error("Legacy framework contribution packages lack complete paths and cannot be approved. Migrate to complete product-path patches via aipa-export-edits, then review and apply with git am on Origin dev.");
    case 'redline':return join(o,'product','core-space','policy.md');
    case 'industry-map':return join(o,'product','industry-map.yaml');
    default:return '';
  }
}

if(decision==='approve'){
  try {
  const dest=destFor(origin,type,name);
  if(!dest) throw new Error("Unknown type: "+type);
  assertWithin(join(origin,'product'), dest, { rejectLinks: true });
  assertWithin(cd, abstracted, { rejectLinks: true });
  const check = join(origin,'studio','scripts','aipa-origin-abstract-check.mjs');
  if (!existsSync(check)) throw new Error("The abstraction checker is missing; approval rejected");
  execFileSync(process.execPath, [check, '--dir', abstracted], { stdio: 'pipe' });
  mkdirSync(join(dest,'..'),{recursive:true});
  cpSync(abstracted,dest,{recursive:true});
  } catch (error) { console.error("Approval failed and review status was not advanced: " + error.message); process.exit(1); }
}

const normalized = decision === 'approve' ? 'approved' : 'rejected';
writeFileSync(join(cd,'review.yaml'),`decision: ${normalized}\nreviewer: ${reviewer}\ntimestamp: ${new Date().toISOString()}\nreason: ${reason}\n`,'utf8');
console.log(JSON.stringify({contribution_id:id,decision}));
