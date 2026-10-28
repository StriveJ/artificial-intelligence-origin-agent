import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test("Sleep creates a marker and wake removes it",()=>{const root=mkdtempSync(join(tmpdir(),'aipa-'));execFileSync('node',['product/core-space/scripts/aipa-sleep.mjs','sleep','--root',root]);assert.ok(existsSync(join(root,'state','sleep-mode.md')));execFileSync('node',['product/core-space/scripts/aipa-sleep.mjs','wake','--root',root]);assert.ok(!existsSync(join(root,'state','sleep-mode.md')));});
