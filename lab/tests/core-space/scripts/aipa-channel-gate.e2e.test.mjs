// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { makeTestDir } from './lib/test-tmp.mjs';
import { PRODUCT, makeOrigin, commitAll, git } from './lib/test-git.mjs';

const INIT = join(PRODUCT, 'scripts', 'aipa-init.mjs');
const PULL = join(PRODUCT, 'core-space', 'scripts', 'aipa-pull-origin.mjs');
const CH = join(PRODUCT, 'core-space', 'scripts', 'aipa-channel.mjs');
const pull = (inst, origin) => execFileSync('node', [PULL, '--root', inst, '--remote', origin], { encoding: 'utf8' });

const manifest = (root) => readFileSync(join(root, 'AIPA-MANIFEST.yaml'), 'utf8');

const verOf = (root) => (manifest(root).match(/^\s*version:\s*(\S+)/m) || [])[1];
const channelOf = (root) => (manifest(root).match(/^\s*channel:\s*(\S+)/m) || [])[1];
const channelLines = (root) => (manifest(root).match(/^\s*channel:/gm) || []).length;
const indentOf = (root, field) => (manifest(root).match(new RegExp(`^(\\s*)${field}:`, 'm')) || [])[1];





function makeChannelOrigin(version, channel) {
  const p = makeOrigin(version);
  writeFileSync(join(p, 'ORIGIN-MANIFEST.yaml'),
    `origin:\n  version: ${version}\n  channel: ${channel}\n  assist_prefix: "AIPA ${version.split('.')[1]} \u667a\u80fd\u4f53\u4e3a\u4f60\u534f\u4f5c："\n`);
  commitAll(p, 'channel ' + channel);
  return p;
}




function makeInstance(version, channel) {
  const root = makeTestDir('aipa-inst-');
  execFileSync('node', [INIT, '--root', root, '--owner', 't'], { encoding: 'utf8' });
  const p = join(root, 'AIPA-MANIFEST.yaml');
  let m = readFileSync(p, 'utf8').replace(/^(\s*)version:\s*\S+/m, `$1version: ${version}`);
  m = channel === null
    ? m.replace(/^\s*channel:.*\r?\n/m, '')
    : m.replace(/^(\s*)channel:\s*\S+/m, `$1channel: ${channel}`);
  writeFileSync(p, m, 'utf8');
  return root;
}

const cleanup = (...dirs) => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); };

test("Cross-channel switching allows a beta instance to select an older stable release", () => {
  const origin = makeOrigin('9.05.0');
  const inst = makeTestDir('aipa-inst-');
  try {
    execFileSync('node', [INIT, '--root', inst, '--owner', 't'], { encoding: 'utf8' });
    pull(inst, origin);


    execFileSync('node', [CH, '--root', inst, '--telemetry', 'on'], { encoding: 'utf8' });
    execFileSync('node', [CH, '--root', inst, '--set', 'beta'], { encoding: 'utf8' });
    const lower = makeOrigin('9.04.0');
    const out = pull(inst, lower);
    assert.match(out, /Switching channel|Base updated/, "Cross-channel switching should be allowed");
    assert.match(readFileSync(join(inst, 'AIPA-MANIFEST.yaml'), 'utf8'), /version:\s*9\.04\.0/);
  } finally { rmSync(origin, { recursive: true, force: true }); rmSync(inst, { recursive: true, force: true }); }
});




const MATRIX = [

  ["Same-channel upgrade: 0.19.0 -> 0.20.0",        '0.19.0',      'stable', '0.20.0',       'stable', true],
  ["Same-channel equal: 0.20.0 -> 0.20.0",        '0.20.0',      'stable', '0.20.0',       'stable', false],
  ["Same-channel downgrade: 0.20.0 -> 0.19.0",        '0.20.0',      'stable', '0.19.0',       'stable', false],
  ["Cross-channel downgrade: 0.20.0-beta.2 -> 0.19.0", '0.20.0-beta.2', 'beta', '0.19.0',       'stable', true],
  ["Same-channel prerelease increment: beta.1 -> beta.2", '0.20.0-beta.1', 'beta', '0.20.0-beta.2', 'beta',  true],
  ["Same-channel promotion: beta.2 -> 0.20.0",      '0.20.0-beta.2', 'beta', '0.20.0',       'beta',   true],
];
for (const [name, instVer, instCh, baseVer, baseCh, allow] of MATRIX) {
  test("Transition matrix: " + name, () => {
    const origin = makeChannelOrigin(baseVer, baseCh);
    const inst = makeInstance(instVer, instCh);
    try {
      const before = manifest(inst);
      const out = pull(inst, origin);
      if (allow) {
        assert.doesNotMatch(out, /Already current/, "The operation should be allowed");


        assert.equal(verOf(inst), baseVer, "The instance manifest must receive the full base version, including prerelease");
      } else {
        assert.match(out, /Already current/, "Same-channel pulls without a newer version must be rejected");
        assert.equal(manifest(inst), before, "Rejected pulls must not change the manifest");
      }
    } finally { cleanup(origin, inst); }
  });
}




