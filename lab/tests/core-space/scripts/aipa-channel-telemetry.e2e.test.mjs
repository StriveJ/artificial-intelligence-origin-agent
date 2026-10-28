// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeTestDir } from './lib/test-tmp.mjs';
import { PRODUCT, makeOrigin } from './lib/test-git.mjs';



//





//





const INIT = join(PRODUCT, 'scripts', 'aipa-init.mjs');
const CH = join(PRODUCT, 'core-space', 'scripts', 'aipa-channel.mjs');
const PULL = join(PRODUCT, 'core-space', 'scripts', 'aipa-pull-origin.mjs');
const manifest = (r) => readFileSync(join(r, 'AIPA-MANIFEST.yaml'), 'utf8');

const fieldOf = (r, f) => (manifest(r).match(new RegExp(`^\\s+${f}:\\s*(\\S+)`, 'm')) || [])[1];

const indentOf = (r, f) => (manifest(r).match(new RegExp(`^(\\s*)${f}:`, 'm')) || [])[1];
const cleanup = (...dirs) => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); };

const runFail = (args) => {
  const r = spawnSync('node', args, { encoding: 'utf8' });
  return { status: r.status, stderr: String(r.stderr || ''), stdout: String(r.stdout || '') };
};




test("Default telemetry is off inside the aipa block, aligned with channel", () => {
  const root = makeTestDir('aipa-tel-');
  try {
    execFileSync('node', [INIT, '--root', root, '--owner', 't'], { encoding: 'utf8' });
    assert.equal(fieldOf(root, 'telemetry'), 'off');
    assert.equal(indentOf(root, 'telemetry'), indentOf(root, 'channel'),
      "Telemetry must align with channel; a top-level key cannot be read as the instance setting");
  } finally { cleanup(root); }
});



test("--telemetry on writes a readable value without duplicate lines", () => {
  const root = makeTestDir('aipa-tel-');
  try {
    execFileSync('node', [INIT, '--root', root, '--owner', 't'], { encoding: 'utf8' });


    assert.match(execFileSync('node', [CH, '--root', root, '--telemetry', 'on'], { encoding: 'utf8' }), /^on$/m);
    assert.equal(fieldOf(root, 'telemetry'), 'on');
    assert.equal(indentOf(root, 'telemetry'), indentOf(root, 'channel'));
    assert.equal((manifest(root).match(/^\s*telemetry:/gm) || []).length, 1, "Replace telemetry without adding a duplicate line");
  } finally { cleanup(root); }
});



test("--telemetry off disables previously enabled reporting", () => {
  const root = makeTestDir('aipa-tel-');
  try {
    execFileSync('node', [INIT, '--root', root, '--owner', 't'], { encoding: 'utf8' });
    execFileSync('node', [CH, '--root', root, '--telemetry', 'on'], { encoding: 'utf8' });
    execFileSync('node', [CH, '--root', root, '--telemetry', 'off'], { encoding: 'utf8' });
    assert.equal(fieldOf(root, 'telemetry'), 'off');
  } finally { cleanup(root); }
});





test("Old instances receive channel/telemetry lines aligned with version", () => {
  const root = makeTestDir('aipa-tel-');
  try {
    execFileSync('node', [INIT, '--root', root, '--owner', 't'], { encoding: 'utf8' });
    const p = join(root, 'AIPA-MANIFEST.yaml');
    writeFileSync(p, manifest(root).replace(/^\s*channel:.*\r?\n/m, '').replace(/^\s*telemetry:.*\r?\n/m, ''));
    assert.equal(fieldOf(root, 'telemetry'), undefined, "Precondition: the old instance has no telemetry line");
    execFileSync('node', [CH, '--root', root, '--telemetry', 'on'], { encoding: 'utf8' });
    assert.equal(fieldOf(root, 'telemetry'), 'on', "The inserted value must be readable");
    assert.equal(indentOf(root, 'telemetry'), indentOf(root, 'version'),
      "Inserted values must be inside aipa and aligned with version");
    assert.equal((manifest(root).match(/^\s*telemetry:/gm) || []).length, 1, "Do not insert duplicate lines");
  } finally { cleanup(root); }
});






