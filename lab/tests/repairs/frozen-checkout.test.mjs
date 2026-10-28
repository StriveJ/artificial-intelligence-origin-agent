import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,posix} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createSyntheticFixture,LAB_ROOT,SOURCE_ROOT} from '../../support/synthetic-fixture.mjs';

test("Fresh autocrlf checkouts preserve the frozen evaluator bytes",()=>{
  const f=createSyntheticFixture({parent:LAB_ROOT,prefix:'frozen-checkout-'}),files=new Map();
  for(const generation of ['answer-acceptance']){
    const frozen=JSON.parse(readFileSync(join(SOURCE_ROOT,'lab',generation,'freeze.json'),'utf8'));
    for(const [name,digest] of frozen.program.files){
      const path=posix.normalize('lab/'+generation+'/'+name);
      assert.ok(path.startsWith('lab/'));files.set(path,digest);
    }
  }
  f.put('source/.gitattributes',readFileSync(join(SOURCE_ROOT,'.gitattributes')));
  for(const path of files.keys())f.put('source/'+path,readFileSync(join(SOURCE_ROOT,path)));
  const source=f.path('source'),clone=f.path('checkout');
  const git=args=>execFileSync('git',['-c','core.hooksPath=/dev/null','-c','commit.gpgSign=false',...args],{env:f.env(),stdio:'pipe',windowsHide:true});
  git(['init',source]);git(['-C',source,'add','--all']);
  git(['-C',source,'-c','user.name=Synthetic','-c','user.email=synthetic@example.invalid','commit','-qm','frozen program fixture']);
  git(['-c','core.autocrlf=true','clone','--no-local','--no-hardlinks',source,clone]);
  for(const [path,digest] of files)assert.equal(createHash('sha256').update(readFileSync(join(clone,path))).digest('hex'),digest,path);
});
