// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeChecksums } from '../../product/core-space/scripts/lib/origin-checksums.mjs';


function makeRemote() {
  const remote = mkdtempSync(join(tmpdir(), 'aipa-remote-'));
  const work = mkdtempSync(join(tmpdir(), 'aipa-work-'));
  execFileSync('git', ['init', '--bare', remote], { stdio: 'ignore' });
  execFileSync('git', ['init', work], { stdio: 'ignore' });
  execFileSync('git', ['-C', work, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', work, 'config', 'user.name', 'Test']);
  execFileSync('git', ['-C', work, 'remote', 'add', 'origin', remote]);
  return { remote, work };
}
function publish(work, manifestVersion) {
  mkdirSync(join(work, 'core-space', 'common'), { recursive: true });
  writeFileSync(join(work, 'core-space', 'common', 'hooks.yaml'), 'hooks: []\n', 'utf8');
  mkdirSync(join(work, 'core-space', 'scripts'), { recursive: true });
  writeFileSync(join(work, 'core-space', 'scripts', 'aipa-session.mjs'), '// runtime\n', 'utf8');
  mkdirSync(join(work, 'templates', 'personal'), { recursive: true });
  writeFileSync(join(work, 'templates', 'personal', 'AGENTS.md'), "# \u65b0\u5165\u53e3\n", 'utf8');
  writeFileSync(join(work, 'ORIGIN-MANIFEST.yaml'), `origin:\n  version: ${manifestVersion}\n  assist_prefix: "AIPA ${manifestVersion.split('.')[0]}.${manifestVersion.split('.')[1]} \u667a\u80fd\u4f53\u4e3a\u4f60\u534f\u4f5c："\n`, 'utf8');
  writeFileSync(join(work, '.gitattributes'), '* -text\n');
  writeChecksums(work);
  execFileSync('git', ['-C', work, 'add', '-A']);
  execFileSync('git', ['-C', work, 'commit', '-m', 'init'], { stdio: 'ignore' });
  execFileSync('git', ['-C', work, 'push', '-u', 'origin', 'master'], { stdio: 'ignore' });
}

test("Pull clones upstream and synchronizes Core scripts and entry shells", () => {
  const { remote, work } = makeRemote();
  publish(work, '0.04.0');
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  writeFileSync(join(root, 'AIPA-MANIFEST.yaml'), "aipa:\n  version: 0.03.0\n  owner: \u6d4b\u8bd5\n  mode: consume\n  assist_prefix: \"AIPA 0.03 \u667a\u80fd\u4f53\u4e3a\u4f60\u534f\u4f5c：\"\n", 'utf8');
  execFileSync('node', ['product/core-space/scripts/aipa-pull-origin.mjs', '--root', root, '--remote', remote]);
  assert.match(readFileSync(join(root, 'AGENTS.md'), 'utf8'), /\u65b0\u5165\u53e3/);
  assert.ok(existsSync(join(root, 'core-space', 'common', 'hooks.yaml')));
  assert.ok(existsSync(join(root, 'core-space', 'scripts', 'aipa-session.mjs')), "Runtime scripts must synchronize with core-space");
});

test("Pull advances version/assist_prefix while preserving owner/mode/spaces", () => {
  const { remote, work } = makeRemote();
  publish(work, '0.04.0');
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  writeFileSync(join(root, 'AIPA-MANIFEST.yaml'), "aipa:\n  version: 0.03.0\n  owner: \u6d4b\u8bd5\n  mode: consume\n  assist_prefix: \"AIPA 0.03 \u667a\u80fd\u4f53\u4e3a\u4f60\u534f\u4f5c：\"\n  spaces:\n    - dir: core-space\n      owner: framework\n      overwrite: true\n    - dir: user-space\n      owner: personal\n      overwrite: false\n", 'utf8');
  execFileSync('node', ['product/core-space/scripts/aipa-pull-origin.mjs', '--root', root, '--remote', remote]);
  const m = readFileSync(join(root, 'AIPA-MANIFEST.yaml'), 'utf8');
  assert.match(m, /version: 0\.04\.0/);
  assert.match(m, /assist_prefix: "AIPA 0\.04 \u667a\u80fd\u4f53\u4e3a\u4f60\u534f\u4f5c："/);
  assert.match(m, /owner: \u6d4b\u8bd5/);
  assert.match(m, /mode: consume/);
  assert.match(m, /- dir: user-space/);
  assert.doesNotMatch(m, /version: 0\.03\.0/);

  assert.match(m, /\n\s+version: 0\.04\.0/);
  assert.match(m, /\n\s+assist_prefix: "AIPA 0\.04 \u667a\u80fd\u4f53\u4e3a\u4f60\u534f\u4f5c："/);
  assert.doesNotMatch(m, /^version:/m);
  assert.doesNotMatch(m, /^assist_prefix:/m);
});

test("Pull skips bases that are not newer than the instance", () => {
  const { remote, work } = makeRemote();
  publish(work, '0.02.0');
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  writeFileSync(join(root, 'AIPA-MANIFEST.yaml'), 'aipa:\n  version: 0.03.0\n', 'utf8');
  const out = execFileSync('node', ['product/core-space/scripts/aipa-pull-origin.mjs', '--root', root, '--remote', remote], { encoding: 'utf8' });
  assert.match(out, /Already current/);
  assert.ok(!existsSync(join(root, 'AGENTS.md')));
});

test("Pull preserves personal user-space bytes", () => {
  const { remote, work } = makeRemote();
  publish(work, '0.04.0');
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  mkdirSync(join(root, 'user-space'), { recursive: true });
  writeFileSync(join(root, 'user-space', 'profile.yaml'), "identity:\n  name: \u6d4b\u8bd5\n", 'utf8');
  writeFileSync(join(root, 'AIPA-MANIFEST.yaml'), 'aipa:\n  version: 0.03.0\n', 'utf8');
  const before = readFileSync(join(root, 'user-space', 'profile.yaml'), 'utf8');
  execFileSync('node', ['product/core-space/scripts/aipa-pull-origin.mjs', '--root', root, '--remote', remote]);
  const after = readFileSync(join(root, 'user-space', 'profile.yaml'), 'utf8');
  assert.strictEqual(after, before);
});

test("Unreachable upstream remotes cause a visible pull failure", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  writeFileSync(join(root, 'AIPA-MANIFEST.yaml'), 'aipa:\n  version: 0.03.0\n', 'utf8');
  assert.throws(() => execFileSync('node', ['product/core-space/scripts/aipa-pull-origin.mjs', '--root', root, '--remote', join(tmpdir(), 'nope-remote')], { stdio: 'ignore' }));
});

test("Pull rejects wrong hashes and missing/invalid manifests before overwriting", () => {
  for (const kind of ['hash', 'missing', 'traversal']) {
    const { remote, work } = makeRemote(); publish(work, '0.04.0');
    if (kind === 'hash') writeFileSync(join(work, 'core-space', 'common', 'hooks.yaml'), 'hooks: [changed]\n');
    else if (kind === 'missing') writeFileSync(join(work, 'origin-checksums.txt'), '');
    else writeFileSync(join(work, 'origin-checksums.txt'), 'a'.repeat(64) + '  ../outside\n');
    execFileSync('git', ['-C', work, 'add', '-A']); execFileSync('git', ['-C', work, 'commit', '-m', 'invalid integrity'], { stdio: 'ignore' });
    execFileSync('git', ['-C', work, 'push'], { stdio: 'ignore' });
    const root = mkdtempSync(join(tmpdir(), 'aipa-update-refused-'));
    const manifest = 'aipa:\n  version: 0.03.0\n'; writeFileSync(join(root, 'AIPA-MANIFEST.yaml'), manifest);
    mkdirSync(join(root, 'core-space')); writeFileSync(join(root, 'core-space', 'keep.md'), "\u73b0\u6709\u6846\u67b6");
    assert.throws(() => execFileSync(process.execPath, ['product/core-space/scripts/aipa-pull-origin.mjs', '--root', root, '--remote', remote], { stdio: 'pipe' }), e => e.status === 1 && /checksum|path|manifest|Checksum/.test(String(e.stderr)));
    assert.equal(readFileSync(join(root, 'core-space', 'keep.md'), 'utf8'), "\u73b0\u6709\u6846\u67b6");
    assert.equal(readFileSync(join(root, 'AIPA-MANIFEST.yaml'), 'utf8'), manifest);
    assert.equal(existsSync(join(root, 'state', 'origin-baseline.txt')), false);
  }
});

test("Pull rejects existing staging and preserves the original index and instance", () => {
  const { remote, work } = makeRemote(); publish(work, '0.04.0');
  const root = mkdtempSync(join(tmpdir(), 'aipa-staged-'));
  execFileSync('git', ['init', '-b', 'master', root], { stdio: 'ignore' });
  const git = args => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  git(['config', 'user.name', 'Test']); git(['config', 'user.email', 'test@example.com']);
  writeFileSync(join(root, 'AIPA-MANIFEST.yaml'), 'aipa:\n  version: 0.03.0\n');
  writeFileSync(join(root, 'private.md'), "\u65e7\u5185\u5bb9"); git(['add', '-A']); git(['commit', '-m', 'initial']);
  writeFileSync(join(root, 'private.md'), "\u79c1\u6709\u4fee\u6539"); git(['add', 'private.md']);
  const before = git(['diff', '--cached']), head = git(['rev-parse', 'HEAD']);
  assert.throws(() => execFileSync(process.execPath, ['product/core-space/scripts/aipa-pull-origin.mjs', '--root', root, '--remote', remote], { stdio: 'pipe' }), e => /staged/.test(String(e.stderr)));
  assert.equal(git(['diff', '--cached']), before); assert.equal(git(['rev-parse', 'HEAD']), head);
  assert.equal(existsSync(join(root, 'state', '.origin-cache')), false);
});

test("Non-Git instance directories cannot commit or tag parent repositories", () => {
  const { remote, work } = makeRemote(); publish(work, '0.04.0');
  const parent = mkdtempSync(join(tmpdir(), 'aipa-parent-repo-'));
  execFileSync('git', ['init', '-b', 'master', parent], { stdio: 'ignore' });
  const git = args => execFileSync('git', ['-C', parent, ...args], { encoding: 'utf8' });
  git(['config', 'user.name', 'Test']); git(['config', 'user.email', 'test@example.com']);
  writeFileSync(join(parent, 'seed.md'), "\u7236\u4ed3\u5185\u5bb9"); git(['add', '-A']); git(['commit', '-m', 'seed']);
  const before = git(['show-ref']), root = join(parent, 'instance'); mkdirSync(root);
  writeFileSync(join(root, 'AIPA-MANIFEST.yaml'), 'aipa:\n  version: 0.03.0\n');
  execFileSync(process.execPath, ['product/core-space/scripts/aipa-pull-origin.mjs', '--root', root, '--remote', remote], { stdio: 'pipe' });
  assert.equal(git(['show-ref']), before);
  assert.equal(git(['diff', '--cached']), '');
});

test("Malformed manifests or baselines reject before overwriting", () => {
  for (const kind of ['manifest', 'baseline']) {
    const { remote, work } = makeRemote(); publish(work, '0.04.0');
    const root = mkdtempSync(join(tmpdir(), 'aipa-state-preflight-'));
    const manifest = kind === 'manifest' ? 'aipa:\nversion: 0.03.0\n' : 'aipa:\n  version: 0.03.0\n';
    writeFileSync(join(root, 'AIPA-MANIFEST.yaml'), manifest);
    mkdirSync(join(root, 'core-space')); writeFileSync(join(root, 'core-space', 'sentinel.md'), "\u539f\u59cb\u5185\u5bb9");
    if (kind === 'baseline') { mkdirSync(join(root, 'state')); writeFileSync(join(root, 'state', 'origin-baseline.txt'), 'broken'); }
    assert.throws(() => execFileSync(process.execPath, ['product/core-space/scripts/aipa-pull-origin.mjs', '--root', root, '--remote', remote], { stdio: 'pipe' }), e => e.status === 1 && /preflight/.test(String(e.stderr)));
    assert.equal(readFileSync(join(root, 'core-space', 'sentinel.md'), 'utf8'), "\u539f\u59cb\u5185\u5bb9");
    assert.equal(readFileSync(join(root, 'AIPA-MANIFEST.yaml'), 'utf8'), manifest);
  }
});

test("Failed synchronization commits exit visibly with channel writeback already included in the candidate", () => {
  const { remote, work } = makeRemote(); publish(work, '0.04.0');
  const root = mkdtempSync(join(tmpdir(), 'aipa-commit-failure-'));
  execFileSync('git', ['init', '-b', 'master', root], { stdio: 'ignore' });
  const git = args => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  git(['config', 'user.name', 'Test']); git(['config', 'user.email', 'test@example.com']);
  writeFileSync(join(root, 'AIPA-MANIFEST.yaml'), 'aipa:\n  version: 0.03.0\n  channel: beta\n');
  git(['add', '-A']); git(['commit', '-m', 'initial']); const head = git(['rev-parse', 'HEAD']);
  writeFileSync(join(root, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  assert.throws(() => execFileSync(process.execPath, ['product/core-space/scripts/aipa-pull-origin.mjs', '--root', root, '--remote', remote, '--channel', 'stable'], { stdio: 'pipe' }), e => e.status === 1 && /sync commit failed/.test(String(e.stderr)) && !/Base updated/.test(String(e.stdout)));
  assert.equal(git(['rev-parse', 'HEAD']), head);
  assert.match(git(['show', ':AIPA-MANIFEST.yaml']), /channel: stable/);
  assert.equal(git(['tag', '--list', 'v0.04.0']), '');
});
