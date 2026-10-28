// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, mkdirSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Initialization creates the personal-instance skeleton", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  execFileSync('node', ['product/scripts/aipa-init.mjs', '--root', root, '--owner', 'jun']);
  assert.ok(existsSync(join(root, 'AIPA-MANIFEST.yaml')));
  assert.ok(existsSync(join(root, 'user-space', 'profile.yaml')));
  assert.ok(existsSync(join(root, 'user-space', 'privacy.yaml')));
  assert.ok(existsSync(join(root, 'user-space', 'memory', 'context.md')));
});

test("Initialization creates a read-only baseline tag", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  execFileSync('node', ['product/scripts/aipa-init.mjs', '--root', root, '--owner', 'jun']);
  const tag = execFileSync('git', ['-C', root, 'tag']).toString().trim();
  assert.equal(tag, 'v' + readFileSync('product/VERSION', 'utf8').trim());
  assert.ok(existsSync(join(root, '.git')));
});

test("Self-contained instances no longer write state/base-dir", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  execFileSync('node', ['product/scripts/aipa-init.mjs', '--root', root, '--owner', 'jun']);
  assert.ok(!existsSync(join(root, 'state', 'base-dir')), "Do not write state/base-dir");
});

test("Initialization copies factory templates including logs and personal-instance AGENTS.md", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  execFileSync('node', ['product/scripts/aipa-init.mjs', '--root', root, '--owner', 'jun', '--industry', "\u5d4c\u5165\u5f0f\u5f00\u53d1", '--tech', 'C,Python']);
  assert.ok(existsSync(join(root, 'user-space', 'logs', 'daily')));
  assert.ok(existsSync(join(root, 'AGENTS.md')), "The copied personal-instance AGENTS.md must exist");
});

test("Initialization copies every split-memory template", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  execFileSync('node', ['product/scripts/aipa-init.mjs', '--root', root, '--owner', 'jun']);
  for (const f of ['preferences.md','terms.md','traits.md','decisions.md','patterns.md','keywords.md','summary.md']) {
    assert.ok(existsSync(join(root, 'user-space', 'memory', f)), `Missing user-space/memory/${f}`);
  }
  assert.ok(existsSync(join(root, 'user-space', 'memory', 'archive')));
  assert.ok(existsSync(join(root, 'user-space', 'memory', 'media')));
});

test("Initialization copies policy, dashboards, growth timeline, skills, projects, and ignore templates", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  execFileSync('node', ['product/scripts/aipa-init.mjs', '--root', root, '--owner', 'jun']);
  for (const f of ['CHANGELOG.md', '.gitignore']) assert.ok(existsSync(join(root, f)), `Missing ${f}`);
  assert.ok(existsSync(join(root, 'core-space', 'policy.md')), "Missing core-space/policy.md");
  for (const d of ['logs/monthly', 'logs/yearly', 'logs/dream', 'logs/offline-recovery', 'skills/work', 'skills/study', 'skills/life', 'skills/_sandbox', 'skills/mentors', 'projects']) {
    assert.ok(existsSync(join(root, 'user-space', d)), `Missing directory user-space/${d}`);
  }
  assert.ok(existsSync(join(root, 'user-space', 'logs', 'growth-timeline.md')));
  assert.ok(existsSync(join(root, 'core-space', 'common', 'skills')), "Missing core-space/common/skills");
});

test("Initialization creates the knowledge-base skeleton", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  execFileSync('node', ['product/scripts/aipa-init.mjs', '--root', root, '--owner', 'tester']);
  for (const d of ['inbox', 'self', 'external', '_index/cards']) {
    assert.ok(existsSync(join(root, 'user-space', 'knowledge-base', d)), `Missing knowledge-base/${d}`);
  }
  assert.ok(existsSync(join(root, 'user-space', 'knowledge-base', '_index', 'ignored-topics.md')));
});

