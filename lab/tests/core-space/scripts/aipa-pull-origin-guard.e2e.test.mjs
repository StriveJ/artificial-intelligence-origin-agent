// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { makeTestDir } from './lib/test-tmp.mjs';
import { PRODUCT, git, makeOrigin, commitAll } from './lib/test-git.mjs';

const PULL = join(PRODUCT, 'core-space', 'scripts', 'aipa-pull-origin.mjs');
const INIT = join(PRODUCT, 'scripts', 'aipa-init.mjs');

test("Pull creates a separate derived-framework commit and a version-anchor tag", () => {
  const origin = makeOrigin('9.01.0');
  const inst = makeTestDir('aipa-inst-');
  try {
    execFileSync('node', [INIT, '--root', inst, '--owner', 't'], { encoding: 'utf8' });
    execFileSync('node', [PULL, '--root', inst, '--remote', origin], { encoding: 'utf8' });
    const log = git(inst, ['log', '--oneline']);
    assert.match(log, /chore\(sync\): base/, "Synchronization creates a separate commit");
    const tags = git(inst, ['tag']);
    assert.match(tags, /v9\.01\.0/, "Create the version-anchor tag");
    assert.equal(git(inst, ['status', '--porcelain']).trim(), '', "The workspace must be clean after synchronization");
  } finally {
    rmSync(origin, { recursive: true, force: true });
    rmSync(inst, { recursive: true, force: true });
  }
});

test("Dirty framework paths reject pulls and preserve modified-file bytes", () => {
  const origin = makeOrigin('9.02.0');
  const inst = makeTestDir('aipa-inst-');
  try {
    execFileSync('node', [INIT, '--root', inst, '--owner', 't'], { encoding: 'utf8' });
    const target = join(inst, 'core-space', 'scripts', 'aipa-summarize.mjs');
    const before = readFileSync(target, 'utf8');
    const edited = before + '\n// LOCAL-EDIT-PROBE\n';
    writeFileSync(target, edited);

    let failed = false;
    try {
      execFileSync('node', [PULL, '--root', inst, '--remote', origin], { encoding: 'utf8', stdio: 'pipe' });
    } catch { failed = true; }
    assert.equal(failed, true, "A dirty framework workspace must reject the pull");
    assert.equal(readFileSync(target, 'utf8'), edited, "Local edits must survive byte for byte");
  } finally {
    rmSync(origin, { recursive: true, force: true });
    rmSync(inst, { recursive: true, force: true });
  }
});

test("Pull writes a framework-only instance baseline", () => {
  const origin = makeOrigin('9.03.0');
  const inst = makeTestDir('aipa-inst-');
  try {
    execFileSync('node', [INIT, '--root', inst, '--owner', 't'], { encoding: 'utf8' });
    execFileSync('node', [PULL, '--root', inst, '--remote', origin], { encoding: 'utf8' });
    const text = readFileSync(join(inst, 'state', 'origin-baseline.txt'), 'utf8');
    assert.match(text, /^[0-9a-f]{64}\s+\S+/m, "The baseline is a SHA-256 manifest");
    const paths = text.split(/\r?\n/).filter(Boolean).map((l) => l.slice(66).trim());
    assert.equal(paths.some((p) => p.startsWith('core-space/')), true, "The baseline includes core-space paths");
    assert.equal(paths.some((p) => p.startsWith('user-space/')), false, "The baseline excludes personal user-space paths");
    assert.equal(paths.some((p) => p.startsWith('scripts/')), false, "The baseline excludes base-only installers absent from instances");
  } finally {
    rmSync(origin, { recursive: true, force: true });
    rmSync(inst, { recursive: true, force: true });
  }
});





test("After a clean pull, every baseline hash matches the corresponding instance file", () => {
  const origin = makeOrigin('9.04.0');
  const inst = makeTestDir('aipa-inst-');
  try {
    execFileSync('node', [INIT, '--root', inst, '--owner', 't'], { encoding: 'utf8' });
    execFileSync('node', [PULL, '--root', inst, '--remote', origin], { encoding: 'utf8' });
    const lines = readFileSync(join(inst, 'state', 'origin-baseline.txt'), 'utf8').split(/\r?\n/).filter(Boolean);
    assert.ok(lines.length > 0, "The baseline must not be empty");
    const mismatched = [];
    for (const line of lines) {
      const hash = line.slice(0, 64);
      const rel = line.slice(66).trim();
      const p = join(inst, rel);
      if (!existsSync(p)) { mismatched.push(rel + "（\u5b9e\u4f8b\u4e2d\u7f3a\u5931）"); continue; }
      const actual = createHash('sha256').update(readFileSync(p)).digest('hex');
      if (actual !== hash) mismatched.push(rel);
    }
    assert.deepEqual(mismatched, [], "Baseline tokens must match actual files so clean instances are not misclassified as edited");
  } finally {
    rmSync(origin, { recursive: true, force: true });
    rmSync(inst, { recursive: true, force: true });
  }
});




test("Baseline updates preserve prior tokens for paths outside the overwrite scope", () => {
  const origin = makeOrigin('9.05.0');

  writeFileSync(join(origin, '.claude', 'extra.md'), 'extra v1\n');
  commitAll(origin, 'add .claude/extra.md');
  const inst = makeTestDir('aipa-inst-');
  try {
    execFileSync('node', [INIT, '--root', inst, '--owner', 't'], { encoding: 'utf8' });


    writeFileSync(join(inst, '.claude', 'extra.md'), 'extra v1\n');
    const v1 = createHash('sha256').update('extra v1\n').digest('hex');
    mkdirSync(join(inst, 'state'), { recursive: true });
    writeFileSync(join(inst, 'state', 'origin-baseline.txt'), `${v1}  .claude/extra.md\n`, 'utf8');

    writeFileSync(join(inst, '.claude', 'extra.md'), 'extra v2\n');
    execFileSync('node', [PULL, '--root', inst, '--remote', origin], { encoding: 'utf8' });

    const line = readFileSync(join(inst, 'state', 'origin-baseline.txt'), 'utf8')
      .split(/\r?\n/).find((l) => l.endsWith('.claude/extra.md'));
    assert.ok(line, "Retain out-of-scope baseline entries to avoid falsely classifying them as diverged");
    assert.equal(line.slice(0, 64), v1, "Keep the pre-edit token so the path remains pending rather than diverged");
    assert.equal(readFileSync(join(inst, '.claude', 'extra.md'), 'utf8'), 'extra v2\n', "Pull must not touch out-of-scope files");
  } finally {
    rmSync(origin, { recursive: true, force: true });
    rmSync(inst, { recursive: true, force: true });
  }
});
