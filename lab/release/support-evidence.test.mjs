// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {supportGatePassed} from './support-evidence.mjs';
const names=path=>[...readFileSync(new URL(path,import.meta.url),'utf8').matchAll(/test\((['"])(.*?)\1/g)].map(match=>match[2]);
test("Support/diagnostic acceptance requires every named case in complete gates for both repositories; targeted, incomplete, unknown, or skipped results cannot substitute",()=>{
 const origin={suite:'origin',status:'passed',exitCode:0,sourceChanged:false,test:null,command:['/synthetic/studio/scripts/aipa-check.mjs','--mode','all']},hub={...origin,suite:'hub',command:['/synthetic/tests/support-diagnostics.test.mjs']};
 const a=names('../tests/repairs/support-diagnostics.test.mjs').map((name,i)=>'ok '+(i+1)+' - '+name).join('\n');

 const hubTitles=["Hub support derives from package and protocol; missing declarations, capabilities, and restart states are distinct","Core adapter exposes loaded-generation declarations and retains them after code changes without claiming reload","Paired status diagnoses blocked Core; context failures and retries clear accurately without diagnostic model calls"],hubLog=hubTitles.map((name,i)=>'ok '+(i+1)+' - '+name).join('\n');
 assert.equal(supportGatePassed(origin,hub,a,hubLog),true);
 for(const [o,h,x,y] of [[{...origin,suite:'repairs'},hub,a,hubLog],[origin,{...hub,test:'support-diagnostics.test.mjs'},a,hubLog],[{...origin,sourceChanged:true},hub,a,hubLog],[origin,hub,a.replace('ok 1','not ok 1'),hubLog],[origin,hub,a,hubLog+' # SKIP'],[origin,hub,'',hubLog]])assert.equal(supportGatePassed(o,h,x,y),false);
});