test("Cross-channel switching replaces the existing manifest channel line instead of adding another", () => {
  const origin = makeChannelOrigin('0.20.0-beta.2', 'beta');
  const inst = makeInstance('0.19.0', 'stable');
  try {



    execFileSync('node', [CH, '--root', inst, '--telemetry', 'on'], { encoding: 'utf8' });
    const out = pull(inst, origin);
    assert.match(out, /Switching channel: stable → beta/, "Output must identify a channel switch rather than an upgrade");
    assert.equal(channelOf(inst), 'beta', "Write the new channel back to the instance manifest");
    assert.equal(verOf(inst), '0.20.0-beta.2', "The version must also advance to the base version");
    assert.equal(channelLines(inst), 1, "Replace the channel line without adding a duplicate");
    assert.equal(indentOf(inst, 'channel'), indentOf(inst, 'version'),
      "Channel and version must share indentation; a top-level channel is a different YAML key");
  } finally { cleanup(origin, inst); }
});




test("Old manifests without a channel receive one line aligned with version", () => {
  const origin = makeChannelOrigin('0.20.0', 'stable');
  const inst = makeInstance('0.19.0', null);
  try {








    execFileSync('node', [CH, '--root', inst, '--telemetry', 'on'], { encoding: 'utf8' });
    assert.equal(channelOf(inst), undefined, "Precondition: the instance manifest has no channel line");
    const out = execFileSync('node', [PULL, '--root', inst, '--remote', origin, '--channel', 'beta'], { encoding: 'utf8' });
    assert.match(out, /Switching channel: stable → beta/, "An explicit --channel switch must be recognized");
    assert.equal(channelOf(inst), 'beta', "Insert a missing channel line so the switch is recorded");
    assert.equal(channelLines(inst), 1, "Do not insert duplicate lines");
    assert.equal(indentOf(inst, 'channel'), indentOf(inst, 'version'),
      "The inserted line must be inside aipa and aligned with version");
  } finally { cleanup(origin, inst); }
});



test("Invalid --channel values are rejected with the manifest byte-for-byte unchanged", () => {
  const origin = makeChannelOrigin('0.20.0', 'stable');
  const inst = makeInstance('0.19.0', 'stable');
  try {
    const before = manifest(inst);

    assert.throws(
      () => execFileSync('node', [PULL, '--root', inst, '--remote', origin, '--channel', 'canary'], { stdio: 'pipe' }),
      (e) => /accepts only stable or beta/.test(String(e.stderr || '')) && /canary/.test(String(e.stderr || '')),
      "Reject invalid --channel specifically because only stable/beta are accepted, not an unrelated failure",
    );
    assert.equal(manifest(inst), before, "Rejected pulls must not change the manifest");
  } finally { cleanup(origin, inst); }
});



test("Invalid instance channels normalize to stable with a warning and do not bypass version checks", () => {
  const origin = makeChannelOrigin('0.19.0', 'stable');
  const inst = makeInstance('0.20.0', 'canary');
  try {
    const before = manifest(inst);
    const r = spawnSync('node', [PULL, '--root', inst, '--remote', origin], { encoding: 'utf8' });
    assert.match(String(r.stdout || ''), /Already current/, "After canary normalizes to stable, same-channel downgrade rejection must apply");
    assert.match(String(r.stderr || ''), /unrecognized release channel "canary"|release channel "canary"[\s\S]*unrecognized/, "Warn with the offending value instead of silently falling back");
    assert.equal(manifest(inst), before, "Rejected pulls must not change any manifest bytes, including the channel line");
  } finally { cleanup(origin, inst); }
});

// ══════════════════════════════════════════════════════════════════════════════

//




// ══════════════════════════════════════════════════════════════════════════════
const REPO_ROOT = resolve(PRODUCT, '..');
const PUBLISH = join(REPO_ROOT, 'studio', 'scripts', 'aipa-publish-origin.mjs');



function makeBuildRepo(branch) {
  const p = makeTestDir('aipa-build-');
  git(p, ['init', '-q', '-b', branch]);
  return p;
}


const publish = (root, build, ...extra) => execFileSync(
  'node', [PUBLISH, '--root', root, '--src', build, ...extra], { encoding: 'utf8' },
);





