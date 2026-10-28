// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHANNELS, branchOfChannel, isChannel, channelOfOriginBranch } from '../../../../../product/core-space/scripts/lib/release-channel.mjs';


//






test("stable maps to master and beta to beta; explicitly assert remote branch conventions", () => {
  assert.equal(branchOfChannel('stable'), 'master');
  assert.equal(branchOfChannel('beta'), 'beta');
});

test("Unknown/empty channels fall back to stable for legacy instances/artifacts without channel fields", () => {


  assert.equal(branchOfChannel(''), 'master');
  assert.equal(branchOfChannel(undefined), 'master');
  assert.equal(branchOfChannel(null), 'master');
  assert.equal(branchOfChannel('canary'), 'master', "Invalid values must not map to beta");
  assert.equal(branchOfChannel(' beta '), 'beta', "Tolerate surrounding whitespace common in manifest reads");
});

test("Only stable and beta are valid channels", () => {
  assert.deepEqual(CHANNELS, ['stable', 'beta']);
  assert.equal(isChannel('stable'), true);
  assert.equal(isChannel('beta'), true);
  assert.equal(isChannel('canary'), false);
  assert.equal(isChannel(''), false);
});

test("Every valid channel has a unique mapped branch", () => {
  const branches = CHANNELS.map(branchOfChannel);
  assert.equal(branches.length, new Set(branches).size, "The release lines must use distinct branches");
  for (const ch of CHANNELS) assert.match(branchOfChannel(ch), /^\S+$/, "Branch names must not be empty");
});



test("Origin source branches: dev selects beta and master selects stable", () => {
  assert.equal(channelOfOriginBranch('dev'), 'beta');
  assert.equal(channelOfOriginBranch('master'), 'stable');
});



test("Unknown Origin branches return empty without fallback", () => {
  assert.equal(channelOfOriginBranch('feature/zone-guardrails'), '');
  assert.equal(channelOfOriginBranch(''), '');
  assert.equal(channelOfOriginBranch(undefined), '');
  assert.equal(channelOfOriginBranch('main'), '', "main is not this repository's stable branch");
  assert.equal(channelOfOriginBranch(' beta '), '', "Accept only dev/master, not channel-name aliases");
});




test("Prototype-chain keys are invalid branches and return empty", () => {
  for (const name of ['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty']) {
    const v = channelOfOriginBranch(name);
    assert.strictEqual(v, '', `${name} must return an empty string; actual: ${typeof v}`);
    assert.strictEqual(typeof v, 'string', `${name} must not return a non-string`);
  }
});


test("Composition: source branch -> channel -> artifact branch", () => {
  assert.equal(branchOfChannel(channelOfOriginBranch('dev')), 'beta');
  assert.equal(branchOfChannel(channelOfOriginBranch('master')), 'master');
});
