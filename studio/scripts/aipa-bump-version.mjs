import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';






import { VERSION_TOKEN, versionOf, nextReleaseVersion } from '../../product/core-space/scripts/lib/semver.mjs';
import { channelOfOriginBranch } from '../../product/core-space/scripts/lib/release-channel.mjs';
function arg(n){const i=process.argv.indexOf('--'+n);return i>=0?(process.argv[i+1]||''):'';}
const root=arg('root')||'.';
const manifestPath=join(root,'product','ORIGIN-MANIFEST.yaml');
const versionPath=join(root,'product','VERSION');
if(!existsSync(manifestPath)){console.error("Missing product/ORIGIN-MANIFEST.yaml");process.exit(1);}
const manifest=readFileSync(manifestPath,'utf8');


const curVer=versionOf(manifest);
if(!curVer){console.error("Cannot read version");process.exit(1);}
const [major,curMinor,patch]=curVer.split('+')[0].split('-')[0].split('.');






let branch='';
try{
  branch=execFileSync('git',['-C',resolve(root),'symbolic-ref','--short','HEAD'],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
}catch{ branch=''; }
const channel=channelOfOriginBranch(branch);
if(!channel){
  console.error(`Version bump requires Origin dev or master (current branch: ${branch||"unknown branch"}); aborting`);
  process.exit(1);
}

const derivedPre=channel==='beta'?'beta':'';
const givenPre=arg('pre');
if(givenPre&&givenPre!==derivedPre){
  console.error(`--pre differs from the current source branch (branch ${branch} -> ${derivedPre||"stable"}; received ${givenPre}); aborting`);
  process.exit(1);
}
const newVer=nextReleaseVersion(curVer,channel);

const assist=`AIPA ${major}.${newVer.split('+')[0].split('-')[0].split('.')[1]} collaborates with you: `;



const newManifest=manifest
  .replace(new RegExp(String.raw`^(\s*)version:\s*${VERSION_TOKEN}`,'m'),`$1version: ${newVer}`)
  .replace(/^(\s*)assist_prefix:\s*"[^"]*"/m,`$1assist_prefix: "${assist}"`);

if(!new RegExp(String.raw`^(\s*)version:\s*${newVer.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\s*$`,'m').test(newManifest)){
  console.error("Version-line replacement failed due to a missing anchor or malformed indentation; write aborted");
  process.exit(1);
}
writeFileSync(manifestPath,newManifest,'utf8');
if(existsSync(versionPath)) writeFileSync(versionPath,newVer+'\n','utf8');
console.log(`${curVer} -> ${newVer}`);
