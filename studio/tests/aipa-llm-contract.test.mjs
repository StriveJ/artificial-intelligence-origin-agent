// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const script = resolve('product/core-space/scripts/aipa-llm.mjs');
function run(root, command) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, command, '--root', root, '--input', "\u5408\u6210\u6750\u6599", '--json']);
    let stdout = '', stderr = ''; child.stdout.on('data', x => stdout += x); child.stderr.on('data', x => stderr += x);
    child.on('error', reject); child.on('close', code => resolve({ code, stdout, stderr, result: JSON.parse(stdout) }));
  });
}
test("External expansion succeeds explicitly or returns pending-host on invalid responses/timeouts instead of pretending an empty result", async () => {
  for (const kind of ['valid', 'invalid', 'missing', 'timeout']) {
    const server = createServer((req, res) => {
      req.resume();
      if (kind === 'timeout') return;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(kind === 'missing' ? {} : { choices: [{ message: { content: kind === 'valid' ? "[\"\u540c\u4e49\u8bcd\"]" : 'not JSON' } }] }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const root = mkdtempSync(join(tmpdir(), 'aipa-llm-contract-')); mkdirSync(join(root, 'user-space'));
    writeFileSync(join(root, 'user-space', 'llm-provider.yaml'), `provider: external\nexternal:\n  endpoint: http://127.0.0.1:${server.address().port}/chat\n  timeout_ms: 500\n`);
    try {
      const output = await run(root, 'expand');
      assert.equal(output.code, 0);
      assert.equal(output.result.status, kind === 'valid' ? 'completed' : 'pending_host');
      if (kind === 'valid') assert.equal(output.result.content[0], "\u540c\u4e49\u8bcd");
      else { assert.equal(output.result.content, undefined); assert.ok(output.result.reason); }
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  }
});
test("Host JSON returns pending_host with a prompt instead of claiming a summary", async () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-llm-host-contract-'));
  const output = await run(root, 'summarize');
  assert.equal(output.result.status, 'pending_host'); assert.equal(output.result.content, undefined); assert.ok(output.result.prompt);
});
