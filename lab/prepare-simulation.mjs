import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertEmptyStaging } from '../product/core-space/scripts/lib/git-staging.mjs';
import {cpSync,mkdirSync,existsSync} from 'node:fs';
import {createSyntheticFixture,LAB_ROOT} from './support/synthetic-fixture.mjs';
import {sourceExecutables,collectBuildSource} from '../studio/scripts/lib/artifact-modes.mjs';
function arg(n){const i=process.argv.indexOf('--'+n);return i>=0?process.argv[i+1]:'';}
const repo=arg('repo');
const push=process.argv.includes('--push');
if(!repo){console.error("Missing --repo");process.exit(1);}
const sourceRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..'),fixture=createSyntheticFixture({parent:process.env.AIPA_TEST_TMP||LAB_ROOT,prefix:'simulation-origin-'}),buildRoot=fixture.path('origin');
mkdirSync(buildRoot);
for(const rel of ['product','studio/scripts','studio/hooks','CLAUDE.md','.gitattributes'].filter(rel=>existsSync(join(sourceRoot,rel))))cpSync(join(sourceRoot,rel),join(buildRoot,rel),{recursive:true});
const git=args=>execFileSync('git',['-c','core.hooksPath=/dev/null','-c','commit.gpgSign=false','-C',buildRoot,...args],{stdio:'pipe',env:fixture.env()});
git(['init','--initial-branch=dev']);git(['add','--all']);
const executables=sourceExecutables(sourceRoot).map(path=>'product/'+path);if(executables.length)git(['update-index','--chmod=+x','--',...executables]);
git(['-c','user.name=Synthetic','-c','user.email=synthetic@example.invalid','commit','-qm','synthetic-public-simulation-source']);
fixture.put('source-provenance.json',JSON.stringify({schema:1,kind:'synthetic-only',upstreamWorkingTree:collectBuildSource(sourceRoot),simulationCommit:execFileSync('git',['-C',buildRoot,'rev-parse','HEAD'],{encoding:'utf8',env:fixture.env()}).trim(),officialRelease:false},null,2)+'\n');

assertEmptyStaging(repo,{requireRepository:true});
execFileSync(process.execPath,[join(buildRoot,'studio','scripts','aipa-assemble-origin.mjs'),'--src',buildRoot,'--dest',repo],{stdio:'inherit',env:fixture.env()});
execFileSync(process.execPath,[join(buildRoot,'studio','scripts','aipa-publish-origin.mjs'),'--src',buildRoot,'--root',repo,...(push?['--push']:[])],{stdio:'inherit',env:fixture.env()});
console.log('simulation prepared');
