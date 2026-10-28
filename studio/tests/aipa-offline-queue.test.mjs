// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Offline questions enter a listable queue", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-'));
  const message = execFileSync('node',['product/core-space/scripts/aipa-offline-queue.mjs','add','--root',root,'--text',"RTOS \u6d88\u606f\u961f\u5217"]);
  assert.match(message.toString(), /will not execute automatically/);
  const out=execFileSync('node',['product/core-space/scripts/aipa-offline-queue.mjs','list','--root',root]);
  assert.match(out.toString(),/RTOS \u6d88\u606f\u961f\u5217/);
});