test("Successful --telemetry on also displays disclosure, while off does not", () => {
  const root = makeTestDir('aipa-tel-');
  try {
    execFileSync('node', [INIT, '--root', root, '--owner', 't'], { encoding: 'utf8' });
    const on = execFileSync('node', [CH, '--root', root, '--telemetry', 'on'], { encoding: 'utf8' });
    assert.match(on, /excludes memory|anonymous device ID/, "Enabling telemetry must display its scope and purpose");
    assert.match(on, /stable never reports proactively/, "Disclosure must state that stable never reports automatically");
    const off = execFileSync('node', [CH, '--root', root, '--telemetry', 'off'], { encoding: 'utf8' });
    assert.doesNotMatch(off, /excludes memory|anonymous device ID/, "Disabling telemetry is not consent and must not print disclosure");
  } finally { cleanup(root); }
});






test("Bare --telemetry is rejected without writing the manifest", () => {
  const root = makeTestDir('aipa-tel-');
  try {
    execFileSync('node', [INIT, '--root', root, '--owner', 't'], { encoding: 'utf8' });
    const before = manifest(root);
    const { status, stderr } = runFail([CH, '--root', root, '--telemetry']);
    assert.notEqual(status, 0, "Reject bare --telemetry instead of silently reading and implying consent");
    assert.match(stderr, /--telemetry/, "The rejection must identify the invalid argument");
    assert.equal(manifest(root), before, "Rejected execution must not change the manifest");
  } finally { cleanup(root); }
});


test("Invalid --telemetry values are rejected without changing manifest bytes", () => {
  const root = makeTestDir('aipa-tel-');
  try {
    execFileSync('node', [INIT, '--root', root, '--owner', 't'], { encoding: 'utf8' });
    const before = manifest(root);
    const { status, stderr } = runFail([CH, '--root', root, '--telemetry', 'canary']);
    assert.notEqual(status, 0);
    assert.match(stderr, /on|off/, "The rejection must explain that only on/off are accepted");
    assert.equal(manifest(root), before, "Rejected execution must not insert even a telemetry line");
  } finally { cleanup(root); }
});





test("Beta initialization without consent fails before creating any instance files", () => {
  const root = makeTestDir('aipa-tel-');
  try {

    const { status, stderr } = runFail([INIT, '--root', root, '--owner', 't', '--channel', 'beta']);
    assert.notEqual(status, 0, "Do not install a beta instance without consent");
    assert.match(stderr, /consent|telemetry/, "The failure must specifically identify the consent gate");
    assert.deepEqual(existsSync(root) ? readdirSync(root) : [], [],
      "Check consent before all filesystem changes so rejection leaves no partial instance");
  } finally { cleanup(root); }
});



test("Beta initialization with explicit telemetry off also fails", () => {
  const root = makeTestDir('aipa-tel-');
  try {
    const { status, stderr } = runFail([INIT, '--root', root, '--owner', 't', '--channel', 'beta', '--telemetry', 'off']);
    assert.notEqual(status, 0, "Explicit off is not consent");
    assert.match(stderr, /consent|telemetry/);
    assert.deepEqual(existsSync(root) ? readdirSync(root) : [], [], "Rejected initialization must leave no partial instance");
  } finally { cleanup(root); }
});



test("Beta initialization with telemetry on records both settings and displays disclosure", () => {
  const root = makeTestDir('aipa-tel-');
  try {


    const out = execFileSync('node', [INIT, '--root', root, '--owner', 't', '--channel', 'beta', '--telemetry', 'on'], { encoding: 'utf8' });
    assert.match(out, /excludes memory|anonymous device ID/, "Enabling telemetry must display explicit disclosure");
    assert.equal(fieldOf(root, 'channel'), 'beta');
    assert.equal(fieldOf(root, 'telemetry'), 'on');
    assert.equal(indentOf(root, 'telemetry'), indentOf(root, 'channel'), "Consent must be aligned with channel");
  } finally { cleanup(root); }
});


test("Default initialization uses stable with telemetry off", () => {
  const root = makeTestDir('aipa-tel-');
  try {
    const out = execFileSync('node', [INIT, '--root', root, '--owner', 't'], { encoding: 'utf8' });
    assert.equal(fieldOf(root, 'channel'), 'stable');
    assert.equal(fieldOf(root, 'telemetry'), 'off');
    assert.doesNotMatch(out, /excludes memory|anonymous device ID/, "Default initialization without enabling telemetry must not print disclosure");
  } finally { cleanup(root); }
});




test("Stable initialization with telemetry on also displays disclosure", () => {
  const root = makeTestDir('aipa-tel-');
  try {
    const out = execFileSync('node', [INIT, '--root', root, '--owner', 't', '--channel', 'stable', '--telemetry', 'on'], { encoding: 'utf8' });
    assert.equal(fieldOf(root, 'channel'), 'stable');
    assert.equal(fieldOf(root, 'telemetry'), 'on');
    assert.match(out, /excludes memory|anonymous device ID/, "Any action enabling telemetry must display disclosure");
  } finally { cleanup(root); }
});





