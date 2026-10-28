// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {coreDiagnostics,coreSupport,coreSupportMarkdown} from '../../../product/core-space/scripts/lib/support-contract.mjs';
import {checkSupportBlock} from '../../support/support-docs.mjs';
import {UPDATE_CONTRACT} from '../../../product/core-space/scripts/lib/update-contract.mjs';
import {DEFAULT_CONTEXT_BUDGETS} from '../../../product/core-space/scripts/lib/context-projection.mjs';
import {createSyntheticFixture,LAB_ROOT,SOURCE_ROOT} from '../../support/synthetic-fixture.mjs';

function fixture(){const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance();fs.cpSync(join(SOURCE_ROOT,'product/core-space'),join(root,'core-space'),{recursive:true});return {f,root};}
function baseline(f,root){const lines=[];function walk(path){for(const item of fs.readdirSync(path,{withFileTypes:true})){const target=join(path,item.name);if(item.isDirectory())walk(target);else lines.push(createHash('sha256').update(fs.readFileSync(target)).digest('hex')+'  '+relative(root,target).replaceAll('\\','/'));}}walk(join(root,'core-space'));f.put('instance/state/origin-baseline.txt',lines.join('\n')+'\n');}

test("Support declarations reference current capabilities, formats, and budgets without treating declared minimums as accepted versions",()=>{
 const value=coreSupport();assert.equal(value.minNode,UPDATE_CONTRACT.min_node);assert.deepEqual(value.capabilities,UPDATE_CONTRACT.capabilities);assert.deepEqual(value.formats,UPDATE_CONTRACT.formats);assert.deepEqual(value.context.budgets,DEFAULT_CONTEXT_BUDGETS);assert.deepEqual(value.thirdPartyPackages,[]);
 value.capabilities.length=0;value.context.budgets.ide=1;assert.ok(coreSupport().capabilities.length);assert.equal(coreSupport().context.budgets.ide,DEFAULT_CONTEXT_BUDGETS.ide);
 const doc=fs.readFileSync(join(SOURCE_ROOT,'product/core-space/shared-contracts.md'),'utf8');checkSupportBlock(doc,'core',coreSupportMarkdown());assert.throws(()=>checkSupportBlock(doc.replace('IDE 32000','IDE 1'),'core',coreSupportMarkdown()),/differs/);
});

test("Metadata diagnostics do not access personal content, privacy configuration, or queues and do not write metrics; a complete baseline proves only Core-file consistency",()=>{
 const {f,root}=fixture();baseline(f,root);f.put('instance/user-space/profile.yaml','SYNTHETIC_PRIVATE_BODY');f.put('instance/state/offline-tasks.json','SYNTHETIC_PRIVATE_BODY');
 const originals={readFileSync:fs.readFileSync,readdirSync:fs.readdirSync,writeFileSync:fs.writeFileSync,mkdirSync:fs.mkdirSync};
 try{
  for(const name of ['readFileSync','readdirSync'])fs[name]=function(path,...args){const rel=relative(root,String(path)).replaceAll('\\','/');if(rel==='user-space'||rel.startsWith('user-space/')||rel.startsWith('state/')&&rel!=='state/origin-baseline.txt')throw Error("Diagnostics touched private data");return originals[name](path,...args);};
  for(const name of ['writeFileSync','mkdirSync'])fs[name]=()=>{throw Error("Diagnostics must not write");};syncBuiltinESMExports();
  const result=coreDiagnostics(root);assert.equal(result.status,'checked');assert.equal(result.drift.status,'matching');assert.ok(result.drift.checked>100);assert.equal(result.personalDataInspected,false);assert.equal(result.context.status,'not-checked');assert.equal(result.installationAllowed,false);assert.doesNotMatch(JSON.stringify(result),/SYNTHETIC_PRIVATE_BODY|owner|privacy.yaml/);
 }finally{Object.assign(fs,originals);syncBuiltinESMExports();}
 assert.equal(fs.existsSync(join(root,'state/file-loads.jsonl')),false);
});

test("Missing baselines, framework drift, and unverifiable contracts must not report all-green; errors must not echo source content",()=>{
 const {f,root}=fixture();assert.equal(coreDiagnostics(root).drift.status,'baseline-missing');baseline(f,root);
 f.put('instance/core-space/synthetic-added.md','SYNTHETIC_PRIVATE_BODY');fs.unlinkSync(join(root,'core-space/policy.md'));f.put('instance/core-space/activation.md','Synthetic changed');
 let result=coreDiagnostics(root);assert.equal(result.status,'partial');assert.equal(result.drift.status,'changed');assert.equal(result.drift.changed,3);assert.doesNotMatch(JSON.stringify(result),/SYNTHETIC_PRIVATE_BODY/);
 f.put('instance/core-space/scripts/lib/update-contract.mjs','throw Error("SYNTHETIC_PRIVATE_BODY");');result=coreDiagnostics(root);assert.equal(result.status,'blocked');assert.equal(result.installedContract,'unknown');assert.ok(result.issues.some(row=>row.stage==='contract'));assert.doesNotMatch(JSON.stringify(result),/SYNTHETIC_PRIVATE_BODY/);
});

test("Invalid baseline paths and framework links are rejected without reading link targets",()=>{
 const {f,root}=fixture();f.put('instance/state/origin-baseline.txt','a'.repeat(64)+'  ../private.md\n');assert.equal(coreDiagnostics(root).drift.status,'unverified');
 const target=f.path('synthetic-outside');fs.mkdirSync(target);f.put('synthetic-outside/sentinel.md','SYNTHETIC_PRIVATE_BODY');
 baseline(f,root);fs.symlinkSync(target,join(root,'core-space/synthetic-link'),'junction');const result=coreDiagnostics(root);assert.equal(result.drift.status,'unverified');assert.doesNotMatch(JSON.stringify(result),/SYNTHETIC_PRIVATE_BODY|synthetic-outside/);
});

test("Existing load entry points expose explicit diagnostics and reject missing root or mixed loading/context arguments",()=>{
 const {f,root}=fixture(),script=join(SOURCE_ROOT,'product/core-space/scripts/aipa-load.mjs');baseline(f,root);
 const result=f.run(script,root,['--diagnostics']);assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).status,'checked');
 assert.equal(spawnSync(process.execPath,[script,'--diagnostics'],{cwd:f.root,env:f.env(),encoding:'utf8',windowsHide:true}).status,1);
 for(const args of [['--diagnostics','--context'],['--diagnostics','--file','user-space/profile.yaml'],['--diagnostics','--budget','123'],['--diagnostics','--unknown']])assert.equal(f.run(script,root,args).status,1);
});
