// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT_FOR_TESTS = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const scriptPath = (name) => join(REPO_ROOT_FOR_TESTS, 'studio', 'scripts', name);

function mkArtifactRepo() {
  const artifact = mkdtempSync(join(tmpdir(), 'aipa-art-'));
  execFileSync('git', ['init', '-b', 'master', artifact], { stdio: 'ignore' });
  execFileSync('git', ['-C', artifact, 'config', 'user.email', 't@e.com']);
  execFileSync('git', ['-C', artifact, 'config', 'user.name', 'T']);
  writeFileSync(join(artifact, 'seed.txt'), 'x\n');
  execFileSync('git', ['-C', artifact, 'add', '-A']);
  execFileSync('git', ['-C', artifact, 'commit', '-m', 'seed']);
  return artifact;
}


function setupOriginRepo(version) {
  const root = mkdtempSync(join(tmpdir(), 'aipa-pub-'));
  writeFileSync(join(root, 'ORIGIN-MANIFEST.yaml'), `origin:\n  version: ${version}\n  assist_prefix: "AIPA ${version} \u667a\u80fd\u4f53\u4e3a\u4f60\u534f\u4f5c："\n`);
  writeFileSync(join(root, 'framework.md'), "# \u6846\u67b6\n");
  const sums = ['ORIGIN-MANIFEST.yaml', 'framework.md']
    .map(f => `${createHash('sha256').update(readFileSync(join(root, f))).digest('hex')}  ${f}`)
    .join('\n') + '\n';
  writeFileSync(join(root, 'origin-checksums.txt'), sums);
  execFileSync('git', ['-C', root, 'init'], { stdio: 'ignore' });
  execFileSync('git', ['-C', root, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', root, 'config', 'user.name', 'Test']);
  return root;
}

function setupBuildRepo(branch) {
  const dir = mkdtempSync(join(tmpdir(), 'aipa-build-'));
  execFileSync('git', ['init', '-b', branch, dir], { stdio: 'ignore' });
  return dir;
}

function setupBuildRepoWithProduct(branch, version) {
  const root = mkdtempSync(join(tmpdir(), 'aipa-src-'));
  mkdirSync(join(root, 'product', 'core-space'), { recursive: true });
  writeFileSync(join(root, 'product', 'ORIGIN-MANIFEST.yaml'),
    `origin:\n  version: ${version}\n  assist_prefix: "AIPA ${version.split('.')[1]} \u667a\u80fd\u4f53\u4e3a\u4f60\u534f\u4f5c："\n`);
  writeFileSync(join(root, 'product', 'core-space', 'policy.md'), "# \u7ea2\u7ebf\n");
  execFileSync('git', ['init', '-b', branch, root], { stdio: 'ignore' });
  execFileSync('git', ['-C', root, 'config', 'user.email', 't@e.com']);
  execFileSync('git', ['-C', root, 'config', 'user.name', 'T']);
  execFileSync('git', ['-C', root, 'add', '-A']);
  execFileSync('git', ['-C', root, 'commit', '-m', 'build ' + branch]);
  return root;
}
const headOf = (r) => execFileSync('git', ['-C', r, 'symbolic-ref', '--short', 'HEAD'], { encoding: 'utf8' }).trim();

const committedManifestOf = (r) =>
  execFileSync('git', ['-C', r, 'show', 'HEAD:ORIGIN-MANIFEST.yaml'], { encoding: 'utf8' });
const tipSubjectOf = (r) =>
  execFileSync('git', ['-C', r, 'log', '-1', '--format=%s'], { encoding: 'utf8' }).trim();

const publish = (artifactRoot, buildRepo, ...extra) => execFileSync(
  'node',
  ['studio/scripts/aipa-publish-origin.mjs', '--root', artifactRoot, '--src', buildRepo, ...extra],
  { encoding: 'utf8' },
);

const assertRefused = (fn, re) => assert.throws(fn, (err) => err.status === 1 && re.test(String(err.stderr)));

test("Assembly rejects overlapping source/destination or missing sources without cleaning original content", () => {
  for (const kind of ['same', 'inside', 'ancestor', 'missing']) {
    const base = mkdtempSync(join(tmpdir(), 'aipa-overlap-')), src = join(base, 'source');
    mkdirSync(join(src, 'product'), { recursive: true });
    const sourceFile = join(src, 'product', 'marker.md'); writeFileSync(sourceFile, "\u539f\u59cb\u6e90\u5185\u5bb9");
    const dest = kind === 'same' ? src : kind === 'inside' ? join(src, 'product', 'out') : kind === 'ancestor' ? base : join(base, 'out');
    if (kind === 'missing') mkdirSync(dest);
    const result = spawnSync(process.execPath, [scriptPath('aipa-assemble-origin.mjs'), '--src', kind === 'missing' ? join(base, 'no-source') : src, '--dest', dest], { encoding: 'utf8' });
    assert.notEqual(result.status, 0, kind);
    assert.equal(readFileSync(sourceFile, 'utf8'), "\u539f\u59cb\u6e90\u5185\u5bb9");
  }
});

test("Publishing rejects unlisted files and unrelated pre-staging before switching branches", () => {
  const root = setupOriginRepo('9.99.0'), build = setupBuildRepo('dev');
  execFileSync('git', ['-C', root, 'symbolic-ref', 'HEAD', 'refs/heads/master']);
  writeFileSync(join(root, 'unlisted.md'), "\u4e0d\u53ef\u516c\u5f00\u7684\u5408\u6210\u5185\u5bb9");
  execFileSync('git', ['-C', root, 'add', 'unlisted.md']);
  assertRefused(() => publish(root, build), /manifest|checksum|staged/);
  assert.equal(headOf(root), 'master');
  assert.equal(readFileSync(join(root, 'unlisted.md'), 'utf8'), "\u4e0d\u53ef\u516c\u5f00\u7684\u5408\u6210\u5185\u5bb9");
});

test("Assembly copies deployment files and generates checksums", () => {
  const src = mkdtempSync(join(tmpdir(), 'aipa-src-'));
  const dest = mkdtempSync(join(tmpdir(), 'aipa-dest-'));
  mkdirSync(join(src, 'product', 'core-space'), { recursive: true });
  writeFileSync(join(src, 'product', 'core-space', 'policy.md'), "# \u4ef7\u503c\u89c2\u4e0e\u7ea2\u7ebf\n- \u7981\u6b62：\u751f\u6210\u8fdd\u6cd5\u5185\u5bb9\n");
  mkdirSync(join(src, 'product', 'scripts'), { recursive: true });
  writeFileSync(join(src, 'product', 'scripts', 'aipa-init.mjs'), '// init\n');
  mkdirSync(join(src, 'studio', 'scripts'), { recursive: true });
  writeFileSync(join(src, 'studio', 'scripts', 'aipa-validate-origin.mjs'), '// internal\n');
  execFileSync('node', ['studio/scripts/aipa-assemble-origin.mjs', '--src', src, '--dest', dest]);
  assert.ok(existsSync(join(dest, 'core-space', 'policy.md')));
  assert.ok(existsSync(join(dest, 'scripts', 'aipa-init.mjs')));
  assert.ok(!existsSync(join(dest, 'studio', 'scripts', 'aipa-validate-origin.mjs')), "Internal scripts must not be deployed");
  assert.match(readFileSync(join(dest, 'origin-checksums.txt'), 'utf8'), /core-space\/policy\.md/);
});

test("Publishing rejects invalid checksums", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-pub-'));
  execFileSync('git',['init','-b','master',root],{stdio:'pipe'});
  writeFileSync(join(root, 'policy.md'), "# \u4ef7\u503c\u89c2\n");
  writeFileSync(join(root, 'origin-checksums.txt'), 'deadbeef  policy.md\n');
  const build = setupBuildRepo('master');


  assertRefused(() => publish(root, build), /checksum mismatch/);
});

test("Publication commit messages include origin.version", () => {
  const root = setupOriginRepo('9.99.0');
  publish(root, setupBuildRepo('master'));
  const subject = execFileSync('git', ['-C', root, 'log', '-1', '--format=%s'], { encoding: 'utf8' }).trim();
  assert.strictEqual(subject, 'publish origin 9.99.0', "Commit messages must identify the release version");
});

test("Publishing without new changes does not crash", () => {
  const root = setupOriginRepo('9.99.0');
  const build = setupBuildRepo('master');
  publish(root, build);
  const out = publish(root, build);
  assert.match(out, /No new changes/, "A repeat run reports no new changes instead of throwing");
});

test("Publishing is local by default; --push publishes master and the matching version tag", () => {
  const root = mkArtifactRepo(), build = setupBuildRepoWithProduct('master', '9.99.0');
  execFileSync(process.execPath,[scriptPath('aipa-assemble-origin.mjs'),'--src',build,'--dest',root],{stdio:'pipe'});
  const bare = mkdtempSync(join(tmpdir(), 'aipa-bare-'));
  execFileSync('git', ['-C', bare, 'init', '--bare'], { stdio: 'ignore' });
  execFileSync('git', ['-C', root, 'remote', 'add', 'origin', bare]);

  publish(root, build);
  assert.strictEqual(
    execFileSync('git', ['-C', bare, 'branch', '--list'], { encoding: 'utf8' }).trim(), '',
    "Without --push, do not push to the remote");

  execFileSync('git', ['-C', root, 'tag', 'v9.99.0']);
  const out = publish(root, build, '--push');
  assert.notStrictEqual(
    execFileSync('git', ['-C', bare, 'branch', '--list'], { encoding: 'utf8' }).trim(), '',
    "--push publishes the branch");
  assert.match(execFileSync('git', ['-C', bare, 'tag'], { encoding: 'utf8' }), /v9\.99\.0/, "--push publishes the matching version tag");
  assert.match(out, /No new changes/, "Even without new changes, queued local commits can still be pushed");
});

test("A missing local version tag warns without failing branch publication", () => {
  const root = mkArtifactRepo(), build = setupBuildRepoWithProduct('master', '9.98.0');
  execFileSync(process.execPath,[scriptPath('aipa-assemble-origin.mjs'),'--src',build,'--dest',root],{stdio:'pipe'});
  const bare = mkdtempSync(join(tmpdir(), 'aipa-bare-'));
  execFileSync('git', ['-C', bare, 'init', '--bare'], { stdio: 'ignore' });
  execFileSync('git', ['-C', root, 'remote', 'add', 'origin', bare]);
  const out = publish(root, build, '--push');
  assert.match(out, /v9\.98\.0/, "Warn about the missing tag");
  assert.strictEqual(execFileSync('git', ['-C', bare, 'tag'], { encoding: 'utf8' }).trim(), '', "Do not invent a tag");
});

test("Assembly accepts absolute --src paths", () => {
  const src = mkdtempSync(join(tmpdir(), 'aipa-src-'));
  const dest = mkdtempSync(join(tmpdir(), 'aipa-dest-'));
  mkdirSync(join(src, 'product'), { recursive: true });
  writeFileSync(join(src, 'product', 'framework.md'), "# \u6846\u67b6\n");
  execFileSync('node', ['studio/scripts/aipa-assemble-origin.mjs', '--src', src, '--dest', dest]);
  assert.ok(existsSync(join(dest, 'framework.md')), "Deploy framework.md");
  assert.match(readFileSync(join(dest, 'origin-checksums.txt'), 'utf8'), /framework\.md/);
});

test("Assembly copies hooks.yaml", () => {
  const src = mkdtempSync(join(tmpdir(), 'aipa-src-'));
  const dest = mkdtempSync(join(tmpdir(), 'aipa-dest-'));
  mkdirSync(join(src, 'product', 'core-space', 'common'), { recursive: true });
  writeFileSync(join(src, 'product', 'core-space', 'common', 'hooks.yaml'), 'hooks:\n  after_input:\n    - privacy-filter\n');
  execFileSync('node', ['studio/scripts/aipa-assemble-origin.mjs', '--src', src, '--dest', dest]);
  assert.ok(existsSync(join(dest, 'core-space', 'common', 'hooks.yaml')), "Deploy hooks.yaml");
});

test("Clean assembly removes obsolete destination layout files", () => {
  const src = mkdtempSync(join(tmpdir(), 'aipa-src-'));
  const dest = mkdtempSync(join(tmpdir(), 'aipa-dest-'));

  mkdirSync(join(src, 'product', 'core-space'), { recursive: true });
  writeFileSync(join(src, 'product', 'core-space', 'policy.md'), "# \u65b0\n");

  mkdirSync(join(dest, 'core'), { recursive: true });
  writeFileSync(join(dest, 'core', 'framework.md'), "# \u65e7\n");
  writeFileSync(join(dest, 'policy.md'), "# \u65e7\u6839\n");
  execFileSync('node', ['studio/scripts/aipa-assemble-origin.mjs', '--src', src, '--dest', dest]);
  assert.ok(!existsSync(join(dest, 'core')), "Remove obsolete core directories");
  assert.ok(!existsSync(join(dest, 'policy.md')), "Remove obsolete root policy.md");
  assert.ok(existsSync(join(dest, 'core-space', 'policy.md')), "The new core-space/policy.md must exist");
});

test("Publishing from dev selects beta and writes channel beta", () => {
  const root = setupOriginRepo('9.99.0-beta.1');
  const build = setupBuildRepo('dev');
  publish(root, build);
  const manifest = readFileSync(join(root, 'ORIGIN-MANIFEST.yaml'), 'utf8');
  assert.match(manifest, /channel:\s*beta/, "Dev publication writes the beta artifact channel");
  assert.strictEqual(
    execFileSync('git', ['-C', root, 'symbolic-ref', '--short', 'HEAD'], { encoding: 'utf8' }).trim(),
    'beta', "Dev publication selects the artifact beta branch");
});

test("Publishing from master selects master and writes channel stable", () => {
  const root = setupOriginRepo('9.99.0');
  const build = setupBuildRepo('master');
  publish(root, build);
  assert.match(readFileSync(join(root, 'ORIGIN-MANIFEST.yaml'), 'utf8'), /channel:\s*stable/);
  assert.strictEqual(
    execFileSync('git', ['-C', root, 'symbolic-ref', '--short', 'HEAD'], { encoding: 'utf8' }).trim(),
    'master');
});

test("Non-release branches cannot publish, even for maintainers", () => {
  const root = setupOriginRepo('9.99.0');
  const build = setupBuildRepo('feature/whatever');
  assertRefused(() => publish(root, build), /requires Origin dev or master/);
});

test("Publishing rejects a channel inconsistent with the source branch", () => {
  const root = setupOriginRepo('9.99.0');
  const build = setupBuildRepo('master');
  assertRefused(() => publish(root, build, '--channel', 'beta'), /--channel differs from the source-branch channel/);
});

test("Publishing rejects a target branch inconsistent with the source branch", () => {
  const root = setupOriginRepo('9.99.0');
  const build = setupBuildRepo('master');
  assertRefused(() => publish(root, build, '--branch', 'beta'), /--branch differs from the derived destination/);
});

test("After dev publishes beta, stable publication from master returns the artifact to master", () => {
  const artifact = mkArtifactRepo();

  const assemble = (src) => execFileSync('node',
    ['studio/scripts/aipa-assemble-origin.mjs', '--src', src, '--dest', artifact]);

  const assertCommitted = (version, channel, leg) => {
    const manifest = committedManifestOf(artifact);
    const v = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');


    assert.match(manifest, new RegExp(`^\\s*channel:\\s*${channel}\\s*$`, 'm'), `${leg}: committed manifest channel must be ${channel}`);
    assert.match(manifest, new RegExp(`^\\s*version:\\s*${v}\\s*$`, 'm'), `${leg}: committed manifest version must be ${version}`);
    assert.strictEqual(tipSubjectOf(artifact), `publish origin ${version}`, `${leg}: branch tip must be the current publication commit`);
  };

  const bMaster = setupBuildRepoWithProduct('master', '0.20.0');
  assemble(bMaster);
  publish(artifact, bMaster);
  assert.strictEqual(headOf(artifact), 'master');
  assertCommitted('0.20.0', 'stable', "\u9996\u6b21 master \u53d1\u5e03");

  const bDev = setupBuildRepoWithProduct('dev', '0.21.0-beta.1');
  assemble(bDev);
  publish(artifact, bDev);
  assert.strictEqual(headOf(artifact), 'beta', "Dev publication targets beta");
  assert.match(readFileSync(join(artifact, 'ORIGIN-MANIFEST.yaml'), 'utf8'), /channel:\s*beta/);

  assertCommitted('0.21.0-beta.1', 'beta', "dev \u53d1 beta");

  const bMaster2 = setupBuildRepoWithProduct('master', '0.21.0');
  assemble(bMaster2);
  publish(artifact, bMaster2);
  assert.strictEqual(headOf(artifact), 'master', "Stable promotion returns to master");
  assert.match(readFileSync(join(artifact, 'ORIGIN-MANIFEST.yaml'), 'utf8'), /channel:\s*stable/);
  assertCommitted('0.21.0', 'stable', "\u63d0\u5347\u56de master");
});

test("Default source derives from the script repository independently of cwd", () => {

  const outcome = ({ cwd, src }) => {
    const artifact = mkArtifactRepo();
    const build = setupBuildRepoWithProduct('master', '0.20.0');
    execFileSync('node',
      [scriptPath('aipa-assemble-origin.mjs'), '--src', build, '--dest', artifact],
      { encoding: 'utf8' });
    const argv = [scriptPath('aipa-publish-origin.mjs'), '--root', artifact];
    if (src) argv.push('--src', src);
    try {
      const out = execFileSync('node', argv, { encoding: 'utf8', cwd });
      return `ok ${headOf(artifact)} ${String(out).trim()}`;
    } catch (e) {
      return `err ${String(e.stderr).trim()}`;
    }
  };
  const fromRepoRoot = outcome({ cwd: REPO_ROOT_FOR_TESTS });
  const fromNonRepo = outcome({ cwd: mkdtempSync(join(tmpdir(), 'aipa-cwd-')) });
  const explicitSrc = outcome({ cwd: REPO_ROOT_FOR_TESTS, src: REPO_ROOT_FOR_TESTS });
  assert.strictEqual(fromNonRepo, fromRepoRoot,
    "Default source must not depend on cwd");


  assert.strictEqual(fromRepoRoot, explicitSrc,
    "Default source must equal the explicit script repository root");
});

test("Artifact publication preserves tracked executable modes through Windows assembly and fresh cloning", () => {
  const build = setupBuildRepoWithProduct('dev', '0.24.0-beta.1'), artifact = mkArtifactRepo();
  mkdirSync(join(build,'product','core-space','githooks')); writeFileSync(join(build,'product','core-space','githooks','pre-commit'),'#!/bin/sh\nexit 0\n');
  execFileSync('git',['-C',build,'add','product/core-space/githooks/pre-commit']);
  execFileSync('git',['-C',build,'update-index','--chmod=+x','product/core-space/githooks/pre-commit']);
  execFileSync('git',['-C',build,'commit','-m','executable hook'],{stdio:'ignore'});
  execFileSync(process.execPath,['studio/scripts/aipa-assemble-origin.mjs','--src',build,'--dest',artifact],{stdio:'pipe'});
  publish(artifact,build);
  const clone = mkdtempSync(join(tmpdir(),'aipa-exec-clone-')); execFileSync('git',['clone',artifact,clone],{stdio:'pipe'});
  const tracked = execFileSync('git',['-C',clone,'ls-files','--stage','core-space/githooks/pre-commit'],{encoding:'utf8'});
  assert.match(tracked,/^100755 /); assert.doesNotMatch(readFileSync(join(clone,'core-space','githooks','pre-commit'),'utf8'),/\r/);
});

test("Shared-repository worktrees cannot serve as artifact repositories and rejection preserves build refs", () => {
  const build=setupBuildRepoWithProduct('dev','0.24.0-beta.1'),artifact=mkdtempSync(join(tmpdir(),'aipa-shared-git-artifact-'));
  execFileSync('git',['-C',build,'worktree','add','--detach',artifact,'HEAD'],{stdio:'pipe'});
  execFileSync(process.execPath,['studio/scripts/aipa-assemble-origin.mjs','--src',build,'--dest',artifact],{stdio:'pipe'});
  const before=execFileSync('git',['-C',build,'show-ref'],{encoding:'utf8'});
  assert.throws(()=>publish(artifact,build),e=>/share one Git repository/.test(String(e.stderr)));
  assert.equal(execFileSync('git',['-C',build,'show-ref'],{encoding:'utf8'}),before);
});
