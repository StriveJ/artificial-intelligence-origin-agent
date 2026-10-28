// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { makeTestDir } from './lib/test-tmp.mjs';
import { PRODUCT, makeOrigin, makeChannelOrigin, git } from './lib/test-git.mjs';
import { SYNC_MAP } from '../../../../product/core-space/scripts/lib/origin-sync-map.mjs';

const STATUS = join(PRODUCT, 'core-space', 'scripts', 'aipa-contribute-status.mjs');







function makeInst(version, { pull = true } = {}) {
  const origin = makeOrigin(version);
  const artifact = makeTestDir('aipa-cs-art-');
  execFileSync('git', ['clone', '-q', origin, artifact], { encoding: 'utf8' });
  const inst = makeTestDir('aipa-cs-');
  execFileSync('node', [join(artifact, 'scripts', 'aipa-init.mjs'), '--root', inst, '--owner', 't'], { encoding: 'utf8' });
  if (pull) execFileSync('node', [join(artifact, 'core-space', 'scripts', 'aipa-pull-origin.mjs'), '--root', inst, '--remote', artifact], { encoding: 'utf8' });
  return {
    origin, artifact, inst,
    cleanup: () => { for (const d of [origin, artifact, inst]) rmSync(d, { recursive: true, force: true }); },
  };
}

test("A local framework edit with unchanged upstream is pending without upstream-drift noise", () => {
  const f = makeInst('9.01.0');
  const { inst } = f;
  try {


    const clean = JSON.parse(execFileSync('node', [STATUS, '--root', inst, '--json'], { encoding: 'utf8' }));
    assert.equal(clean.outOfZone.length, 0, "A clean instance must have no misplaced framework changes; this section must not inventory personal data");

    const target = join(inst, 'core-space', 'scripts', 'aipa-summarize.mjs');
    writeFileSync(target, readFileSync(target, 'utf8') + '\n// MY-FRAMEWORK-EDIT\n');

    const out = execFileSync('node', [STATUS, '--root', inst, '--json'], { encoding: 'utf8' });
    const r = JSON.parse(out);
    const entry = r.framework.find((e) => e.path === 'core-space/scripts/aipa-summarize.mjs');
    assert.equal(entry.state, 'pending');
    assert.equal(r.framework.some((e) => e.state === 'upstream-only'), false, "Unchanged upstream must have no drift entries: "+JSON.stringify(r.framework.filter(e=>e.state==='upstream-only')));
  } finally {
    f.cleanup();
  }
});






test("Beta contribution status compares upstream beta rather than misreporting master differences as drift", () => {
  const origin = makeChannelOrigin('9.10.0', '9.11.0-beta.1');
  const artifact = makeTestDir('aipa-cs-art-');
  const inst = makeTestDir('aipa-cs-');
  try {
    execFileSync('git', ['clone', '-q', origin, artifact], { encoding: 'utf8' });



    git(artifact, ['branch', 'beta', 'origin/beta']);
    execFileSync(
      'node',
      [join(artifact, 'scripts', 'aipa-init.mjs'), '--root', inst, '--owner', 't', '--channel', 'beta', '--telemetry', 'on'],
      { encoding: 'utf8' },
    );
    execFileSync('node', [join(artifact, 'core-space', 'scripts', 'aipa-pull-origin.mjs'), '--root', inst, '--remote', artifact], { encoding: 'utf8' });


    assert.match(readFileSync(join(inst, 'AIPA-MANIFEST.yaml'), 'utf8'), /channel:\s*beta/, "Fixture check: the instance is on beta");
    assert.ok(
      existsSync(join(inst, 'core-space', 'scripts', 'aipa-beta-only.mjs')),
      "Fixture check: the beta-only framework file was actually pulled",
    );

    const r = JSON.parse(execFileSync('node', [STATUS, '--root', inst, '--json'], { encoding: 'utf8' }));
    assert.equal(
      r.framework.some((e) => e.state === 'upstream-only'),
      false,
      "Instance and baseline are on beta, so upstream must use beta instead of reporting beta/master differences",
    );
  } finally {
    for (const d of [origin, artifact, inst]) rmSync(d, { recursive: true, force: true });
  }
});

