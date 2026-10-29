import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTapFailures, formatGitHubErrorAnnotation } from '../scripts/lib/tap-failures.mjs';

const failure = (number, name = 'synthetic failure') => [
  'not ok ' + number + ' - ' + name,
  '  ---',
  '  duration_ms: 1',
  '  location: synthetic.test.mjs:12:3',
  '  failureType: testCodeFailure',
  '  error: expected synthetic value to match',
  '  code: ERR_ASSERTION',
  '  stack: |-',
  '    TestContext.<anonymous> (synthetic.test.mjs:17:5)',
  '  ...',
].join('\n');

test('TAP diagnostics expose the first failure, location, error, and stack even when the tail contains only totals', () => {
  const log = ['TAP version 13', '# Subtest: synthetic failure', failure(1),
    ...Array.from({ length: 80 }, (_, index) => 'ok ' + (index + 2) + ' - synthetic success'),
    '1..81', '# tests 81', '# pass 80', '# fail 1'].join('\r\n');
  assert.doesNotMatch(log.split(/\r?\n/).slice(-35).join('\n'), /not ok/);
  const output = formatTapFailures(log);
  assert.match(output, /not ok 1 - synthetic failure/);
  assert.match(output, /location: synthetic\.test\.mjs:12:3/);
  assert.match(output, /error: expected synthetic value to match/);
  assert.match(output, /TestContext\.<anonymous> \(synthetic\.test\.mjs:17:5\)/);
  assert.match(output, /full log line 3/);
  assert.match(output, /original log tail follows/);
});

test('TAP diagnostics cap the first failures and disclose omitted entries and configured limits', () => {
  const log = Array.from({ length: 5 }, (_, index) => failure(index + 1, 'case-' + (index + 1))).join('\n');
  const output = formatTapFailures(log, { maxFailures: 2, maxLinesPerFailure: 20, maxChars: 4000 });
  assert.match(output, /showing 2 of 5/);
  assert.match(output, /limits: 2 failures, 20 source lines each, 4000 characters/);
  assert.match(output, /not ok 1 - case-1/);
  assert.match(output, /not ok 2 - case-2/);
  assert.doesNotMatch(output, /not ok 3 -/);
  assert.match(output, /3 additional failing TAP entries omitted/);
});

test('Long TAP YAML keeps initial error context and the stack after oversized expected and actual values', () => {
  const log = ['not ok 1 - large synthetic assertion', '  ---',
    '  location: large.test.mjs:2:1', '  error: synthetic mismatch', '  expected: |-',
    ...Array.from({ length: 120 }, (_, index) => '    synthetic value ' + index),
    '  actual: null', '  stack: |-', '    TestContext.<anonymous> (large.test.mjs:9:3)', '  ...'].join('\n');
  const output = formatTapFailures(log, { maxLinesPerFailure: 12 });
  assert.match(output, /error: synthetic mismatch/);
  assert.match(output, /stack: \|-/);
  assert.match(output, /large\.test\.mjs:9:3/);
  assert.match(output, /TAP context lines omitted/);
  assert.doesNotMatch(output, /synthetic value 119/);
});

test('Nested failures retain their own YAML context and do not consume the next sibling result', () => {
  const log = ['    ' + failure(1, 'nested synthetic').replaceAll('\n', '\n    '),
    '    ok 2 - next sibling', 'not ok 1 - parent suite', '  ---', '  error: subtest failed', '  ...'].join('\n');
  const output = formatTapFailures(log, { maxFailures: 1 });
  assert.match(output, /not ok 1 - nested synthetic/);
  assert.match(output, /stack: \|-/);
  assert.doesNotMatch(output, /next sibling|error: subtest failed/);
  assert.match(output, /1 additional failing TAP entries omitted/);
});

test('The character budget includes an explicit truncation notice', () => {
  const log = 'not ok 1 - oversized synthetic failure\n  ---\n  error: ' + 'X'.repeat(4000) + '\n  ...';
  const output = formatTapFailures(log, { maxChars: 400 });
  assert.ok(output.length <= 400);
  assert.match(output, /not ok 1 - oversized synthetic failure/);
  assert.match(output, /truncated at 400 characters/);
});

test('Non-TAP output, success-only TAP, and TODO or SKIP entries return no excerpt for tail-only fallback', () => {
  for (const log of ['', 'synthetic command failed', 'TAP version 13\nok 1 - success\n# fail 0',
    '# not ok is only a comment', 'not ok 1 - pending # TODO later', 'not ok 1 - ignored # SKIP reason']) {
    assert.equal(formatTapFailures(log), '');
  }
});

test('Invalid diagnostic limits are rejected independently of TAP content', () => {
  for (const options of [{ maxFailures: 0 }, { maxLinesPerFailure: -1 }, { maxChars: Infinity }, { maxFailures: 1.5 }]) {
    assert.throws(() => formatTapFailures(failure(1), options), /positive safe integer/);
  }
});

test('TAP-looking text inside YAML error literals does not consume the failure limit', () => {
  const log = ['not ok 1 - actual failure', '  ---', '  error: |-', '    not ok 9 - quoted command output', '  ...', failure(2, 'second actual failure')].join('\n');
  const output = formatTapFailures(log, { maxFailures: 2 });
  assert.match(output, /showing 2 of 2/);
  assert.match(output, /not ok 2 - second actual failure/);
  const minimal = formatTapFailures(failure(1), { maxLinesPerFailure: 1 });
  assert.match(minimal, /not ok 1 - synthetic failure/);
  assert.match(minimal, /TAP context lines omitted/);
});

test('GitHub error annotations are emitted only for the exact Actions environment flag', () => {
  assert.equal(formatGitHubErrorAnnotation('synthetic failure', 'true'), '::error title=AIPA quality gate::synthetic failure');
  for (const flag of [undefined, '', 'false', 'TRUE', '1', true, false]) {
    assert.equal(formatGitHubErrorAnnotation('synthetic failure', flag), '');
  }
});

test('GitHub annotations escape percent, CR and LF in order and cannot inject another workflow command', () => {
  const input = '100% mismatch %0A\r\n::warning title=Injected::untrusted\n::add-mask::SYNTHETIC';
  const output = formatGitHubErrorAnnotation(input, 'true');
  assert.equal(output, '::error title=AIPA quality gate::100%25 mismatch %250A%0D%0A::warning title=Injected::untrusted%0A::add-mask::SYNTHETIC');
  assert.equal(output.split(/\r|\n/).length, 1);
  const header = output.slice(0, output.indexOf('::', 2));
  assert.equal(header, '::error title=AIPA quality gate');
});

test('Single-line annotation data stays data and never becomes an untrusted command attribute', () => {
  const input = 'synthetic error, file=untrusted.mjs,line=999::extra';
  assert.equal(formatGitHubErrorAnnotation(input, 'true'), '::error title=AIPA quality gate::' + input);
});

test('Empty extracted details use a fixed GitHub annotation fallback while local output stays empty', () => {
  const fallback = '::error title=AIPA quality gate::AIPA quality gate failed; inspect the complete log and original log tail.';
  for (const input of ['', null, undefined, ' \r\n\t']) {
    assert.equal(formatGitHubErrorAnnotation(input, 'true'), fallback);
    assert.equal(formatGitHubErrorAnnotation(input), '');
  }
  assert.equal(formatGitHubErrorAnnotation(formatTapFailures('synthetic non-TAP command failure'), 'true'), fallback);
});
