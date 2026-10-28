import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {createSyntheticFixture,LAB_ROOT} from '../../lab/support/synthetic-fixture.mjs';
import {qualityReferences} from '../scripts/lib/quality-refs.mjs';

function fixture(){
 const f=createSyntheticFixture({parent:LAB_ROOT,prefix:'quality-refs-'}),root=f.path('source');mkdirSync(root);
 const git=args=>execFileSync('git',['-c','core.hooksPath=/dev/null','-c','commit.gpgSign=false','-C',root,...args],{env:f.env(),encoding:'utf8',stdio:'pipe',windowsHide:true}).trim();
 git(['init','-b','dev']);f.put('source/public.md','# Synthetic\n');git(['add','--all']);git(['-c','user.name=Synthetic','-c','user.email=synthetic@example.invalid','commit','-qm','Synthetic source']);
 return {git};
}
test("Internal checkpoints do not alter business isolation identity; branches/tags/replacements/other Codex refs remain detectable",()=>{
 const {git}=fixture(),before=qualityReferences(git),head=git(['rev-parse','HEAD']),tree=git(['rev-parse','HEAD^{tree}']);
 git(['update-ref','refs/codex/turn-diffs/checkpoints/synthetic',tree]);assert.equal(qualityReferences(git),before);
 for(const ref of ['refs/heads/codex/synthetic','refs/tags/v0.0.0-test','refs/replace/'+'a'.repeat(40),'refs/codex/other-metadata']){
  git(['update-ref',ref,head]);assert.notEqual(qualityReferences(git),before,ref);git(['update-ref','-d',ref]);
 }
 assert.equal(qualityReferences(git),before);
});
test("Even with identical commits and refs, switching HEAD branches changes acceptance context",()=>{
 const {git}=fixture();git(['branch','other']);const before=qualityReferences(git);git(['checkout','other']);assert.notEqual(qualityReferences(git),before);
});