test("Joining beta without consent rejects pull-origin and preserves the instance manifest", () => {
  const p = makeOrigin('9.09.0');
  const inst = makeTestDir('aipa-tel-');
  try {
    execFileSync('node', [INIT, '--root', inst, '--owner', 't'], { encoding: 'utf8' });
    const before = manifest(inst);
    let failed = false, err = '', status = 0;
    try { execFileSync('node', [PULL, '--root', inst, '--remote', p, '--channel', 'beta'], { encoding: 'utf8', stdio: 'pipe' }); }
    catch (e) { failed = true; err = String(e.stderr || ''); status = e.status; }
    assert.equal(failed, true, "Do not join beta without consent");
    assert.notEqual(status, 0);
    assert.match(err, /telemetry|consent/, "The failure must specifically come from the consent gate");


    assert.match(err, /Beta enrollment requires explicit consent/, "An existing instance without consent needs consent-gate wording");
    assert.doesNotMatch(err, /not an AIPA instance/, "Do not describe an existing instance as missing");
    assert.equal(manifest(inst), before, "Rejected pulls must not switch the instance to beta or leave other changes");
  } finally { cleanup(p, inst); }
});




test("Consent via telemetry on permits joining beta through pull-origin", () => {
  const p = makeOrigin('9.09.0');
  const inst = makeTestDir('aipa-tel-');
  try {
    execFileSync('node', [INIT, '--root', inst, '--owner', 't'], { encoding: 'utf8' });
    execFileSync('node', [CH, '--root', inst, '--telemetry', 'on'], { encoding: 'utf8' });
    const out = execFileSync('node', [PULL, '--root', inst, '--remote', p, '--channel', 'beta'], { encoding: 'utf8' });
    assert.match(out, /Switching channel|Base updated/, "Consent must allow joining beta");
    assert.equal(fieldOf(inst, 'channel'), 'beta', "Joining beta must persist the channel");
    assert.equal(fieldOf(inst, 'telemetry'), 'on', "Synchronization must not erase consent");
  } finally { cleanup(p, inst); }
});









test("Combining --set and --telemetry is rejected without changing manifest bytes", () => {
  const root = makeTestDir('aipa-tel-');
  try {
    execFileSync('node', [INIT, '--root', root, '--owner', 't'], { encoding: 'utf8' });
    const before = manifest(root);
    const { status, stderr } = runFail([CH, '--root', root, '--set', 'beta', '--telemetry', 'on']);
    assert.notEqual(status, 0, "Reject both flags together instead of silently ignoring one and bypassing future consent checks");
    assert.match(stderr, /--set[\s\S]*--telemetry/, "The rejection must name the two incompatible arguments");
    assert.equal(manifest(root), before, "Reject before any write and require separate commands");
  } finally { cleanup(root); }
});








test("--set beta requires consent and preserves bytes on rejection; --set stable remains unrestricted", () => {
  const root = makeTestDir('aipa-tel-');
  try {
    execFileSync('node', [INIT, '--root', root, '--owner', 't'], { encoding: 'utf8' });
    const before = manifest(root);
    const { status, stderr } = runFail([CH, '--root', root, '--set', 'beta']);
    assert.notEqual(status, 0, "Joining beta through --set requires consent");
    assert.match(stderr, /consent|telemetry/, "The failure must specifically come from the consent gate");
    assert.match(stderr, /--telemetry on/, "The rejection must explain the next action");
    assert.equal(manifest(root), before, "Rejected --set must preserve all manifest bytes");


    execFileSync('node', [CH, '--root', root, '--telemetry', 'on'], { encoding: 'utf8' });
    assert.equal(execFileSync('node', [CH, '--root', root, '--set', 'beta'], { encoding: 'utf8' }).trim(), 'beta');
    assert.equal(fieldOf(root, 'channel'), 'beta', "Joining beta must succeed after consent");
    assert.equal(fieldOf(root, 'telemetry'), 'on', "This step must not erase consent");


    execFileSync('node', [CH, '--root', root, '--telemetry', 'off'], { encoding: 'utf8' });
    assert.equal(execFileSync('node', [CH, '--root', root, '--set', 'stable'], { encoding: 'utf8' }).trim(), 'stable',
      "Leaving beta through --set stable does not require consent");
    assert.equal(fieldOf(root, 'channel'), 'stable');
  } finally { cleanup(root); }
});






