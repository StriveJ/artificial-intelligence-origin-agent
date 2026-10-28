import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const check=args=>execFileSync(process.execPath,['studio/scripts/aipa-maintainer-check.mjs',...args],{encoding:'utf8'}).trim();
test('The canonical maintainer roster allows its listed account and denies an unlisted account',()=>{
 assert.equal(check(['--user','StriveJ']),'allow');
 assert.equal(check(['--maintainers','MAINTAINERS.md','--user','StriveJ']),'allow');
 assert.equal(check(['--user','synthetic-unlisted']),'deny');
});
test('GitHub code owners and the canonical maintainer roster identify the same public account',()=>{
 assert.match(readFileSync('.github/CODEOWNERS','utf8'),/^\* @StriveJ$/m);
 assert.match(readFileSync('MAINTAINERS.md','utf8'),/^- @StriveJ$/m);
});