test("Changes outside the framework are separate and user-space/scripts produces a warning", () => {
  const f = makeInst('9.02.0');
  const { inst } = f;
  try {
    mkdirSync(join(inst, 'user-space', 'scripts'), { recursive: true });
    writeFileSync(join(inst, 'user-space', 'scripts', 'my-tool.mjs'), 'export const x = 1;\n');

    const out = execFileSync('node', [STATUS, '--root', inst, '--json'], { encoding: 'utf8' });
    const r = JSON.parse(out);
    assert.equal(r.framework.some((e) => e.path.startsWith('user-space/')), false, "The framework section must not include user-space");
    const outOfZone = r.outOfZone.find((e) => e.path === 'user-space/scripts/my-tool.mjs');
    assert.ok(outOfZone, "The outside-framework section must list the file");
    assert.match(outOfZone.warn || '', /core-space/);



    assert.match(outOfZone.warn || '', /git mv[\s\S]*core-space\//, "The warning must explain the framework-code remedy");
    assert.match(outOfZone.warn || '', /move elsewhere under user-space\/|move.*elsewhere under user-space\//, "The warning must explain the personal-script remedy consistently with the gate");
  } finally {
    f.cleanup();
  }
});







//









test("A1: personal executables warn, but plugin slots and personal data do not", () => {
  const f = makeInst('9.06.0');
  const { inst } = f;
  try {

    mkdirSync(join(inst, 'user-space', 'tools'), { recursive: true });
    writeFileSync(join(inst, 'user-space', 'tools', 'foo.mjs'), 'export const x = 1;\n');
    writeFileSync(join(inst, 'user-space', 'foo.mjs'), 'export const y = 2;\n');
    writeFileSync(join(inst, 'user-space', 'tools', 'x.js'), 'module.exports = 3;\n');

    mkdirSync(join(inst, 'user-space', 'tasks'), { recursive: true });
    writeFileSync(join(inst, 'user-space', 'tasks', 'tick-a.mjs'), 'export const z = 4;\n');

    mkdirSync(join(inst, 'user-space', 'memory'), { recursive: true });
    writeFileSync(join(inst, 'user-space', 'memory', 'notes.md'), "# \u6211\u7684\u7b14\u8bb0\n");

    const r = JSON.parse(execFileSync('node', [STATUS, '--root', inst, '--json'], { encoding: 'utf8' }));
    const at = (p) => r.outOfZone.find((e) => e.path === p);



    for (const p of ['user-space/tools/foo.mjs', 'user-space/foo.mjs', 'user-space/tools/x.js']) {
      const e = at(p);
      assert.ok(e, `Executables must remain individually visible outside the framework; only enforcement is reduced: ${p}`);
      assert.match(e.warn || '', /git mv[\s\S]*core-space\//, `Must explain the misplaced-framework-code remedy: ${p}`);
      assert.match(e.warn || '', /need no action/, `Must also explain the personal-script remedy: ${p}`);
    }


    const plugin = at('user-space/tasks/tick-a.mjs');
    assert.ok(plugin, "Fixture check: added personal plugin files are listed outside the framework");
    assert.equal(plugin.warn || '', '', "user-space/tasks is an intentional plugin slot and must not warn");


    const note = at('user-space/memory/notes.md');
    assert.ok(note, "Fixture check: personal data is listed outside the framework");
    assert.equal(note.warn || '', '', "Non-executable personal data must not warn");
  } finally {
    f.cleanup();
  }
});

test("Missing baselines produce an explicit failure instead of silent degradation", () => {

  const f = makeInst('9.03.0', { pull: false });
  const { inst } = f;
  try {
    rmSync(join(inst, 'state', 'origin-baseline.txt'), { force: true });
    let failed = false, err = '';
    try {
      execFileSync('node', [STATUS, '--root', inst], { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) { failed = true; err = String(e.stderr || ''); }
    assert.equal(failed, true, "Reject a missing baseline explicitly");
    assert.match(err, /baseline|checksums/);
  } finally {
    f.cleanup();
  }
});





test("A missing upstream cache rejects execution without dumping instance data", () => {
  const f = makeInst('9.04.0', { pull: false });
  const { inst } = f;
  try {
    let failed = false, err = '';
    try {
      execFileSync('node', [STATUS, '--root', inst], { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) { failed = true; err = String(e.stderr || ''); }
    assert.equal(failed, true, "Reject a missing upstream cache explicitly");
    assert.match(err, /cache|pull-origin/);
  } finally {
    f.cleanup();
  }
});





test("A cache directory without a Git repository also rejects execution", () => {
  const f = makeInst('9.05.0', { pull: false });
  const { inst } = f;
  try {
    mkdirSync(join(inst, 'state', '.origin-cache'), { recursive: true });
    let failed = false, err = '';
    try {
      execFileSync('node', [STATUS, '--root', inst], { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) { failed = true; err = String(e.stderr || ''); }
    assert.equal(failed, true, "Reject a non-Git cache rather than rendering misleading partial status");
    assert.match(err, /cache|pull-origin/);
  } finally {
    f.cleanup();
  }
});





test("Every templates/personal file is covered by the path mapping", () => {
  const dir = join(PRODUCT, 'templates', 'personal');
  const files = readdirSync(dir).filter((n) => statSync(join(dir, n)).isFile()).sort();
  assert.ok(files.length > 0, "templates/personal must not be empty");
  const norm = (p) => p.replace(/\\/g, '/');
  const entries = SYNC_MAP.filter((m) => norm(m.src).startsWith('templates/personal/'));
  const mapped = new Set(entries.map((m) => norm(m.dst)));
  for (const n of files) {
    assert.ok(mapped.has(n), `templates/personal/${n} has no mapping entry; init copies it into the instance root as ${n} (a rewritten path). Reading upstream by the same path would inspect the artifact-specific file and invent divergence.`);
  }
  for (const d of mapped) {
    assert.ok(files.includes(d), `Mapped templates/personal/${d} does not exist in the artifact (phantom entry)`);
  }






  const REWRITE_NO_REFRESH = new Set(['CHANGELOG.md']);
  for (const m of entries) {
    const d = norm(m.dst);
    if (REWRITE_NO_REFRESH.has(d)) continue;
    assert.equal(m.refresh, true, `${d} comes from templates/personal/ but lacks refresh:true; pull would never deliver it and the instance would retain the initialization copy`);
  }


  assert.equal(SYNC_MAP.find((m) => norm(m.dst) === 'CHANGELOG.md').refresh, false, "Pull must not refresh CHANGELOG.md");
});








test("Initialization seeds every file under templates/personal", () => {
  const PROBE = 'PROBE-TEMPLATE.md';
  const src = makeTestDir('aipa-seed-src-');
  const inst = makeTestDir('aipa-seed-');
  try {
    cpSync(PRODUCT, src, { recursive: true });
    writeFileSync(join(src, 'templates', 'personal', PROBE), "# \u63a2\u9488：\u53ea\u6709 init \u6309\u76ee\u5f55\u6d3e\u751f\u65f6\u624d\u4f1a\u51fa\u73b0\u5728\u5b9e\u4f8b\u6839\n");
    execFileSync('node', [join(src, 'scripts', 'aipa-init.mjs'), '--root', inst, '--owner', 't'], { encoding: 'utf8' });
    const dir = join(src, 'templates', 'personal');
    const files = readdirSync(dir).filter((n) => statSync(join(dir, n)).isFile()).sort();
    assert.ok(files.includes(PROBE), "Fixture check: the probe is present in the product templates");
    for (const n of files) {
      assert.ok(existsSync(join(inst, n)), `init did not seed templates/personal/${n}; this invalidates the premise that every seeded file requires a mapping entry`);
    }
  } finally {
    for (const d of [src, inst]) rmSync(d, { recursive: true, force: true });
  }
});