const CRLF = (s) => s.split('\n').join('\r\n');
function makePublishableOrigin(version, build) {
  const p = makeTestDir('aipa-pub-');
  const assist = `AIPA ${version.split('-')[0].split('.')[1]} \u667a\u80fd\u4f53\u4e3a\u4f60\u534f\u4f5c：`;
  writeFileSync(join(p, 'ORIGIN-MANIFEST.yaml'),
    CRLF(`origin:\n  version: ${version}\n  assist_prefix: "${assist}"\n`));
  writeFileSync(join(p, 'framework.md'), CRLF("# \u6846\u67b6\n"));
  writeFileSync(join(p, 'origin-checksums.txt'), CRLF(
    ['ORIGIN-MANIFEST.yaml', 'framework.md']
      .map((f) => `${createHash('sha256').update(readFileSync(join(p, f))).digest('hex')}  ${f}`).join('\n') + '\n'));
  if(build){
    mkdirSync(join(build,'product'),{recursive:true});
    for(const name of ['ORIGIN-MANIFEST.yaml','framework.md'])cpSync(join(p,name),join(build,'product',name));
    writeFileSync(join(build,'.gitattributes'),'product/** -text\n');
    git(build,['config','user.name','Synthetic']);git(build,['config','user.email','synthetic@example.invalid']);
    git(build,['add','--all']);git(build,['commit','-qm','Synthetic CRLF build source']);
    execFileSync(process.execPath,[join(REPO_ROOT,'studio/scripts/aipa-assemble-origin.mjs'),'--src',build,'--dest',p],{stdio:'pipe'});
  }
  git(p, ['init', '-q']);
  git(p, ['config', 'user.email', 't@t']);
  git(p, ['config', 'user.name', 't']);
  return { path: p, assist };
}

test("Publishing from dev writes channel beta with exact CRLF bytes and pushes the beta branch", () => {
  const build = makeBuildRepo('dev');
  const { path: root, assist } = makePublishableOrigin('0.20.0-beta.1',build);
  const bare = makeTestDir('aipa-bare-');
  execFileSync('git', ['init', '--bare', bare], { stdio: 'ignore' });
  git(root, ['remote', 'add', 'origin', bare]);
  try {
    publish(root, build, '--push');





    assert.equal(readFileSync(join(root, 'ORIGIN-MANIFEST.yaml'), 'utf8'),
      CRLF(`origin:\n  version: 0.20.0-beta.1\n  channel: beta\n  build_source:\n    schema: 1\n    commit: ${git(build,['rev-parse','HEAD']).trim()}\n    branch: "dev"\n    dirty: false\n  assist_prefix: "${assist}"\n`),
      "The manifest must differ only by a channel line after version, preserving CRLF and indentation");

    assert.match(git(bare, ['branch', '--list']), /beta/, "Push the beta branch");
    assert.doesNotMatch(git(bare, ['branch', '--list']), /master/, "Publishing from dev must not write master");
  } finally { cleanup(root, bare, build); }
});

test("Publishing from master writes stable, pushes master, and creates no changes on repeat", () => {
  const build = makeBuildRepo('master');
  const { path: root } = makePublishableOrigin('0.20.0',build);
  const bare = makeTestDir('aipa-bare-');
  execFileSync('git', ['init', '--bare', bare], { stdio: 'ignore' });
  git(root, ['remote', 'add', 'origin', bare]);
  try {
    publish(root, build);
    assert.match(readFileSync(join(root, 'ORIGIN-MANIFEST.yaml'), 'utf8'), /^\s+channel: stable$/m);


    const out = publish(root, build);
    assert.match(out, /No new changes/, "A second publish with the same channel must not create a commit");


    publish(root, build, '--push');
    assert.match(git(bare, ['branch', '--list']), /master/, "Stable must push master");
    assert.doesNotMatch(git(bare, ['branch', '--list']), /beta/, "Stable must not land on beta");
  } finally { cleanup(root, bare, build); }
});

test("Publishing rejects a channel inconsistent with the source branch without side effects", () => {
  const { path: root } = makePublishableOrigin('0.20.0');
  const build = makeBuildRepo('master');
  try {
    const before = readFileSync(join(root, 'ORIGIN-MANIFEST.yaml'), 'utf8');
    assert.throws(
      () => publish(root, build, '--channel', 'canary'),
      (e) => /--channel differs from the source-branch channel/.test(String(e.stderr || '')),
      "Reject a mismatched --channel instead of normalizing it to another release line",
    );
    assert.equal(readFileSync(join(root, 'ORIGIN-MANIFEST.yaml'), 'utf8'), before, "Rejected publication must not change the base");
  } finally { cleanup(root, build); }
});



