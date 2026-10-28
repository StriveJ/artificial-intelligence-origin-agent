import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { VERSION_TOKEN, versionOf } from '../../product/core-space/scripts/lib/semver.mjs';


import { branchOfChannel, channelOfOriginBranch } from '../../product/core-space/scripts/lib/release-channel.mjs';
import { CHECKSUM_FILE, fileHash, renderChecksums, verifyChecksums } from '../../product/core-space/scripts/lib/origin-checksums.mjs';
import { atomicWriteFile } from '../../product/core-space/scripts/lib/atomic-write.mjs';
import { sourceExecutables, applyIndexModes } from './lib/artifact-modes.mjs';
import { isOwnRepository } from '../../product/core-space/scripts/lib/git-staging.mjs';
import { readBuildSource } from '../../product/core-space/scripts/lib/build-source.mjs';
function arg(n){const i=process.argv.indexOf('--'+n);return i>=0?(process.argv[i+1]||''):'';}
const root=arg('root')||'.';
const doPush=process.argv.includes('--push');

// Source discovery is relative to this build-only script, never the caller's cwd.
const originRepo=arg('src')||resolve(dirname(fileURLToPath(import.meta.url)),'..','..');
if(!isOwnRepository(originRepo)||!isOwnRepository(root)){console.error("Build and artifact repositories must be independent Git roots; parent-repository operations are rejected");process.exit(1);}
const common=dir=>execFileSync('git',['-C',dir,'rev-parse','--path-format=absolute','--git-common-dir'],{encoding:'utf8',stdio:'pipe'}).trim().replace(/\\/g,'/');
const canonical=p=>{const path=realpathSync.native(p).replace(/\\/g,'/');return process.platform==='win32'?path.toLowerCase():path;};
if(canonical(common(originRepo))===canonical(common(root))){console.error("Build and artifact worktrees share one Git repository; release refs must not be mixed");process.exit(1);}


