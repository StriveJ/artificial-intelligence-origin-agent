import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createSyntheticFixture, LAB_ROOT, SOURCE_ROOT } from '../../support/synthetic-fixture.mjs';
import { stageHubSource } from '../../support/stage-hub.mjs';
import { hubCheckPaths } from '../../support/check-inputs.mjs';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
function git(root, args, env) {
  return execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgSign=false', '-C', root, ...args], { env, encoding: 'utf8', stdio: 'pipe', windowsHide: true }).trim();
}

test('Hub staging contains the complete public acceptance inventory without requiring dependencies or copying installation data', () => {
  const input = createSyntheticFixture({ parent: LAB_ROOT, prefix: 'stage-input-' });
  const output = createSyntheticFixture({ parent: LAB_ROOT, prefix: 'stage-output-' });
  for (const name of ['lib/public.mjs', 'public/app.js', 'tests/public.test.mjs', 'README.md', 'README_EN.md', 'README_CN.md', 'LICENSE', 'package.json', 'package-lock.json', '.gitattributes', '.gitignore', 'AGENTS.md', 'CHANGELOG.md', 'docs/release-process.md', 'docs/pushes.md', 'config.example.json', 'config.main.example.json', 'config.sub.example.json', 'server.mjs', 'start.sh', 'start.ps1']) input.put('source/' + name, name + '\n');
  for (const name of ['config.json', 'config.main.json', '.aipa-hub/runtime.json', 'user-space/profile.yaml', '.git/config']) input.put('source/' + name, 'Synthetic installation data must stay outside staging.\n');
  const source = input.path('source'), staged = stageHubSource(source, output);
  assert.deepEqual(hubCheckPaths(staged).sort(), hubCheckPaths(source).sort());
  const children = { lib: 'public.mjs', public: 'app.js', tests: 'public.test.mjs' };
  for (const path of hubCheckPaths(source)) {
    const file = children[path] ? join(path, children[path]) : path;
    assert.deepEqual(readFileSync(join(staged, file)), readFileSync(join(source, file)));
  }
  for (const name of ['node_modules', 'config.json', 'config.main.json', '.aipa-hub', 'user-space', '.git']) assert.equal(existsSync(join(staged, name)), false, name);
  input.put('source/node_modules/synthetic-package/index.js', 'export const fixture = true;\n');
  const withDependencies = stageHubSource(source, createSyntheticFixture({ parent: LAB_ROOT, prefix: 'stage-dependencies-' }));
  assert.equal(readFileSync(join(withDependencies, 'node_modules/synthetic-package/index.js'), 'utf8'), 'export const fixture = true;\n');
});

test('Fresh release requests reject absent, nonpositive, fractional, and unsafe sequence values before accessing source', () => {
  const f = createSyntheticFixture({ parent: LAB_ROOT, prefix: 'release-sequence-' });
  const entry = join(SOURCE_ROOT, 'lab/release/prepare-baseline.mjs');
  for (const value of [null, '0', '-1', '1.5', '1e3', '9007199254740992']) {
    const args = [entry, '--hub-source', f.path('nonexistent-public-source'), ...(value === null ? [] : ['--hub-sequence', value])];
    const result = spawnSync(process.execPath, args, { env: f.env(), encoding: 'utf8', windowsHide: true });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, value === null ? /explicit --hub-sequence/ : /positive safe integer/);
    assert.equal(existsSync(f.path('nonexistent-public-source')), false);
  }
});