function makeTwoBranchOrigin(stableVer, betaVer) {
  const p = makeOrigin(stableVer);
  const defaultBranch = git(p, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  const write = (ver, ch, line) => {
    writeFileSync(join(p, 'ORIGIN-MANIFEST.yaml'),
      `origin:\n  version: ${ver}\n  channel: ${ch}\n  assist_prefix: "AIPA ${ver.split('-')[0].split('.')[1]} \u667a\u80fd\u4f53\u4e3a\u4f60\u534f\u4f5c："\n`);
    writeFileSync(join(p, 'templates', 'personal', 'AGENTS.md'), `# ${line} branch\n`);
  };
  write(stableVer, 'stable', 'master');
  commitAll(p, 'stable line ' + stableVer);
  git(p, ['checkout', '-q', '-b', 'beta']);
  write(betaVer, 'beta', 'beta');
  commitAll(p, 'beta line ' + betaVer);
  git(p, ['checkout', '-q', defaultBranch]);

  const advanceBeta = (ver) => {
    git(p, ['checkout', '-q', 'beta']);
    write(ver, 'beta', 'beta');
    commitAll(p, 'beta line ' + ver);
    git(p, ['checkout', '-q', defaultBranch]);
  };
  return { path: p, defaultBranch, advanceBeta };
}

test("A beta instance uses beta content even when the upstream cache already exists", () => {
  const { path: origin, advanceBeta } = makeTwoBranchOrigin('9.01.0', '9.02.0-beta.1');
  const inst = makeInstance('9.01.0', 'beta');
  try {
    pull(inst, origin);
    assert.equal(verOf(inst), '9.02.0-beta.1', "The instance must receive the beta version");
    assert.match(readFileSync(join(inst, 'AGENTS.md'), 'utf8'), /beta branch/, "The instance must receive beta-branch content");
    assert.equal(channelOf(inst), 'beta');



    advanceBeta('9.02.0-beta.2');
    pull(inst, origin);
    assert.equal(verOf(inst), '9.02.0-beta.2', "An existing cache must still select beta rather than master");
    assert.match(readFileSync(join(inst, 'AGENTS.md'), 'utf8'), /beta branch/, "Content must come from beta");
  } finally { cleanup(origin, inst); }
});

test("A stable instance must not accidentally switch to beta", () => {
  const { path: origin } = makeTwoBranchOrigin('9.01.0', '9.02.0-beta.1');
  const inst = makeInstance('9.00.0', 'stable');
  try {
    pull(inst, origin);
    assert.equal(verOf(inst), '9.01.0', "The stable instance must remain on the stable version");
    assert.match(readFileSync(join(inst, 'AGENTS.md'), 'utf8'), /master branch/, "Do not read beta-branch content");
  } finally { cleanup(origin, inst); }
});

test("Explicit --channel beta switches a stable instance to beta and records the channel", () => {
  const { path: origin } = makeTwoBranchOrigin('9.01.0', '9.02.0-beta.1');
  const inst = makeInstance('9.00.0', 'stable');
  try {



    execFileSync('node', [CH, '--root', inst, '--telemetry', 'on'], { encoding: 'utf8' });
    const out = execFileSync('node', [PULL, '--root', inst, '--remote', origin, '--channel', 'beta'], { encoding: 'utf8' });
    assert.match(out, /Switching channel: stable → beta/, "Recognize an explicit channel switch");
    assert.equal(verOf(inst), '9.02.0-beta.1');
    assert.equal(channelOf(inst), 'beta', "Persist the channel switch so future pulls do not treat the instance as stable");
    assert.match(readFileSync(join(inst, 'AGENTS.md'), 'utf8'), /beta branch/, "Both content and channel must switch to beta");
  } finally { cleanup(origin, inst); }
});




test("Initializing from a beta base preserves the full prerelease version", () => {
  const base = makeTestDir('aipa-base-');
  cpSync(PRODUCT, base, { recursive: true });
  writeFileSync(join(base, 'ORIGIN-MANIFEST.yaml'),
    "origin:\n  version: 0.20.0-beta.1\n  channel: beta\n  assist_prefix: \"AIPA 0.20 \u667a\u80fd\u4f53\u4e3a\u4f60\u534f\u4f5c：\"\n");
  const inst = makeTestDir('aipa-inst-');
  try {
    execFileSync('node', [join(base, 'scripts', 'aipa-init.mjs'), '--root', inst, '--owner', 't'], { encoding: 'utf8' });


    assert.equal(verOf(inst), '0.20.0-beta.1', "Initialization must read the complete base version");
  } finally { cleanup(base, inst); }
});