let originBranch='';
try{
  originBranch=execFileSync('git',['-C',originRepo,'symbolic-ref','--short','HEAD'],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
}catch{ originBranch=''; }
const channel=channelOfOriginBranch(originBranch);
if(!channel){
  console.error(`Publishing requires Origin dev or master (repository ${originRepo}; branch ${originBranch||"unknown branch"}); publication aborted`);
  process.exit(1);
}


const givenChannel=arg('channel');
if(givenChannel&&givenChannel!==channel){
  console.error(`--channel differs from the source-branch channel (branch ${originBranch} -> ${channel}; received ${givenChannel}); publication aborted`);
  process.exit(1);
}
const targetBranch=branchOfChannel(channel);
const givenBranch=arg('branch');
if(givenBranch&&givenBranch!==targetBranch){
  console.error(`--branch differs from the derived destination (branch ${originBranch} must publish to ${targetBranch}; received ${givenBranch}); publication aborted`);
  process.exit(1);
}
let checksumMap;
try { checksumMap = verifyChecksums(root); }
catch (error) { console.error("Publication preflight failed: " + error.message); process.exit(1); }
if(!checksumMap.has('ORIGIN-MANIFEST.yaml')||!versionOf(readFileSync(join(root,'ORIGIN-MANIFEST.yaml'),'utf8'))){console.error("Publication preflight failed: missing a valid version manifest; no branch switch or commit");process.exit(1);}
if(doPush){
  const source=readBuildSource(readFileSync(join(root,'ORIGIN-MANIFEST.yaml'),'utf8'));
  if(!source||source.dirty){console.error("Publication preflight failed: remote releases need clean, verifiable build_source; review artifacts permit local commits only");process.exit(1);}
}
if(!existsSync(join(root,'.git'))){console.error('not a git repository');process.exit(1);}
function git(args){return execFileSync('git',['-C',root,...args],{encoding:'utf8'});}

function quiet(args){try{execFileSync('git',['-C',root,...args],{stdio:'pipe'});return true;}catch{return false;}}
const allowed = new Set([...checksumMap.keys(), CHECKSUM_FILE]);
const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']).split('\0').filter(Boolean);
if (staged.some(path => !allowed.has(path))) { console.error("Publication rejected: pre-staged content exists outside the checksum manifest"); process.exit(1); }

// Verify assembled bytes before changing refs; select the destination before committing.
if(git(['symbolic-ref','--short','HEAD']).trim()!==targetBranch){
  if(quiet(['rev-parse','--verify','--quiet','refs/heads/'+targetBranch])){

    // Preserve the dirty assembled workspace and index without resetting an existing branch.
    git(['symbolic-ref','HEAD','refs/heads/'+targetBranch]);
  }else{
    git(['checkout','-b',targetBranch]);
  }
  console.log(`Switched to branch ${targetBranch}`);
}


let version='';
const manifest=join(root,'ORIGIN-MANIFEST.yaml');
if(existsSync(manifest)){
  const text=readFileSync(manifest,'utf8');
  const m=text.match(new RegExp(String.raw`^\s*version:\s*["']?(${VERSION_TOKEN})`,'m'));
  if(m)version=m[1];

  const cur=(text.match(/^\s*channel:\s*(\S+)/m)||[])[1];
  if(cur!==channel){

    const eol=text.includes('\r\n')?'\r\n':'\n';
    const nv=/^\s*channel:\s*\S+/m.test(text)
      ? text.replace(/^([ \t]*)channel:[^\r\n]*/m,`$1channel: ${channel}`)
      : text.replace(/^([ \t]*)version:[^\r\n]*/m,(line,ind)=>`${line}${eol}${ind}channel: ${channel}`);
    if(!/^\s+channel:\s*\S+/m.test(nv)||!/^\s+version:\s*\S+/m.test(nv)){
      console.error("Malformed base manifest: channel/version indentation is missing; publication aborted"); process.exit(1);
    }
    writeFileSync(manifest,nv,'utf8');


    checksumMap.set('ORIGIN-MANIFEST.yaml', fileHash(manifest));
    atomicWriteFile(join(root, CHECKSUM_FILE), renderChecksums(checksumMap));
    console.log(`Base channel -> ${channel}`);
  }
}
const message=version?`publish origin ${version}`:'publish origin';
try { verifyChecksums(root); }
catch (error) { console.error("Final publication verification failed: " + error.message); process.exit(1); }
const removed = git(['ls-files', '-z']).split('\0').filter(Boolean).filter(path => !existsSync(join(root, path)));
git(['add', '-f', '-A', '--', ...allowed, ...removed]);
applyIndexModes(root, [...allowed], sourceExecutables(originRepo));
const committedFiles = git(['ls-files', '-z']).split('\0').filter(Boolean);
if (committedFiles.length !== allowed.size || committedFiles.some(path => !allowed.has(path))) {
  console.error("Publication rejected: staged files differ from the verified artifact"); process.exit(1);
}

if(quiet(['diff','--cached','--quiet'])){
  console.log("No new changes to commit");
}else{
  git(['commit','-m',message]);
  console.log(`Committed: ${message}`);
}
if(!doPush){
  console.log(`Committed locally to ${targetBranch}; not pushed. Add --push to publish ${targetBranch} and the matching version tag.`);
  process.exit(0);
}
try{
  git(['push','origin',`${targetBranch}:${targetBranch}`]);
}catch(e){
  console.error(`Push failed: ${`${e.stdout||''}${e.stderr||''}`.trim()||e.message}`);
  process.exit(1);
}
console.log(`Pushed ${targetBranch} → origin/${targetBranch}`);

if(version){
  const tag=`v${version}`;
  if(quiet(['rev-parse','--verify',`refs/tags/${tag}`])){
    try{
      git(['push','origin',tag]);
      console.log(`Pushed tag ${tag}`);
    }catch(e){
      console.error(`Tag push failed: ${`${e.stdout||''}${e.stderr||''}`.trim()||e.message}`);
      process.exit(1);
    }
  }else{
    console.log(`Warning: local tag ${tag} is missing; skipped. Release guidance requires a version tag.`);
  }
}
console.log('published');
