import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pickCmd, pickPositional } from '../../../../../product/core-space/scripts/lib/argv.mjs';

const KNOWN = ['status', 'scan', 'add'];

test("pickCmd recognizes subcommands before or after flags", () => {
  assert.equal(pickCmd(['status', '--root', '.'], KNOWN), 'status');
  assert.equal(pickCmd(['--root', '.', 'status'], KNOWN), 'status', "Leading --root must still be recognized");
  assert.equal(pickCmd(['--root', '.', 'scan', '--project', 'x'], KNOWN), 'scan');
  assert.equal(pickCmd(['--json', 'status'], KNOWN), 'status', "A leading boolean flag must still allow fallback recognition");
});

test("pickCmd does not mistake a flag value matching a subcommand for the command", () => {

  assert.equal(pickCmd(['--data', 'add', 'scan'], KNOWN), 'scan');
  assert.equal(pickCmd(['--summary', 'status'], KNOWN), 'status', "Without another candidate, use the fallback (known limitation)");
});

test("pickCmd returns an empty string without a known command; caller selects default/error", () => {
  assert.equal(pickCmd([], KNOWN), '');
  assert.equal(pickCmd(['--root', '.'], KNOWN), '');
  assert.equal(pickCmd(['unknown-cmd'], KNOWN), '');
});

test("pickPositional selects the first positional value, skipping flags and their values", () => {
  assert.equal(pickPositional(['confirm', 'c-0001', '--root', '.'], { skipFirst: 'confirm' }), 'c-0001');
  assert.equal(pickPositional(['--root', '.', 'confirm', 'c-0002'], { skipFirst: 'confirm' }), 'c-0002', "Order independent");
  assert.equal(pickPositional(['confirm', '--root', '.'], { skipFirst: 'confirm' }), '');
});
