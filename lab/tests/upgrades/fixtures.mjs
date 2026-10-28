import { execFileSync } from 'node:child_process';
import { mkdirSync,mkdtempSync,writeFileSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { writeChecksums } from '../../../product/core-space/scripts/lib/origin-checksums.mjs';
import { UPDATE_CONTRACT } from '../../../product/core-space/scripts/lib/update-contract.mjs';
export const labRoot=resolve('lab/.upgrade-runs');
export function workspace(){mkdirSync(labRoot,{recursive:true});return mkdtempSync(join(labRoot,'run-'));}
export function git(root,args){return execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:'pipe',env:{...process.env,GIT_CEILING_DIRECTORIES:labRoot}});}
export function put(root,path,text){mkdirSync(resolve(root,path,'..'),{recursive:true});writeFileSync(join(root,path),text);}
export function instance({version='0.23.0-beta.3',ignore=''}={}){
  const root=workspace();git(root,['init','-q','-b','master']);git(root,['config','user.name','Lab']);git(root,['config','user.email','lab@example.invalid']);
  put(root,'AIPA-MANIFEST.yaml',`aipa:\n  version: ${version}\n  channel: beta\n  telemetry: on\n`);put(root,'.gitignore',ignore);put(root,'user-space/memory/preferences.md','## Synthetic\nPrivate sentinel\n');
  git(root,['add','-A']);git(root,['commit','-qm','lab fixture']);return root;
}
export function artifact(version='0.23.0-beta.4',{contract=true,capabilities=UPDATE_CONTRACT.capabilities}={}){
 const root=workspace();put(root,'ORIGIN-MANIFEST.yaml',`origin:\n  version: ${version}\n  channel: beta\n  build_source:\n    schema: 1\n    commit: ${'a'.repeat(40)}\n    branch: "dev"\n    dirty: false\n`);
 put(root,'core-space/example.mjs','export const version = '+JSON.stringify(version)+';\n');put(root,'templates/personal/AGENTS.md','# Framework entry\n');
 put(root,'AGENTS.md','# Public entry\n');put(root,'core-space/CONSTRAINTS.md','# Synthetic constraints\n');put(root,'core-space/policy.md','# Synthetic policy\n');put(root,'templates/personal/CHANGELOG.md','# Personal changelog\n');put(root,'.claude/settings.json','{}\n');put(root,'.claude/hooks/session-hook.mjs','// Synthetic hook\n');
 put(root,'.claude/commands/aipa.md','# Shell master\n');put(root,'.codebuddy/commands/aipa.md','# Shell master\n');
 if(contract)put(root,'update-contract.json',JSON.stringify({...UPDATE_CONTRACT,capabilities,executables:[]}));writeChecksums(root);return root;
}