test("Initialization creates the activation adapter", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  execFileSync('node', ['product/scripts/aipa-init.mjs', '--root', root, '--owner', 'jun']);
  const adapter = readFileSync(join(root, '.claude', 'commands', 'aipa.md'), 'utf8');
  assert.match(adapter, /assist_prefix/);
  assert.match(adapter, /\$ARGUMENTS/);
});

test("Generated AGENTS.md includes inactive identity and the activation protocol", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  execFileSync('node', ['product/scripts/aipa-init.mjs', '--root', root, '--owner', 'jun']);
  const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
  assert.match(agents, /Activation Protocol/);
  assert.match(agents, /core-space\/activation\.md/);
  const activation = readFileSync(join(root, 'core-space', 'activation.md'), 'utf8');
  assert.match(activation, /assist_prefix/);
  assert.ok(existsSync(join(root, 'core-space', 'common', 'skills', 'project-add')));
});

test("Initialization rejects existing instances with user-space", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  mkdirSync(join(root, 'user-space'), { recursive: true });
  assert.throws(() => execFileSync('node', ['product/scripts/aipa-init.mjs', '--root', root, '--owner', "\u6d4b\u8bd5"]));
});

test("Initialization rejects legacy flat-layout instances", () => {
  for (const leaf of ['profile.yaml', 'memory']) {
    const root = mkdtempSync(join(tmpdir(), 'aipa-'));
    if (leaf === 'memory') mkdirSync(join(root, 'memory'), { recursive: true });
    else writeFileSync(join(root, 'profile.yaml'), 'identity:\n  name: old\n');
    assert.throws(() => execFileSync('node', ['product/scripts/aipa-init.mjs', '--root', root, '--owner', "\u6d4b\u8bd5"]));
  }
});

test('Missing or invalid source metadata fails before creating an instance or inventing a version', () => {
  const work = mkdtempSync(join(tmpdir(), 'aipa-init-source-'));
  const source = join(work, 'source');
  cpSync('product', source, { recursive: true });
  const manifest = join(source, 'ORIGIN-MANIFEST.yaml');
  const valid = readFileSync(manifest, 'utf8');
  const cases = [null,
    valid.replace(/^  version:.*$/m, ''),
    valid.replace(/^  version:.*$/m, '  version: invalid'),
    valid.replace(/^  version:.*$/m, '  version: 1.0.0-untrusted trailing'),
    valid.replace(/^  assist_prefix:.*$/m, ''),
  ];
  try {
    for (let index = 0; index < cases.length; index++) {
      if (cases[index] === null) rmSync(manifest); else writeFileSync(manifest, cases[index]);
      const root = join(work, 'instance-' + index);
      assert.throws(() => execFileSync(process.execPath, [join(source, 'scripts/aipa-init.mjs'), '--root', root], { stdio: 'pipe' }),
        (error) => error.status === 1 && /Invalid source manifest|initialization cancelled/.test(String(error.stderr)));
      assert.equal(existsSync(root), false, 'Invalid metadata must not leave a partial instance');
    }
  } finally { rmSync(work, { recursive: true, force: true }); }
});

test("Generated manifests include the spaces list", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  execFileSync('node', ['product/scripts/aipa-init.mjs', '--root', root, '--owner', "\u6d4b\u8bd5"]);
  const m = readFileSync(join(root, 'AIPA-MANIFEST.yaml'), 'utf8');
  assert.match(m, /dir: core-space/);
  assert.match(m, /dir: user-space/);
});

test("Generated activation.md includes persistent end-of-turn instructions", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  execFileSync('node', ['product/scripts/aipa-init.mjs', '--root', root, '--owner', 'jun']);
  const activation = readFileSync(join(root, 'core-space', 'activation.md'), 'utf8');
  assert.match(activation, /End of Every Turn/);
  assert.match(activation, /aipa-checkpoint set/);

  assert.doesNotMatch(activation, /aipa-session status/);
});