test("Empty channel/telemetry values are filled in place without consuming following lines or duplicating keys", () => {
  const root = makeTestDir('aipa-tel-');
  const p = join(root, 'AIPA-MANIFEST.yaml');
  try {

    writeFileSync(p, 'aipa:\n  version: 0.19.0\n  channel:\n  owner: t\n');


    execFileSync('node', [CH, '--root', root, '--telemetry', 'on'], { encoding: 'utf8' });
    execFileSync('node', [CH, '--root', root, '--set', 'beta'], { encoding: 'utf8' });
    assert.match(manifest(root), /^[ \t]+channel:[ \t]*beta\r?$/m, "Fill the empty value in place without appending the next line");
    assert.equal(fieldOf(root, 'owner'), 't', "An empty channel value must not consume the next key");
    assert.equal(fieldOf(root, 'channel'), 'beta');
    assert.equal((manifest(root).match(/^[ \t]*channel:/gm) || []).length, 1, "Do not add a second line");

    writeFileSync(p, 'aipa:\n  version: 0.19.0\n  telemetry:\n  owner: t\n');
    execFileSync('node', [CH, '--root', root, '--telemetry', 'on'], { encoding: 'utf8' });
    assert.match(manifest(root), /^[ \t]+telemetry:[ \t]*on\r?$/m, "Fill the empty value in place without appending the next line");
    assert.equal(fieldOf(root, 'owner'), 't', "An empty telemetry value must not consume the next key");
    assert.equal((manifest(root).match(/^[ \t]*telemetry:/gm) || []).length, 1, "Do not add a second line");



    writeFileSync(p, 'aipa:\n  version: 0.19.0\n  channel:\n  owner: t\n');
    assert.equal(execFileSync('node', [CH, '--root', root], { encoding: 'utf8' }).trim(), 'stable',
      "An empty value behaves as missing with stable fallback, not as the next key");
  } finally { cleanup(root); }
});







test("Channel writeback fills an empty channel without consuming owner or duplicating lines", () => {
  const p = makeOrigin('9.09.0');
  const inst = makeTestDir('aipa-tel-');
  try {
    execFileSync('node', [INIT, '--root', inst, '--owner', 't'], { encoding: 'utf8' });
    writeFileSync(join(inst, 'AIPA-MANIFEST.yaml'),
      manifest(inst).replace(/^[ \t]*channel:[ \t]*\S+[ \t]*\r?\n/m, '  channel:\n'));
    assert.match(manifest(inst), /^[ \t]+channel:[ \t]*\r?$/m, "Precondition: the fixture has a channel key with no value");
    execFileSync('node', [CH, '--root', inst, '--telemetry', 'on'], { encoding: 'utf8' });
    const r = spawnSync('node', [PULL, '--root', inst, '--remote', p, '--channel', 'beta'], { encoding: 'utf8' });
    assert.equal(r.status, 0, "Consent must allow the transition: " + String(r.stderr || ''));
    assert.match(manifest(inst), /^[ \t]+channel:[ \t]*beta\r?$/m, "Fill beta in place without appending the next line");
    assert.equal(fieldOf(inst, 'owner'), 't', "An empty channel value must not consume owner");
    assert.equal((manifest(inst).match(/^[ \t]*channel:/gm) || []).length, 1, "Do not add a second line");
    assert.doesNotMatch(String(r.stderr || ''), /unrecognized/, "An empty channel is missing, not an unrecognized value");
  } finally { cleanup(p, inst); }
});






test("A directory without an instance manifest reports not-an-instance instead of an ENOENT stack", () => {
  const p = makeOrigin('9.09.0');
  const bare = makeTestDir('aipa-tel-');
  try {
    const { status, stderr } = runFail([PULL, '--root', bare, '--remote', p, '--channel', 'beta']);
    assert.notEqual(status, 0, "A missing manifest must prevent joining beta");
    assert.match(stderr, /not an AIPA instance|missing [\s\S]*AIPA-MANIFEST\.yaml/, "The rejection must identify the real cause: not an instance");
    assert.doesNotMatch(stderr, /Beta enrollment requires explicit consent/, "Do not misreport a missing instance as missing consent");
    assert.doesNotMatch(stderr, /ENOENT|at Object\.readFileSync/, "Missing manifests must not leak exception stacks");
  } finally { cleanup(p, bare); }
});