// This deliberately small, independently signed fixture exercises release orchestration,
// not the separately tested Hub runtime. Its CLI reads committed bytes while rebuilds
// read checkout bytes, making missing license files and line-ending policy observable.
const fixturePackageModule = `
import {readFileSync,readdirSync,statSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash,sign,verify} from 'node:crypto';
export const canonical = value => JSON.stringify(value);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const allowed = name => /^(?:lib|public)\\//.test(name) || ['main-server.mjs','sub-server.mjs','package.json','package-lock.json','LICENSE'].includes(name);
export function buildReleasePayload({source,manifest,sourceFiles}) {
 const contents = {};
 if(sourceFiles) for(const [name,bytes] of sourceFiles) contents[name] = bytes.toString('base64');
 else { function visit(dir,prefix='') { for(const name of readdirSync(dir).sort()) { const path=join(dir,name),rel=prefix+name; if(statSync(path).isDirectory()) {if(['lib','public'].includes(rel))visit(path,rel+'/');} else if(allowed(rel))contents[rel]=readFileSync(path).toString('base64'); } } visit(source); }
 const sorted=Object.fromEntries(Object.entries(contents).sort(([a],[b])=>a<b?-1:a>b?1:0));
 const files=Object.fromEntries(Object.entries(sorted).map(([name,value])=>{const bytes=Buffer.from(value,'base64');return [name,{size:bytes.length,sha256:sha256(bytes)}];}));
 return {manifest:{...manifest,files},contents:sorted};
}
export function buildRelease({privateKey,keyId,...options}) { const payload=buildReleasePayload(options);return {payload,keyId,signature:sign(null,Buffer.from(canonical(payload)),privateKey).toString('base64')}; }
export function verifyRelease(file,trust) { const envelope=JSON.parse(readFileSync(file));if(!verify(null,Buffer.from(canonical(envelope.payload)),trust.keys[envelope.keyId],Buffer.from(envelope.signature,'base64')))throw Error('Untrusted release signature');return {manifest:envelope.payload.manifest,envelope,contents:envelope.payload.contents,digest:sha256(canonical(envelope))}; }
export function stageRelease(root,checked) {const path=join(root,checked.manifest.releaseId);mkdirSync(path,{recursive:true});return path;}
`;
const fixtureReleaseCli = `
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {generateKeyPairSync,sign} from 'node:crypto';
import {buildReleasePayload,canonical,sha256,allowed} from './lib/release-package.mjs';
const args=process.argv.slice(2),get=name=>args[args.indexOf(name)+1],json=path=>JSON.parse(readFileSync(path));
if(args[0]==='keygen'){const pair=generateKeyPairSync('ed25519');mkdirSync(get('--out'));writeFileSync(join(get('--out'),'private.pem'),pair.privateKey.export({type:'pkcs8',format:'pem'}));writeFileSync(join(get('--out'),'trust.json'),JSON.stringify({keys:{[get('--key-id')]:pair.publicKey.export({type:'spki',format:'pem'})}}));}
else if(args[0]==='prepare') {const root=get('--source'),git=(...args)=>execFileSync('git',['-C',root,...args]);const sourceFiles=git('ls-tree','-r','--name-only','HEAD').toString().trim().split('\\n').filter(allowed).map(name=>[name,git('show','HEAD:'+name)]);const manifest={releaseId:get('--id'),version:get('--version'),sequence:Number(get('--sequence')),sourceCommit:git('rev-parse','HEAD').toString().trim()};const payload=buildReleasePayload({source:root,manifest,sourceFiles});writeFileSync(get('--out'),JSON.stringify({schema:1,kind:'aipa-hub-signing-request',payload,payloadSha256:sha256(canonical(payload))}));}
else if(args[0]==='sign'){const request=json(get('--request'));if(sha256(canonical(request.payload))!==get('--expected-payload-sha256'))throw Error('Request digest mismatch');writeFileSync(get('--out'),JSON.stringify({payload:request.payload,keyId:get('--key-id'),signature:sign(null,Buffer.from(canonical(request.payload)),readFileSync(get('--key'))).toString('base64')}));}
else throw Error('Unknown fixture command');
`;

