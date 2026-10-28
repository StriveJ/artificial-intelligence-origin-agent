import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { versionOf, nextReleaseVersion, VERSION_TOKEN } from '../product/core-space/scripts/lib/semver.mjs';
import { isChannel } from '../product/core-space/scripts/lib/release-channel.mjs';
import { writeChecksums } from '../product/core-space/scripts/lib/origin-checksums.mjs';
import { readBuildSource, withBuildSource } from '../product/core-space/scripts/lib/build-source.mjs';
function arg(n){const i=process.argv.indexOf('--'+n);return i>=0?process.argv[i+1]:'';}
const repo=arg('repo'), work=arg('work');
if(!repo||!work){console.error("Missing --repo / --work");process.exit(1);}
const base=join(work,'base');
const inst=join(work,'instance');
const proj=join(work,'project');
mkdirSync(proj,{recursive:true});


execFileSync('git',['clone',repo,base],{stdio:'ignore'});
const originText=readFileSync(join(base,'ORIGIN-MANIFEST.yaml'),'utf8'),givenChannel=(originText.match(/^[ \t]+channel:[ \t]*(\S+)/m)||[])[1];
const channel=isChannel(givenChannel)?givenChannel:'stable';
execFileSync(process.execPath,[join(base,'scripts','aipa-init.mjs'),'--root',inst,'--owner','test','--channel',channel,...(channel==='beta'?['--telemetry','on']:[])],{stdio:'inherit'});
console.log('init ok');


const man=join(base,'ORIGIN-MANIFEST.yaml');
const t=readFileSync(man,'utf8');
const nv=nextReleaseVersion(versionOf(t),channel),source=readBuildSource(t);
writeFileSync(man,withBuildSource(t.replace(new RegExp(String.raw`version:[ \t]*${VERSION_TOKEN}`),`version: ${nv}`),source?{...source,dirty:true}:null));
writeChecksums(base);
execFileSync('git',['-C',base,'add','-A']);
execFileSync('git',['-C',base,'-c','user.name=Test','-c','user.email=test@example.com','commit','-m','sim bump'],{stdio:'ignore'});
execFileSync('node',[join(base,'core-space','scripts','aipa-pull-origin.mjs'),'--root',inst,'--remote',base],{stdio:'inherit'});
console.log('pull ok');


execFileSync('node',[join(base,'core-space','scripts','aipa-project-add.mjs'),'--root',inst,'--local-path',proj,'--name','test-proj'],{stdio:'inherit'});
console.log('project ok');
