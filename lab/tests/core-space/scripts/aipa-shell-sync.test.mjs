// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { makeTestDir } from '../../core-space/scripts/lib/test-tmp.mjs';

import {
  ensureAgentsPointer,
  checkShellFiles,
  collectRegisteredProjects,
  installShellFiles,
  loadShellManifest,
} from '../../../../product/core-space/scripts/lib/shell-sync.mjs';

const SOURCE_CONTENT = '# AIPA activation master\n\nprotocol v0.15.0\n';

function makeFixture() {
  const base = makeTestDir('aipa-shell-');
  const root = join(base, 'instance');
  const project = join(base, 'project');
  mkdirSync(join(root, '.ide_activation'), { recursive: true });
  mkdirSync(join(root, 'core-space', 'scripts'), { recursive: true });
  mkdirSync(join(root, 'user-space', 'projects'), { recursive: true });
  mkdirSync(project, { recursive: true });
  writeFileSync(join(root, '.ide_activation', 'aipa.md'), SOURCE_CONTENT, 'utf8');
  const manifest = {
    source: '.ide_activation/aipa.md',
    hosts: [
      { id: 'workbuddy', target: '.codebuddy/commands/aipa.md' },
      { id: 'claude', target: '.claude/commands/aipa.md' },
    ],
  };
  const manifestPath = join(root, 'core-space', 'scripts', 'aipa-shell-hosts.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  return { base, root, project, manifestPath };
}

test('first install distributes master to all host dirs and ignores non-AGENTS files', () => {
  const { base, root, project, manifestPath } = makeFixture();
  try {
    installShellFiles({ instanceRoot: root, projectRoot: project, manifestPath });

    for (const target of ['.claude/commands/aipa.md', '.codebuddy/commands/aipa.md']) {
      const p = join(project, target);
      assert.equal(existsSync(p), true, `${target} should exist`);
      assert.equal(readFileSync(p, 'utf8'), SOURCE_CONTENT);
    }

    const gi = readFileSync(join(project, '.gitignore'), 'utf8');
    for (const entry of [
      'AIPA-INSTANCE.md',
      '.claude/commands/aipa.md',
      '.codebuddy/commands/aipa.md',


      '.claude/session-history/',
    ]) {
      assert.ok(gi.includes(entry), `.gitignore should include ${entry}`);
    }
    assert.equal(existsSync(join(project, '.ide_activation')), false, 'project has no master copy');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('refresh after manual drift restores the host copy from master', () => {
  const { base, root, project, manifestPath } = makeFixture();
  try {
    installShellFiles({ instanceRoot: root, projectRoot: project, manifestPath });
    const claudeShell = join(project, '.claude', 'commands', 'aipa.md');
    writeFileSync(claudeShell, '# tampered\n', 'utf8');

    installShellFiles({ instanceRoot: root, projectRoot: project, manifestPath });

    assert.equal(readFileSync(claudeShell, 'utf8'), SOURCE_CONTENT);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('check reports stale shell when a host copy diverged from master', () => {
  const { base, root, project, manifestPath } = makeFixture();
  try {
    installShellFiles({ instanceRoot: root, projectRoot: project, manifestPath });
    const codebuddyShell = join(project, '.codebuddy', 'commands', 'aipa.md');
    writeFileSync(codebuddyShell, '# stale\n', 'utf8');

    const report = checkShellFiles({ instanceRoot: root, projectRoot: project, manifestPath });

    assert.ok(report.stale.includes(codebuddyShell), `expected stale: ${codebuddyShell}`);
    assert.equal(report.missing.length, 0);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('check on instance root does not require project gitignore entries', () => {
  const { base, root, manifestPath } = makeFixture();
  try {
    installShellFiles({ instanceRoot: root, projectRoot: root, manifestPath });
    const report = checkShellFiles({ instanceRoot: root, projectRoot: root, manifestPath });
    assert.equal(report.ignoreMissing.length, 0);
    assert.equal(report.missing.length, 0);
    assert.equal(report.stale.length, 0);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('collectRegisteredProjects reads each project local_path', () => {
  const { base, root } = makeFixture();
  try {
    const p1 = join(base, 'p1');
    const p2 = join(base, 'p2');
    mkdirSync(p1, { recursive: true });
    mkdirSync(p2, { recursive: true });
    mkdirSync(join(root, 'user-space', 'projects', 'p1'), { recursive: true });
    mkdirSync(join(root, 'user-space', 'projects', 'p2'), { recursive: true });
    writeFileSync(join(root, 'user-space', 'projects', 'p1', 'local_path'), p1 + '\n', 'utf8');
    writeFileSync(join(root, 'user-space', 'projects', 'p2', 'local_path'), p2 + '\n', 'utf8');

    assert.deepEqual(collectRegisteredProjects(root).sort(), [p1, p2].sort());
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('empty hostIds filter means all hosts are installed', () => {
  const { base, root, project, manifestPath } = makeFixture();
  try {
    installShellFiles({ instanceRoot: root, projectRoot: project, manifestPath, hostIds: [] });
    assert.equal(existsSync(join(project, '.codebuddy', 'commands', 'aipa.md')), true);
    assert.equal(existsSync(join(project, '.claude', 'commands', 'aipa.md')), true);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('hostIds filter installs only selected host', () => {
  const { base, root, project, manifestPath } = makeFixture();
  try {
    installShellFiles({ instanceRoot: root, projectRoot: project, manifestPath, hostIds: ['claude'] });
    assert.equal(existsSync(join(project, '.codebuddy', 'commands', 'aipa.md')), false);
    assert.equal(existsSync(join(project, '.claude', 'commands', 'aipa.md')), true);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('ensureAgentsPointer appends machine-neutral pointer and preserves project AGENTS', () => {
  const { base, root, project } = makeFixture();
  try {
    writeFileSync(join(project, 'AGENTS.md'), '# Existing project rules\n', 'utf8');
    assert.equal(ensureAgentsPointer(project), true);
    const content = readFileSync(join(project, 'AGENTS.md'), 'utf8');
    assert.ok(content.startsWith('# Existing project rules'));
    assert.ok(content.includes("If AIPA-INSTANCE.md exists"));
    assert.ok(!content.includes(join(root, '.ide_activation')));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('ensureAgentsPointer is idempotent', () => {
  const { base, root, project } = makeFixture();
  try {
    ensureAgentsPointer(project);
    assert.equal(ensureAgentsPointer(project), false);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('loadShellManifest validates source and host ids', () => {
  const { base, manifestPath } = makeFixture();
  try {
    const manifest = loadShellManifest(manifestPath);
    assert.equal(manifest.source, '.ide_activation/aipa.md');
    assert.deepEqual(manifest.hosts.map((h) => h.id), ['workbuddy', 'claude']);
    assert.equal(manifest.hosts.every((h) => h.target && h.id), true);
  } finally {

    rmSync(base, { recursive: true, force: true });
  }
});
