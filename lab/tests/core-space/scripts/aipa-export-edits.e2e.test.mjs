// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, cpSync } from 'node:fs';
import { join, basename } from 'node:path';
import { makeTestDir } from './lib/test-tmp.mjs';
import { PRODUCT, git, commitAll, commitOne, makeOrigin } from './lib/test-git.mjs';

const EXPORT = join(PRODUCT, 'core-space', 'scripts', 'aipa-export-edits.mjs');

const STATUS = join(PRODUCT, 'core-space', 'scripts', 'aipa-contribute-status.mjs');

const REPO_ROOT = join(PRODUCT, '..');
const FRAMEWORK_FILE = 'core-space/scripts/aipa-summarize.mjs';


function cloneBuildProduct(clone){
  const upload='git -c uploadpack.allowFilter=true upload-pack';
  execFileSync('git',['clone','-q','--no-local','--no-checkout','--depth=1','--single-branch','--no-tags','--filter=blob:none','--upload-pack='+upload,REPO_ROOT,clone],{stdio:'pipe'});
  git(clone,['config','remote.origin.uploadpack',upload]);
  git(clone,['sparse-checkout','set','--no-cone','/product/','/.gitattributes','/.gitignore']);
  git(clone,['checkout','-q','HEAD']);
}

const FILLED = [
  "## Feature Overview", '', "\u672c\u6539\u52a8\u65b0\u589e\u4e86\u67d0\u80fd\u529b。", '',
  "## Testing and Validation", '', '```bash', 'node core-space/scripts/aipa-summarize.mjs day --root .', '```', '',
].join('\n');













function makeInst(instVer, { syncVer = '', beforePull = () => {} } = {}) {
  const origin = makeOrigin(instVer);
  const artifact = makeTestDir('aipa-ex-art-');
  execFileSync('git', ['clone', '-q', origin, artifact], { encoding: 'utf8' });
  const inst = makeTestDir('aipa-ex-');
  execFileSync('node', [join(artifact, 'scripts', 'aipa-init.mjs'), '--root', inst, '--owner', 't'], { encoding: 'utf8' });
  beforePull(artifact, inst);
  if (syncVer) {
    writeFileSync(join(artifact, 'ORIGIN-MANIFEST.yaml'),
      `origin:\n  version: ${syncVer}\n  assist_prefix: "AIPA ${syncVer.split('.')[1]} \u667a\u80fd\u4f53\u4e3a\u4f60\u534f\u4f5c："\n`);
    commitAll(artifact, 'bump ' + syncVer);
  }
  execFileSync('node', [join(artifact, 'core-space', 'scripts', 'aipa-pull-origin.mjs'), '--root', inst, '--remote', artifact], { encoding: 'utf8' });
  return {
    inst,
    cleanup: () => { for (const d of [origin, artifact, inst]) rmSync(d, { recursive: true, force: true }); },
  };
}


function runExport(inst, out, slug = 'probe') {
  try {
    execFileSync('node', [EXPORT, '--root', inst, '--out', out, '--slug', slug], { encoding: 'utf8', stdio: 'pipe' });
    return { failed: false, err: '' };
  } catch (e) { return { failed: true, err: String(e.stderr || '') }; }
}

const patchesIn = (out) => readdirSync(out).filter((n) => n.endsWith('.patch'))
  .map((n) => readFileSync(join(out, n), 'utf8')).join('\n');

test("Patch export rejects pre-staged content without creating materials or including private files", () => {
  const { inst, cleanup } = makeInst('0.04.0', { syncVer: '0.05.0' });
  const out = makeTestDir('aipa-staged-export-');
  try {
    const path = join(inst, 'user-space', 'private-note.md'); writeFileSync(path, "\u79c1\u6709\u6d4b\u8bd5\u5185\u5bb9");
    git(inst, ['add', 'user-space/private-note.md']);
    const staged = git(inst, ['diff', '--cached']), head = git(inst, ['rev-parse', 'HEAD']);
    const result = runExport(inst, out);
    assert.equal(result.failed, true); assert.match(result.err, /staged|Staging/);
    assert.equal(git(inst, ['diff', '--cached']), staged); assert.equal(git(inst, ['rev-parse', 'HEAD']), head);
    assert.equal(existsSync(join(inst, 'CONTRIBUTION.md')), false);
  } finally { cleanup(); rmSync(out, { recursive: true, force: true }); }
});