test('Frozen release preparation and reuse preserve the explicit sequence, license, and reproducible payload under both checkout policies', { timeout: 120_000 }, () => {
  const f = createSyntheticFixture({ parent: LAB_ROOT, prefix: 'release-preparation-' }), env = f.env();
  f.put('home/empty.gitconfig', '[user]\n name = Synthetic Release Test\n email = release@example.invalid\n[core]\n autocrlf = false\n');
  const origin = f.path('origin'), hub = f.path('hub');
  for (const name of ['product', 'studio/scripts', 'lab/support', 'lab/release', '.gitattributes']) {
    mkdirSync(join(origin, name, '..'), { recursive: true });
    cpSync(join(SOURCE_ROOT, name), join(origin, name), { recursive: true });
  }
  const putHub = (name, bytes) => f.put('hub/' + name, bytes);
  putHub('package.json', JSON.stringify({ type: 'module', version: '0.3.99' }) + '\n');
  putHub('package-lock.json', JSON.stringify({ version: '0.3.99', lockfileVersion: 3, packages: {} }) + '\n');
  putHub('LICENSE', 'Synthetic Apache-2.0 license fixture.\n');
  putHub('.gitattributes', '* text=auto eol=lf\npublic/binary.dat -text\n');
  putHub('main-server.mjs', '// Synthetic main program.\n');
  putHub('sub-server.mjs', '// Synthetic sub program.\n');
  putHub('public/binary.dat', Buffer.from([0, 10, 13, 255]));
  putHub('lib/release-package.mjs', fixturePackageModule);
  putHub('release.mjs', fixtureReleaseCli);
  for (const root of [origin, hub]) {
    git(root, ['init', '-q', '-b', 'master'], env);
    git(root, ['config', 'core.autocrlf', 'false'], env);
    git(root, ['config', 'user.name', 'Synthetic Release Test'], env);
    git(root, ['config', 'user.email', 'release@example.invalid'], env);
    git(root, ['add', '-A'], env);
    git(root, ['commit', '-qm', 'Synthetic release source'], env);
  }
  const execute = (entry, args, allowFailure = false) => {
    const result = spawnSync(process.execPath, [join(origin, 'lab/release', entry), ...args], { cwd: origin, env, encoding: 'utf8', windowsHide: true, timeout: 90_000 });
    if (!allowFailure) assert.equal(result.status, 0, result.stderr || result.error?.message || result.stdout);
    return result;
  };
  const prepare = args => execute('prepare-baseline.mjs', ['--hub-source', hub, ...args]);
  const first = JSON.parse(prepare(['--hub-sequence', '2026102801']).stdout.trim());
  const baseline = read(first.report), requestBytes = readFileSync(baseline.hub.requestFile), packageBytes = readFileSync(baseline.hub.packageFile);
  assert.equal(baseline.hub.manifest.sequence, 2026102801);
  assert.equal(baseline.hub.manifest.files.LICENSE.sha256, read(baseline.hub.requestFile).payload.manifest.files.LICENSE.sha256);
  assert.equal(readFileSync(join(dirname(baseline.hub.requestFile), 'hub-committed/LICENSE'), 'utf8'), 'Synthetic Apache-2.0 license fixture.\n');
  const reused = read(JSON.parse(prepare(['--hub-baseline', first.report]).stdout.trim()).report);
  assert.equal(reused.hub.manifest.sequence, 2026102801);
  assert.deepEqual(readFileSync(reused.hub.requestFile), requestBytes);
  assert.deepEqual(readFileSync(reused.hub.packageFile), packageBytes);
  assert.equal(reused.hub.digest, baseline.hub.digest);
  const wrong = execute('prepare-baseline.mjs', ['--hub-source', hub, '--hub-baseline', first.report, '--hub-sequence', '2026102802'], true);
  assert.notEqual(wrong.status, 0);
  assert.match(wrong.stderr, /preserve the frozen Hub sequence/);
  const reproduced = JSON.parse(execute('reproduce.mjs', ['--hub-source', hub, '--baseline', first.report]).stdout.trim());
  assert.deepEqual(reproduced.rows.map(row => row.autocrlf), ['false', 'true']);
  assert.ok(reproduced.rows.every(row => row.hubPayloadSha256 === baseline.hub.payloadSha256 && row.coreIdentity === baseline.core.identity));
  for (const root of [origin, hub]) assert.equal(git(root, ['status', '--porcelain', '--untracked-files=no'], env), '');
});
