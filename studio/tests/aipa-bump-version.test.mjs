// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';



function setup(version, branch = 'master') {
  const root = mkdtempSync(join(tmpdir(), 'aipa-bump-'));
  mkdirSync(join(root, 'product'), { recursive: true });
  writeFileSync(join(root, 'product', 'ORIGIN-MANIFEST.yaml'), `origin:\n  version: ${version}\n  assist_prefix: "AIPA ${version.split('.').slice(0,2).join('.')} \u667a\u80fd\u4f53\u4e3a\u4f60\u534f\u4f5c："\n`);
  writeFileSync(join(root, 'product', 'VERSION'), version + '\n');
  execFileSync('git', ['init', '-b', branch, root], { stdio: 'ignore' });
  return root;
}

test("Version bump increments minor and synchronizes manifest, VERSION, and assist_prefix", () => {
  const root = setup('1.7.0');
  execFileSync('node', ['studio/scripts/aipa-bump-version.mjs', '--root', root]);
  const manifest = readFileSync(join(root, 'product', 'ORIGIN-MANIFEST.yaml'), 'utf8');
  assert.match(manifest, /version:\s*1\.8\.0/);
  assert.match(manifest, /assist_prefix:\s*"AIPA 1\.8 collaborates with you: "/);
  assert.strictEqual(readFileSync(join(root, 'product', 'VERSION'), 'utf8'), '1.8.0\n');
});

test("Version bump preserves patch and indentation", () => {
  const root = setup('1.7.0');
  execFileSync('node', ['studio/scripts/aipa-bump-version.mjs', '--root', root]);
  const manifest = readFileSync(join(root, 'product', 'ORIGIN-MANIFEST.yaml'), 'utf8');
  assert.match(manifest, /^  version:\s*1\.8\.0/m, "Version remains indented inside origin");
});



test("Missing manifests fail explicitly", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-bump-'));
  assertRefused(() => execFileSync('node', ['studio/scripts/aipa-bump-version.mjs', '--root', root]), /Missing product\/ORIGIN-MANIFEST\.yaml/);
});

const bump = (root, ...extra) => execFileSync('node', ['studio/scripts/aipa-bump-version.mjs', '--root', root, ...extra]);
const manifestOf = (root) => readFileSync(join(root, 'product', 'ORIGIN-MANIFEST.yaml'), 'utf8');
const versionOf = (root) => readFileSync(join(root, 'product', 'VERSION'), 'utf8').trim();





const assertRefused = (fn, re) => assert.throws(fn, (err) => err.status === 1 && re.test(String(err.stderr)));

test("Initial beta version bumps start the prerelease sequence at one", () => {
  const root = setup('0.19.0', 'dev');
  bump(root);
  assert.equal(versionOf(root), '0.20.0-beta.1');
  assert.match(manifestOf(root), /version: 0\.20\.0-beta\.1/);

  assert.match(manifestOf(root), /assist_prefix:\s*"AIPA 0\.20 collaborates with you: "/);
});

test("Repeated beta bumps increment the sequence", () => {
  const root = setup('0.19.0', 'dev');
  bump(root);
  bump(root);
  assert.equal(versionOf(root), '0.20.0-beta.2');
  assert.match(manifestOf(root), /version: 0\.20\.0-beta\.2/);
});





test("Existing prereleases increment only their sequence and keep manifest/VERSION consistent", () => {
  const root = setup('0.20.0-beta.1', 'dev');
  bump(root);
  assert.equal(versionOf(root), '0.20.0-beta.2', "VERSION must increment the prerelease sequence");
  assert.match(manifestOf(root), /^\s+version: 0\.20\.0-beta\.2$/m, "The entire manifest version line must contain the new version");
  assert.doesNotMatch(manifestOf(root), /-beta\.1/, "No previous prerelease suffix may remain");
});



test("Stable version bumps increment minor and replace the old prerelease suffix", () => {
  const root = setup('0.20.0-beta.3', 'master');
  bump(root);
  assert.equal(versionOf(root), '0.21.0');
  assert.match(manifestOf(root), /^\s+version: 0\.21\.0$/m, "The version line must contain no prerelease leftovers");
  assert.doesNotMatch(manifestOf(root), /-beta/, "Replace the entire old prerelease suffix");
});

test("Dev derives beta without --pre; the source branch determines the channel", () => {
  const root = setup('0.19.0', 'dev');
  bump(root);
  assert.equal(versionOf(root), '0.20.0-beta.1');
});

test("Explicit --pre beta on dev is accepted as a consistent validation argument", () => {
  const root = setup('0.19.0', 'dev');
  bump(root, '--pre', 'beta');
  assert.equal(versionOf(root), '0.20.0-beta.1');
});

test("A prerelease inconsistent with the source branch is rejected", () => {
  const root = setup('0.19.0', 'dev');
  assertRefused(() => bump(root, '--pre', 'rc'), /--pre differs from the current source branch/);
});

test("Non-release branches cannot bump versions", () => {
  const root = setup('0.19.0', 'feature/whatever');
  assertRefused(() => bump(root), /requires Origin dev or master/);
});