const pathsInPatches = (out) => new Set([...patchesIn(out).matchAll(/^diff --git a\/(.+?) b\//gm)].map((m) => m[1]));

test("--prepare only creates materials marked pending completion/export, without commits or patches", () => {
  const f=makeInst('0.10.0',{syncVer:'0.11.0'}),{inst}=f;
  writeFileSync(join(inst,FRAMEWORK_FILE),readFileSync(join(inst,FRAMEWORK_FILE),'utf8')+'\n// preparation probe\n');
  const head=git(inst,['rev-parse','HEAD']);
  const prepare=()=>JSON.parse(execFileSync(process.execPath,[EXPORT,'--root',inst,'--prepare'],{encoding:'utf8',stdio:['pipe','pipe','pipe']}));
  assert.equal(prepare().status,'needs_description');assert.equal(git(inst,['rev-parse','HEAD']),head);assert.equal(git(inst,['diff','--cached']), '');
  writeFileSync(join(inst,'CONTRIBUTION.md'),FILLED);const ready=prepare();assert.equal(ready.status,'ready_to_export');assert.equal(ready.remoteState,'unknown');
  assert.equal(git(inst,['rev-parse','HEAD']),head);
});

test("Credentials in current files or patch history block public materials, preserving HEAD and creating no patch", () => {
  for(const historical of [false,true]) {
    const f=makeInst('0.10.0',{syncVer:'0.11.0'}),{inst}=f,out=makeTestDir('aipa-secret-patch-');
    const original=readFileSync(join(inst,FRAMEWORK_FILE),'utf8'),secret='fake-credential-for-test-12345';
    if(historical){commitOne(inst,FRAMEWORK_FILE,original+`\nconst API_KEY = "${secret}";\n`,'temporary secret');commitOne(inst,FRAMEWORK_FILE,original+'\n// public change\n','remove secret');}
    else writeFileSync(join(inst,FRAMEWORK_FILE),original+`\nconst API_KEY = "${secret}";\n`);
    writeFileSync(join(inst,'CONTRIBUTION.md'),FILLED);const head=git(inst,['rev-parse','HEAD']);
    assert.throws(()=>execFileSync(process.execPath,[EXPORT,'--root',inst,'--out',out],{stdio:'pipe'}),e=>e.status===1 && /public content/.test(String(e.stderr)) && !String(e.stderr).includes(secret));
    assert.equal(git(inst,['rev-parse','HEAD']),head);assert.equal(readdirSync(out).length,0);
  }
});

test("Gate 3: missing documents, empty required sections, absent code blocks, or level-three headings reject export", () => {
  const f = makeInst('9.11.0');
  const out = makeTestDir('aipa-ex-out-');
  try {
    const { inst } = f;
    const target = join(inst, FRAMEWORK_FILE);
    commitOne(inst, FRAMEWORK_FILE, readFileSync(target, 'utf8') + '\n// EDIT\n', 'edit(framework): probe');




    let r = runExport(inst, out);
    assert.equal(r.failed, true, "Reject export when both required sections are empty");
    assert.match(r.err, /Feature Overview|Testing and Validation/);
    const skeleton = readFileSync(join(inst, 'CONTRIBUTION.md'), 'utf8');
    assert.match(skeleton, /^## Feature Overview$/m, "The skeleton must contain a level-two Feature Overview heading");
    assert.match(skeleton, /^## Testing and Validation$/m, "The skeleton must contain a level-two Testing and Validation heading");
    assert.match(skeleton, /Exported at: /, "Prefill the export timestamp");
    assert.match(skeleton, /Instance framework version: /, "Prefill the instance version");
    assert.match(skeleton, /Boundary compliance/, "Prefill boundary-compliance results");
    assert.match(skeleton, /\| Instance path \| Origin destination \|/, "Prefill the change list with Origin destinations");
    assert.match(skeleton, new RegExp(`\\| \`${FRAMEWORK_FILE}\` \\| \`product/`), "List each path's Origin destination");
    assert.deepEqual(readdirSync(out), [], "Rejected execution must not create artifacts");


    writeFileSync(join(inst, 'CONTRIBUTION.md'), "## \u529f\u80fd\u4ecb\u7ecd\n\n\u65b0\u589e\u4e86\u67d0\u80fd\u529b。\n\n## \u6d4b\u8bd5\u4e0e\u9a8c\u8bc1\n\n");
    r = runExport(inst, out);
    assert.equal(r.failed, true, "Reject export when required sections are empty");
    assert.match(r.err, /Testing and Validation/);


    writeFileSync(join(inst, 'CONTRIBUTION.md'), "## \u529f\u80fd\u4ecb\u7ecd\n\n\u65b0\u589e\u4e86\u67d0\u80fd\u529b。\n\n## \u6d4b\u8bd5\u4e0e\u9a8c\u8bc1\n\n\u5df2\u6d4b\u8bd5。\n");
    r = runExport(inst, out);
    assert.equal(r.failed, true, "Testing and Validation must include commands and output");
    assert.match(r.err, /code block/);


    writeFileSync(join(inst, 'CONTRIBUTION.md'), "## \u529f\u80fd\u4ecb\u7ecd\n\n\u65b0\u589e\u4e86\u67d0\u80fd\u529b。\n\n### \u6d4b\u8bd5\u4e0e\u9a8c\u8bc1\n\n```bash\nnode x.mjs\n```\n");
    r = runExport(inst, out);
    assert.equal(r.failed, true, "Level-three headings do not satisfy required sections");
    assert.match(r.err, /Testing and Validation/);
  } finally { f.cleanup(); rmSync(out, { recursive: true, force: true }); }
});





//





//






test("A2: the contribution skeleton lists excluded items but only counts personal entries", () => {
  const f = makeInst('9.60.0', { syncVer: '9.61.0' });
  const out = makeTestDir('aipa-ex-out-');
  try {
    const { inst } = f;

    commitOne(inst, FRAMEWORK_FILE, readFileSync(join(inst, FRAMEWORK_FILE), 'utf8') + '\n// A2\n', 'edit framework');

    commitOne(inst, 'CHANGELOG.md', readFileSync(join(inst, 'CHANGELOG.md'), 'utf8') + "\n- \u6211\u7684\u672c\u5730\u8bb0\u5f55\n", "doc: \u6539\u5b9e\u4f8b\u6839 CHANGELOG");

    mkdirSync(join(inst, 'user-space', 'memory'), { recursive: true });
    writeFileSync(join(inst, 'user-space', 'memory', 'x.md'), "# \u6211\u7684\u79c1\u4eba\u8bb0\u5fc6\n");
    mkdirSync(join(inst, 'user-space', 'tools'), { recursive: true });
    writeFileSync(join(inst, 'user-space', 'tools', 'foo.mjs'), 'export const x = 1;\n');


    let r = runExport(inst, out);
    assert.equal(r.failed, true, "New skeletons still reject export until both required sections are filled");
    assert.deepEqual(readdirSync(out), [], "Rejected execution must not create artifacts");
    const skeleton = readFileSync(join(inst, 'CONTRIBUTION.md'), 'utf8');


    assert.equal(skeleton.includes("### Not Exported"), true, "The skeleton must include an Excluded from This Export section");
    const block = skeleton.slice(skeleton.indexOf("### Not Exported"), skeleton.indexOf("## Feature Overview"));
    assert.match(block, /`CHANGELOG\.md`/, "List non-user-space excluded paths because they never enter the export set");


    assert.doesNotMatch(skeleton, /user-space\/memory\/x\.md/, "Personal paths must not appear in materials that will be public in a PR");
    assert.doesNotMatch(skeleton, /user-space\/tools\/foo\.mjs/, "Personal executable paths must also remain private");
    assert.equal(skeleton.includes(`user-space/projects/${basename(inst)}/project.yaml`), false, "The scaffolded instance project path must also remain private");



    const leaked = [...block.matchAll(/`(user-space\/[^`]*)`/g)].map((m) => m[1])
      .filter((s) => s !== 'user-space/' && !s.includes('*'));
    assert.deepEqual(leaked, [], "Excluded items must not expose concrete personal paths; only user-space prefixes/wildcards are allowed");


    const st = JSON.parse(execFileSync('node', [STATUS, '--root', inst, '--json'], { encoding: 'utf8' }));
    const personalPaths = st.outOfZone.filter((e) => e.path.startsWith('user-space/')).map((e) => e.path);
    assert.deepEqual(personalPaths.sort(), ['user-space/memory/x.md', `user-space/projects/${basename(inst)}/project.yaml`, 'user-space/tools/foo.mjs'].sort(), "Both added personal files and the scaffolded project rule remain outside the framework");
    const personalCount = personalPaths.length;
    assert.match(block, new RegExp("Excluded `user-space/\\*\\*` entries: " + personalCount + " "),
      "Report only the personal-entry count matching actual status");


    writeFileSync(join(inst, 'CONTRIBUTION.md'), skeleton.slice(0, skeleton.indexOf("## Feature Overview")) + FILLED);
    execFileSync('node', [EXPORT, '--root', inst, '--out', out, '--slug', 'probe'], { encoding: 'utf8' });
    const shipped = readFileSync(join(out, 'CONTRIBUTION.md'), 'utf8');
    assert.equal(shipped.includes("### Not Exported"), true, "PR contribution materials must retain this section");

    assert.equal(/user-space\//.test(patchesIn(out)), false, "Patches must not contain user-space paths");
    assert.deepEqual([...pathsInPatches(out)], ['product/' + FRAMEWORK_FILE], "The export set still contains framework paths only");
  } finally { f.cleanup(); rmSync(out, { recursive: true, force: true }); }
});








test("A1 warns without blocking personal executables; only user-space/scripts remains an export gate", () => {
  const f = makeInst('9.62.0', { syncVer: '9.63.0' });
  const out = makeTestDir('aipa-ex-out-');
  try {
    const { inst } = f;
    commitOne(inst, FRAMEWORK_FILE, readFileSync(join(inst, FRAMEWORK_FILE), 'utf8') + '\n// A1-NO-GATE\n', 'edit framework');
    mkdirSync(join(inst, 'user-space', 'tools'), { recursive: true });
    writeFileSync(join(inst, 'user-space', 'tools', 'foo.mjs'), 'export const x = 1;\n');
    writeFileSync(join(inst, 'CONTRIBUTION.md'), FILLED);


    const st = JSON.parse(execFileSync('node', [STATUS, '--root', inst, '--json'], { encoding: 'utf8' }));
    const warned = st.outOfZone.find((e) => e.path === 'user-space/tools/foo.mjs');
    assert.ok(warned && warned.warn, "Fixture check: personal executables produce the A1 warning");


    execFileSync('node', [EXPORT, '--root', inst, '--out', out, '--slug', 'probe'], { encoding: 'utf8' });
    assert.equal(/user-space\//.test(patchesIn(out)), false, "Patches must not contain user-space paths");
    assert.deepEqual([...pathsInPatches(out)], ['product/' + FRAMEWORK_FILE], "The export set still contains framework paths only");
  } finally { f.cleanup(); rmSync(out, { recursive: true, force: true }); }
});

test("Gate 2: out-of-framework changes reject export and identify boundary-violating paths", () => {
  const f = makeInst('9.12.0');
  const out = makeTestDir('aipa-ex-out-');
  try {
    const { inst } = f;
    mkdirSync(join(inst, 'user-space', 'scripts'), { recursive: true });
    writeFileSync(join(inst, 'user-space', 'scripts', 'stray.mjs'), 'export const x = 1;\n');
    const r = runExport(inst, out);
    assert.equal(r.failed, true, "Boundary-violating paths must reject export");
    assert.match(r.err, /user-space\/scripts\/stray\.mjs/);





    assert.match(r.err, /git mv[\s\S]*core-space\//, "Framework code remediation is git mv to the corresponding core-space location");
    assert.match(r.err, /move.*elsewhere under user-space\//, "Personal script remediation is another suitable user-space location");
  } finally { f.cleanup(); rmSync(out, { recursive: true, force: true }); }
});






test("Gate 1: divergent edits by both sides reject export without ledger commits", () => {
  const f = makeInst('9.16.0', {
    syncVer: '9.17.0',
    beforePull: (artifact, inst) => {
      writeFileSync(join(artifact, '.claude', 'commands', 'extra.md'), 'UPSTREAM\n');
      writeFileSync(join(inst, '.claude', 'commands', 'extra.md'), 'LOCAL\n');
      writeFileSync(join(inst, '.claude', 'commands', 'probe.md'), 'PROBE\n');
    },
  });
  const out = makeTestDir('aipa-ex-out-');
  try {
    const { inst } = f;
    writeFileSync(join(inst, 'CONTRIBUTION.md'), FILLED);
    const head = git(inst, ['rev-parse', 'HEAD']).trim();
    const r = runExport(inst, out);
    assert.equal(r.failed, true, "Reject export when both sides changed the file differently");
    assert.match(r.err, /\.claude\/commands\/extra\.md/);
    assert.equal(git(inst, ['rev-parse', 'HEAD']).trim(), head, "Rejected execution must not leave a ledger commit");
    assert.deepEqual(readdirSync(out), [], "Rejected execution must not create artifacts");
  } finally { f.cleanup(); rmSync(out, { recursive: true, force: true }); }
});

test("Clean export produces patches and CONTRIBUTION.md without user-space content", () => {
  const f = makeInst('9.13.0', { syncVer: '9.14.0' });
  const out = makeTestDir('aipa-ex-out-');
  try {
    const { inst } = f;
    const target = join(inst, FRAMEWORK_FILE);
    commitOne(inst, FRAMEWORK_FILE, readFileSync(target, 'utf8') + '\n// EDIT\n', 'edit(framework): probe');
    writeFileSync(join(inst, 'CONTRIBUTION.md'), FILLED);

    execFileSync('node', [EXPORT, '--root', inst, '--out', out, '--slug', 'probe'], { encoding: 'utf8' });

    const files = readdirSync(out);
    assert.equal(files.some((n) => n.endsWith('.patch')), true, "Produce a patch");
    assert.equal(files.includes('CONTRIBUTION.md'), true, "Produce CONTRIBUTION.md");
    assert.equal(/user-space\//.test(patchesIn(out)), false, "Patches must not contain user-space paths");


    assert.deepEqual([...pathsInPatches(out)], ['product/' + FRAMEWORK_FILE], "Patch series must cover exactly the pending Origin destinations");
    for (const p of pathsInPatches(out)) assert.ok(p.startsWith('product/'), "Patch paths must be under product/: " + p);
    assert.equal(git(inst, ['tag']).includes('exported-'), true, "Create the export marker tag");
  } finally { f.cleanup(); rmSync(out, { recursive: true, force: true }); }
});

test("Uncommitted framework changes are recorded before format-patch", () => {

  const f = makeInst('9.15.0');
  const out = makeTestDir('aipa-ex-out-');
  try {
    const { inst } = f;
    const target = join(inst, FRAMEWORK_FILE);
    writeFileSync(target, readFileSync(target, 'utf8') + '\n// UNCOMMITTED-EDIT\n');
    writeFileSync(join(inst, 'CONTRIBUTION.md'), FILLED);

    execFileSync('node', [EXPORT, '--root', inst, '--out', out, '--slug', 'probe'], { encoding: 'utf8' });

    assert.match(git(inst, ['log', '--format=%B', '-1']), /AIPA-Framework-Edit: probe/, "Create a ledger commit with the trailer");
    assert.equal(git(inst, ['status', '--porcelain']).trim(), '', "The workspace must be clean after export");
    assert.match(patchesIn(out), /UNCOMMITTED-EDIT/, "Uncommitted edits must be included in the patch");
  } finally { f.cleanup(); rmSync(out, { recursive: true, force: true }); }
});





test("Every pending export path appears in the patch series, including mixed historical ranges", () => {
  const f = makeInst('9.20.0', {
    syncVer: '9.21.0',
    beforePull: (artifact, inst) => commitOne(inst, '.claude/commands/early.md', 'EARLY\n', 'add early command'),
  });
  const out = makeTestDir('aipa-ex-out-');
  try {
    const { inst } = f;
    const target = join(inst, FRAMEWORK_FILE);
    writeFileSync(target, readFileSync(target, 'utf8') + '\n// LATE-EDIT\n');
    writeFileSync(join(inst, 'CONTRIBUTION.md'), FILLED);

    execFileSync('node', [EXPORT, '--root', inst, '--out', out, '--slug', 'probe'], { encoding: 'utf8' });


    const covered = pathsInPatches(out);
    assert.equal(covered.has('product/.claude/commands/early.md'), true, "Pending paths before the synchronization anchor must appear in the series");
    assert.equal(covered.has('product/' + FRAMEWORK_FILE), true, "Changes after the anchor must also appear in the series");
    assert.match(patchesIn(out), /EARLY/, "The patch must contain actual pre-anchor change content");
    assert.match(patchesIn(out), /LATE-EDIT/, "The patch must contain actual post-anchor change content");


    assert.equal(readdirSync(out).filter((n) => n.endsWith('.patch')).length, 2, "Do not include unrelated history");
  } finally { f.cleanup(); rmSync(out, { recursive: true, force: true }); }
});









test("C1: git am in an Origin clone applies patches under the correct product paths", () => {
  const f = makeInst('9.30.0', { syncVer: '9.31.0' });
  const out = makeTestDir('aipa-ex-out-');
  const clone = makeTestDir('aipa-ex-clone-');
  try {
    const { inst } = f;
    commitOne(inst, FRAMEWORK_FILE, readFileSync(join(inst, FRAMEWORK_FILE), 'utf8') + '\n// C1-EDIT\n', 'edit framework');
    commitOne(inst, 'AGENTS.md', readFileSync(join(inst, 'AGENTS.md'), 'utf8') + '\n<!-- C1-AGENTS -->\n', 'edit entry');
    commitOne(inst, '.claude/commands/probe.md', 'PROBE\n', 'add probe command');
    writeFileSync(join(inst, 'CONTRIBUTION.md'), FILLED);

    execFileSync('node', [EXPORT, '--root', inst, '--out', out, '--slug', 'probe'], { encoding: 'utf8' });
    const patches = readdirSync(out).filter((n) => n.endsWith('.patch')).sort().map((n) => join(out, n));
    assert.ok(patches.length > 0, "Produce a patch");



    cloneBuildProduct(clone);

    cpSync(PRODUCT,join(clone,'product'),{recursive:true});
    execFileSync('git',['-C',clone,'add','--','product'],{stdio:'pipe'});
    execFileSync('git',['-C',clone,'-c','user.name=t','-c','user.email=t@t','commit','--allow-empty','-m','matching product fixture'],{stdio:'pipe'});

    const receivingBase=git(clone,['show','HEAD:product/'+FRAMEWORK_FILE]);
    const keepCR=receivingBase.includes('\r\n');git(clone,['config','am.keepcr',String(keepCR)]);
    const am = execFileSync('git', ['-C', clone, '-c', 'user.name=t', '-c', 'user.email=t@t', 'am', ...(keepCR?['--keep-cr']:['--no-keep-cr']), ...patches], { encoding: 'utf8' });
    assert.equal((am.match(/Applying:/g) || []).length, patches.length, "Apply every patch through git am");


    assert.match(readFileSync(join(clone, 'product', FRAMEWORK_FILE), 'utf8'), /C1-EDIT/, "Modified files keep their corresponding product locations");

    assert.match(readFileSync(join(clone, 'product', 'templates', 'personal', 'AGENTS.md'), 'utf8'), /C1-AGENTS/,
      "Reverse-map instance entry changes to product/templates/personal/AGENTS.md");

    assert.equal(existsSync(join(clone, 'product', '.claude', 'commands', 'probe.md')), true, "New files belong under product");
    assert.equal(existsSync(join(clone, '.claude', 'commands', 'probe.md')), false, "New files must not appear outside product");

    assert.doesNotMatch(readFileSync(join(clone, 'product', 'AGENTS.md'), 'utf8'), /C1-AGENTS/, "Do not modify the distinct product/AGENTS.md file");
    assert.equal(existsSync(join(clone, 'AGENTS.md')), false, "Do not create a root AGENTS.md in Origin");
  } finally { f.cleanup(); rmSync(out, { recursive: true, force: true }); rmSync(clone, { recursive: true, force: true }); }
});








test("I3: hunk content resembling patch headers is preserved byte for byte and remains applicable", () => {
  const HOST = 'core-space/host-protocol.md';
  const f = makeInst('9.50.0', { syncVer: '9.51.0' });
  const out = makeTestDir('aipa-ex-out-');
  const clone = makeTestDir('aipa-ex-clone-');
  try {
    const { inst } = f;
    const base = readFileSync(join(inst, HOST), 'utf8');


    commitOne(inst, HOST, base + '\n-- a/foo.md\n', "doc: \u5f15\u7528\u4e00\u6bb5 diff（\u65e7）");

    commitOne(inst, HOST, base + '\n++ b/foo.md\n', "doc: \u5f15\u7528\u4e00\u6bb5 diff（\u65b0）");
    execFileSync('node',[EXPORT,'--root',inst,'--prepare'],{encoding:'utf8'});
    assert.match(readFileSync(join(inst,'CONTRIBUTION.md'),'utf8'),/git am --keep-cr/,"Generated contribution guidance must explain applying patches while preserving CRLF bodies");
    writeFileSync(join(inst, 'CONTRIBUTION.md'), FILLED);

    execFileSync('node', [EXPORT, '--root', inst, '--out', out, '--slug', 'probe'], { encoding: 'utf8' });
    const patch = patchesIn(out);


    assert.match(patch, /^--- a\/foo\.md$/m, "Preserve deleted content lines instead of rewriting them as patch headers");
    assert.match(patch, /^\+\+\+ b\/foo\.md$/m, "Preserve added content lines instead of rewriting them as patch headers");
    assert.doesNotMatch(patch, /^--- a\/product\/foo\.md$/m, "Path mapping must not change hunk bodies");
    assert.doesNotMatch(patch, /^\+\+\+ b\/product\/foo\.md$/m, "Path mapping must not change hunk bodies");

    assert.match(patch, /^diff --git a\/product\/core-space\/host-protocol\.md b\/product\/core-space\/host-protocol\.md$/m,
      "File-section header paths must still map to Origin destinations");
    assert.match(patch, /^--- a\/product\/core-space\/host-protocol\.md$/m, "The header's --- line must also be mapped");


    const patches = readdirSync(out).filter((n) => n.endsWith('.patch')).sort().map((n) => join(out, n));
    assert.ok(patches.length > 0, "Produce a patch");
    cloneBuildProduct(clone);

    const receivingBase=readFileSync(join(clone,'product',HOST),'utf8');
    const am = execFileSync('git', ['-C', clone, '-c', 'user.name=t', '-c', 'user.email=t@t', 'am', ...(receivingBase.includes('\r\n')?['--keep-cr']:[]), ...patches], { encoding: 'utf8' });
    assert.equal((am.match(/Applying:/g) || []).length, patches.length, "Apply every patch through git am");
    const applied = readFileSync(join(clone, 'product', 'core-space', 'host-protocol.md'), 'utf8');
    assert.equal(applied,receivingBase+'\n++ b/foo.md\n',"Preserve receiver content and line endings except for the actual contribution");
    assert.match(applied, /\+\+ b\/foo\.md/, "After git am, the body must contain the contributor's new line");
    assert.doesNotMatch(applied, /-- a\/foo\.md/, "The deleted line must no longer remain");
  } finally { f.cleanup(); rmSync(out, { recursive: true, force: true }); rmSync(clone, { recursive: true, force: true }); }
});






//







test("W2-4: diff quotations in commit messages remain byte-for-byte unchanged", () => {
  const f = makeInst('9.52.0', { syncVer: '9.53.0' });
  const out = makeTestDir('aipa-ex-out-');
  try {
    const { inst } = f;

    const MSG = [
      'edit framework',
      '',
      "Change comparison:",
      '',
      'diff --git a/foo.md b/foo.md',
      '--- a/foo.md',
      '+++ b/foo.md',
      '@@ -1 +1 @@',
      "-\u65e7\u5185\u5bb9",
      "+\u65b0\u5185\u5bb9",
    ].join('\n');
    commitOne(inst, FRAMEWORK_FILE, readFileSync(join(inst, FRAMEWORK_FILE), 'utf8') + '\n// W2-4\n', MSG);
    writeFileSync(join(inst, 'CONTRIBUTION.md'), FILLED);

    execFileSync('node', [EXPORT, '--root', inst, '--out', out, '--slug', 'probe'], { encoding: 'utf8' });
    const patch = patchesIn(out);



    const msgRegion = patch.split(/\n---\r?\n/)[0];
    assert.match(msgRegion, /^diff --git a\/foo\.md b\/foo\.md$/m, "Preserve quoted diff --git lines in commit messages");
    assert.match(msgRegion, /^--- a\/foo\.md$/m, "Preserve quoted --- a/ lines instead of treating them as patch headers");
    assert.match(msgRegion, /^\+\+\+ b\/foo\.md$/m, "Preserve quoted +++ b/ lines");
    assert.match(msgRegion, /^@@ -1 \+1 @@$/m, "Preserve quoted hunk headers");
    assert.match(msgRegion, /^-\u65e7\u5185\u5bb9$[\s\S]*^\+\u65b0\u5185\u5bb9$/m, "Do not change quoted diff bodies in commit messages");
    assert.doesNotMatch(msgRegion, /product\/foo\.md/, "Path mapping must preserve every commit-message byte to avoid falsifying history");


    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(patch, new RegExp('^diff --git a/product/' + esc(FRAMEWORK_FILE) + ' b/product/' + esc(FRAMEWORK_FILE) + '$', 'm'),
      "File-section header paths must still map to Origin destinations");
    assert.match(patch, new RegExp('^--- a/product/' + esc(FRAMEWORK_FILE) + '$', 'm'), "The header's --- line must also be mapped");
  } finally { f.cleanup(); rmSync(out, { recursive: true, force: true }); }
});










test("C1: initialize v1, publish v2, pull, and export while ordinary personal differences remain visible but nonblocking", () => {
  const f = makeInst('9.40.0', {
    syncVer: '9.41.0',
    beforePull: (artifact, inst) => {


      writeFileSync(join(artifact, 'user-space', 'privacy.yaml'), "# v2 \u4e0a\u6e38\u6539\u8fc7\u7684\u9690\u79c1\u8fb9\u754c\nupload_policy:\n  mode: ask\n");

      mkdirSync(join(inst, 'user-space', 'memory'), { recursive: true });
      writeFileSync(join(inst, 'user-space', 'memory', 'x.md'), "# \u6211\u7684\u79c1\u4eba\u8bb0\u5fc6\n");
    },
  });
  const out = makeTestDir('aipa-ex-out-');
  try {
    const { inst } = f;

    commitOne(inst, FRAMEWORK_FILE, readFileSync(join(inst, FRAMEWORK_FILE), 'utf8') + '\n// V1-TO-V2\n', 'edit framework');
    writeFileSync(join(inst, 'CONTRIBUTION.md'), FILLED);



    const st = JSON.parse(execFileSync('node', [STATUS, '--root', inst, '--json'], { encoding: 'utf8' }));
    const zone = new Set(st.outOfZone.map((e) => e.path));
    assert.ok(zone.has('user-space/memory/x.md'), "Fixture check: newly added personal files are pending outside the framework");
    assert.ok(zone.has('user-space/privacy.yaml'), "Fixture check: upstream-only personal-template changes are diverged outside the framework");


    execFileSync('node', [EXPORT, '--root', inst, '--out', out, '--slug', 'probe'], { encoding: 'utf8' });

    assert.equal(/user-space\//.test(patchesIn(out)), false, "No user-space paths may appear in patches");
    assert.deepEqual([...pathsInPatches(out)], ['product/' + FRAMEWORK_FILE], "Framework edits must still export normally");

    assert.equal(st.outOfZone.every((e) => !e.warn), true, "Personal data is not misplaced framework code and must not warn");
  } finally { f.cleanup(); rmSync(out, { recursive: true, force: true }); }
});





//



test("C1 control: user-space/scripts executables still block export after upgrading", () => {
  const f = makeInst('9.42.0', {
    syncVer: '9.43.0',
    beforePull: (artifact) => {
      writeFileSync(join(artifact, 'user-space', 'privacy.yaml'), "# v2 \u4e0a\u6e38\u6539\u8fc7\u7684\u9690\u79c1\u8fb9\u754c\nupload_policy:\n  mode: ask\n");
    },
  });
  const out = makeTestDir('aipa-ex-out-');
  try {
    const { inst } = f;
    commitOne(inst, FRAMEWORK_FILE, readFileSync(join(inst, FRAMEWORK_FILE), 'utf8') + '\n// V1-TO-V2\n', 'edit framework');
    writeFileSync(join(inst, 'CONTRIBUTION.md'), FILLED);


    mkdirSync(join(inst, 'user-space', 'scripts'), { recursive: true });
    writeFileSync(join(inst, 'user-space', 'scripts', 'foo.mjs'), 'export const x = 1;\n');
    const r = runExport(inst, out);
    assert.equal(r.failed, true, "Misplaced framework artifacts under user-space/scripts must still block export");
    assert.match(r.err, /user-space\/scripts\/foo\.mjs/, "The rejection must identify the path");
    assert.match(r.err, /classified for export/, "Here, moving framework code into core-space is the correct remedy");
    assert.deepEqual(readdirSync(out), [], "Rejected execution must not create artifacts");
  } finally { f.cleanup(); rmSync(out, { recursive: true, force: true }); }
});












test("W2-3: personal skills warn but do not block export; scripts remain blocked", () => {
  const SKILL = 'user-space/skills/work/uav-lib-update/SKILL.md';
  const f = makeInst('9.44.0', {
    syncVer: '9.45.0',
    beforePull: (artifact) => {
      writeFileSync(join(artifact, 'user-space', 'privacy.yaml'), "# v2 \u4e0a\u6e38\u6539\u8fc7\u7684\u9690\u79c1\u8fb9\u754c\nupload_policy:\n  mode: ask\n");
    },
  });
  const out = makeTestDir('aipa-ex-out-');
  try {
    const { inst } = f;

    commitOne(inst, FRAMEWORK_FILE, readFileSync(join(inst, FRAMEWORK_FILE), 'utf8') + '\n// V1-TO-V2\n', 'edit framework');

    mkdirSync(join(inst, 'user-space', 'skills', 'work', 'uav-lib-update'), { recursive: true });
    writeFileSync(join(inst, SKILL), "# \u65e0\u4eba\u673a\u5e93\u5347\u7ea7\n\n\u63cf\u8ff0：\u628a UAV \u5e93\u4ece 1.x \u5347\u5230 2.x \u7684\u6b65\u9aa4。\n");
    writeFileSync(join(inst, 'CONTRIBUTION.md'), FILLED);



    const st = JSON.parse(execFileSync('node', [STATUS, '--root', inst, '--json'], { encoding: 'utf8' }));
    const entry = st.outOfZone.find((e) => e.path === SKILL);
    assert.ok(entry, "Fixture check: a new personal skill is pending outside the framework");

    assert.match(entry.warn || '', /core-space/, "Personal skills still warn about public-skill placement and the asset-contribution channel");


    execFileSync('node', [EXPORT, '--root', inst, '--out', out, '--slug', 'probe'], { encoding: 'utf8' });
    assert.equal(/user-space\//.test(patchesIn(out)), false, "No user-space paths may appear in patches");
    assert.deepEqual([...pathsInPatches(out)], ['product/' + FRAMEWORK_FILE], "Framework edits must still export normally");


    mkdirSync(join(inst, 'user-space', 'scripts'), { recursive: true });
    writeFileSync(join(inst, 'user-space', 'scripts', 'foo.mjs'), 'export const x = 1;\n');
    const r = runExport(inst, out);
    assert.equal(r.failed, true, "Allowing personal skills must not remove the user-space/scripts export gate");
    assert.match(r.err, /user-space\/scripts\/foo\.mjs/);
  } finally { f.cleanup(); rmSync(out, { recursive: true, force: true }); }
});



test("No exportable paths rejects export without creating artifacts", () => {
  const f = makeInst('9.18.0');
  const out = makeTestDir('aipa-ex-out-');
  try {
    const { inst } = f;
    writeFileSync(join(inst, 'CONTRIBUTION.md'), FILLED);


    let r = runExport(inst, out);
    assert.equal(r.failed, true, "Reject export when no paths are pending");
    assert.match(r.err, /no pending framework changes/);
    assert.deepEqual(readdirSync(out), [], "Rejected execution must not create artifacts");


    writeFileSync(join(inst, '.gitignore'), readFileSync(join(inst, '.gitignore'), 'utf8') + '.claude/commands/local-only.md\n');
    writeFileSync(join(inst, '.claude', 'commands', 'local-only.md'), 'LOCAL-ONLY\n');
    r = runExport(inst, out);
    assert.equal(r.failed, true, "Reject when no pending path can enter a patch");
    assert.match(r.err, /no exportable pending paths/);
    assert.deepEqual(readdirSync(out), [], "Rejected execution must not create artifacts");
  } finally { f.cleanup(); rmSync(out, { recursive: true, force: true }); }
});
