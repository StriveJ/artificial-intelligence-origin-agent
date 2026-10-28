import { cpSync, mkdirSync, existsSync, rmSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
function arg(n){const i=process.argv.indexOf('--'+n);return i>=0?process.argv[i+1]:'';}
const source=arg('source');
const origin=arg('origin');
const typeArg=arg('type');
const anonId=arg('anon-id')||'anon';
const original=arg('original');

if(!origin){console.log("Maintainer entry requires --origin");process.exit(0);}
if(!existsSync(join(origin,'product','ORIGIN-MANIFEST.yaml'))){console.error("Not a valid Origin repository: "+origin);process.exit(1);}
if(!source){console.error("Missing --source");process.exit(1);}
if(!existsSync(source)){console.error("Artifact does not exist: "+source);process.exit(1);}

function detectType(p){
  const b=basename(p);
  if(/[\\/]skills[\\/]/.test(p)||b==='SKILL.md')return 'skill';
  if(/[\\/]mentors[\\/]/.test(p))return 'mentor';
  if(/[\\/]templates[\\/]/.test(p))return 'template';
  if(b==='framework.md'||b==='seam.yaml')return 'framework';
  if(b==='policy.md')return 'redline';
  if(b==='industry-map.yaml')return 'industry-map';
  return '';
}
const type=typeArg||detectType(source);
if(!type){console.error("Cannot detect artifact type; specify --type");process.exit(1);}

if (type === 'framework') { console.error("The single-asset framework entry is retired. Export complete product-path patches with instance core-space/scripts/aipa-export-edits.mjs, then review and apply them using git am on Origin dev."); process.exit(1); }
if (!['skill', 'mentor', 'template', 'redline', 'industry-map'].includes(type)) { console.error("Unknown type: " + type); process.exit(1); }
if (!/^[A-Za-z0-9_-]+$/.test(anonId)) { console.error("--anon-id accepts only letters, digits, underscores, and hyphens"); process.exit(1); }
const SPECIAL=new Set(['framework','redline']);


const stage=mkdtempSync(join(tmpdir(),'aipa-contrib-'));
const staged=join(stage,basename(source));
cpSync(source,staged,{recursive:true});
const fail=(reason)=>{
  console.error(JSON.stringify({type,status:'fail',reason}));
  rmSync(stage,{recursive:true,force:true});
  process.exit(1);
};
const abstractCheck=join(origin,'studio','scripts','aipa-origin-abstract-check.mjs');
if(existsSync(abstractCheck)){
  try{execFileSync('node',[abstractCheck,'--dir',stage],{stdio:'ignore'});}
  catch{fail('abstract fail');}
}
if(type==='skill'){
  const skillMd=join(staged,'SKILL.md');
  if(!existsSync(skillMd))fail('missing SKILL.md');
  const text=readFileSync(skillMd,'utf8');
  // English is canonical; existing pending contributions may use legacy headings.
  const required=[['name:'],['version:'],['## Trigger phrases','## \u89e6\u53d1\u53e3\u4ee4'],['## Action sequence','## Action chain','## \u52a8\u4f5c\u94fe'],['## Verification','## \u9a8c\u8bc1']];
  const missing=required.filter(alternatives=>!alternatives.some(r=>text.includes(r))).map(alternatives=>alternatives[0]);
  if(missing.length)fail('missing '+missing.join(','));
}


const id=`${anonId}-${Date.now()}`;
const contribDir=join(origin,'studio','contributions',id);
mkdirSync(contribDir,{recursive:true});
cpSync(source,join(contribDir,'abstracted'),{recursive:true});
writeFileSync(join(contribDir,'source.yaml'),`anon_id: ${anonId}\ntype: ${type}\ntimestamp: ${new Date().toISOString()}\nsource: ${source}\n`,'utf8');
writeFileSync(join(contribDir,'review.yaml'),`decision: pending\nreviewer: ""\ntimestamp: ""\nreason: ""\n`,'utf8');
if(original&&existsSync(original)){
  cpSync(original,join(contribDir,'original'),{recursive:true});
  writeFileSync(join(contribDir,'diff.md'),`# Abstraction differences\n\n- Original artifact: ${original}\n- Abstracted artifact: ${source}\n\n(To be checked during maintainer review.)\n`,'utf8');
}
rmSync(stage,{recursive:true,force:true});
console.log(JSON.stringify({contribution_id:id,type,special_approval:SPECIAL.has(type),status:'pending'}));
