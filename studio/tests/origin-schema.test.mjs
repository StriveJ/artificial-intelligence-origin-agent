// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

test("Manifest version agrees with VERSION and the assistant prefix", () => {
  const text = readFileSync('product/ORIGIN-MANIFEST.yaml', 'utf8');
  const version = readFileSync('product/VERSION', 'utf8').trim();
  assert.equal(text.match(/^  version:[ \t]*([^\r\n]+)/m)?.[1], version);
  const core = version.split('-')[0].split('.').slice(0, 2).join('.');
  assert.equal(text.match(/^  assist_prefix:[ \t]*([^\r\n]+)/m)?.[1], `"AIPA ${core} collaborates with you: "`);
});
