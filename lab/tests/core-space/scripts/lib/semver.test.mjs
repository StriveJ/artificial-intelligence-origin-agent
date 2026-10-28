// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, versionOf, VERSION_TOKEN, nextReleaseVersion } from '../../../../../product/core-space/scripts/lib/semver.mjs';


//




//






const cmp = (a, b) => Math.sign(compareVersions(a, b));

test('Release increments after 1.0 use unpadded SemVer components and preserve channel rules', () => {
  assert.equal(nextReleaseVersion('1.0.0', 'stable'), '1.1.0');
  assert.equal(nextReleaseVersion('1.0.0', 'beta'), '1.1.0-beta.1');
  assert.equal(nextReleaseVersion('1.1.3-beta.9', 'beta'), '1.1.3-beta.10');
  assert.equal(nextReleaseVersion('1.1.3-beta.9', 'stable'), '1.2.3');
});

test("Compare numeric core components rather than strings: 0.9.0 < 0.20.0", () => {


  assert.equal(cmp('0.9.0', '0.20.0'), -1);
  assert.equal(cmp('0.20.0', '0.9.0'), 1);
});

test("Stable outranks the matching prerelease: 0.20.0 > 0.20.0-beta.2", () => {


  assert.equal(cmp('0.20.0', '0.20.0-beta.2'), 1);
  assert.equal(cmp('0.20.0-beta.2', '0.20.0'), -1);
});

test("Prerelease numeric components sort numerically:beta.2 <beta.10", () => {

  assert.equal(cmp('0.20.0-beta.2', '0.20.0-beta.10'), -1);
  assert.equal(cmp('0.20.0-beta.10', '0.20.0-beta.2'), 1);
});

test("beta.10 >beta.9; lexical order would be wrong", () => {


  assert.equal(cmp('0.20.0-beta.10', '0.20.0-beta.9'), 1);
  assert.equal(cmp('0.20.0-beta.9', '0.20.0-beta.10'), -1);
});

test("A shorter matching component sequence sorts first:beta.2 <beta.2.1", () => {

  assert.equal(cmp('0.20.0-beta.2', '0.20.0-beta.2.1'), -1);
  assert.equal(cmp('0.20.0-beta.2.1', '0.20.0-beta.2'), 1);
});

test("Numeric identifiers sort before nonnumeric identifiers under SemVer", () => {


  assert.equal(cmp('0.20.0-1', '0.20.0-alpha'), -1);
  assert.equal(cmp('0.20.0-alpha', '0.20.0-1'), 1);
});

test("Matching prefixes sort lexically:alpha <alpha.1 <beta", () => {


  assert.equal(cmp('0.20.0-alpha', '0.20.0-alpha.1'), -1);
  assert.equal(cmp('0.20.0-alpha.1', '0.20.0-beta'), -1);
});

test("Build metadata does not participate in comparison", () => {

  assert.equal(cmp('0.20.0+build.5', '0.20.0'), 0);
  assert.equal(cmp('0.20.0-beta.2+b1', '0.20.0-beta.2+b2'), 0);
});





const CHAIN = [
  '0.9.0', '0.19.0',
  '0.20.0-alpha', '0.20.0-alpha.1', '0.20.0-beta.1', '0.20.0-beta.2', '0.20.0-beta.10', '0.20.0-rc.1',
  '0.20.0', '0.20.1', '0.21.0',
];
test("Every earlier/later pair in the ordered chain increases; self-comparison is zero", () => {
  for (let i = 0; i < CHAIN.length; i++) {
    for (let j = i + 1; j < CHAIN.length; j++) {
      assert.equal(cmp(CHAIN[i], CHAIN[j]), -1, `${CHAIN[i]} must be less than ${CHAIN[j]}`);
      assert.equal(cmp(CHAIN[j], CHAIN[i]), 1, `${CHAIN[j]} must be greater than ${CHAIN[i]}`);
    }
  }


  for (const v of CHAIN) assert.equal(cmp(v, v), 0, `${v} must compare equal to itself`);
});

test("versionOf returns the complete prerelease version without cutting at a hyphen", () => {


  assert.equal(versionOf('origin:\n  version: 0.20.0-beta.2\n  assist_prefix: "x"\n'), '0.20.0-beta.2');
  assert.equal(versionOf('aipa:\n  version: 0.20.0\n  channel: beta\n'), '0.20.0');
  assert.equal(versionOf('origin:\n  version: 0.20.0-rc.1+build.7\n'), '0.20.0-rc.1+build.7');
});

test("versionOf reads anchored version lines instead of scraping prose", () => {

  assert.equal(versionOf("\u6b63\u6587\u63d0\u5230 version: 1.2.3 \u4f46\u4e0d\u5728\u884c\u9996\n"), '');
  assert.equal(versionOf("\u672c\u6b21\u53d1\u5e03\u7248\u672c 0.20.0-beta.9 \u5df2\u4e0a\u7ebf\n"), '');
  assert.equal(versionOf(''), '');
});

test("VERSION_TOKEN can be reused for writes, consuming prerelease/build metadata", () => {


  const re = new RegExp(String.raw`^(\s*)version:\s*${VERSION_TOKEN}`, 'm');
  const m = '  version: 0.20.0-beta.2'.match(re);
  assert.ok(m, "VERSION_TOKEN must match prerelease version lines");
  assert.equal(m[0], '  version: 0.20.0-beta.2', "Replace the entire matched line including old prerelease metadata");
});
