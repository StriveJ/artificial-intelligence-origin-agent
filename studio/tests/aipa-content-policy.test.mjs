// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function setup(files) {
  const root = mkdtempSync(join(tmpdir(), 'aipa-cp-'));
  mkdirSync(join(root, 'product'), { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(root, 'product', name), content);
  }
  return root;
}

test("Content policy blocks hardcoded secrets", () => {
  const root = setup({ 'config.js': 'api_key = "sk-abcdef1234567890"\n' });
  assert.throws(() => execFileSync('node', ['studio/scripts/aipa-content-policy.mjs', '--root', root], { stdio: 'ignore' }));
});

test("Content policy blocks private keys", () => {
  const root = setup({ 'key.pem': '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n' });
  assert.throws(() => execFileSync('node', ['studio/scripts/aipa-content-policy.mjs', '--root', root], { stdio: 'ignore' }));
});

test("Content policy blocks eval", () => {
  const root = setup({ 'bad.mjs': 'eval("console.log(1)");\n' });
  assert.throws(() => execFileSync('node', ['studio/scripts/aipa-content-policy.mjs', '--root', root], { stdio: 'ignore' }));
});

test("Content policy accepts clean directories", () => {
  const root = setup({ 'ok.mjs': 'console.log("hello");\n', 'README.md': "# \u8bf4\u660e\n" });
  execFileSync('node', ['studio/scripts/aipa-content-policy.mjs', '--root', root]);
});

test("Content policy blocks exported JS constants and quoted JSON credential keys", () => {
  for (const text of ['export const API_KEY = "sk-abcdef1234567890";', '{"api_key": "sk-abcdef1234567890"}', 'const accessToken = "abcdefghijk123456";']) {
    const root = setup({ 'config.mjs': text });
    assert.throws(() => execFileSync(process.execPath, ['studio/scripts/aipa-content-policy.mjs', '--root', root], { stdio: 'ignore' }));
  }
});

test("Content policy permits explicit placeholders and environment references", () => {
  const root = setup({ 'example.mjs': 'export const API_KEY = "YOUR_API_KEY";\nconst password = process.env.PASSWORD;\n' });
  execFileSync(process.execPath, ['studio/scripts/aipa-content-policy.mjs', '--root', root]);
});
