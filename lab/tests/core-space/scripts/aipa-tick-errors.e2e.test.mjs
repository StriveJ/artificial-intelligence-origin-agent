// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';

const TICK = join(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts'), 'aipa-tick.mjs');


test("Invalid plugin output structure is recorded in state/errors.log", () => {
  const root = makeTestDir('aipa-tick-err-');
  try {
    mkdirSync(join(root, 'user-space', 'tasks'), { recursive: true });
    writeFileSync(join(root, 'user-space', 'tasks', 'bad.mjs'), 'console.log(JSON.stringify({status:"broken"}));\n', 'utf8');

    execFileSync(process.execPath, [TICK, '--root', root, '--device', 'testbox', '--reason', 'session'], { encoding: 'utf8' });

    const errFile = join(root, 'state', 'errors.log');
    assert.equal(existsSync(errFile), true, "Produce the shared error log");
    const lines = readFileSync(errFile, 'utf8').trim().split(/\r?\n/).map((l) => JSON.parse(l));
    assert.equal(lines.length, 1);
    assert.equal(lines[0].scope, 'tick:bad');
    assert.match(lines[0].message, /bad plugin output/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Invalid plugin JSON is also recorded in state/errors.log", () => {
  const root = makeTestDir('aipa-tick-err2-');
  try {
    mkdirSync(join(root, 'user-space', 'tasks'), { recursive: true });
    writeFileSync(join(root, 'user-space', 'tasks', 'garbage.mjs'), "console.log(\"\u8fd9\u4e0d\u662f JSON\");\n", 'utf8');

    execFileSync(process.execPath, [TICK, '--root', root, '--device', 'testbox', '--reason', 'session'], { encoding: 'utf8' });

    const lines = readFileSync(join(root, 'state', 'errors.log'), 'utf8').trim().split(/\r?\n/).map((l) => JSON.parse(l));
    assert.equal(lines.length, 1);
    assert.equal(lines[0].scope, 'tick:garbage');
    assert.match(lines[0].message, /JSON/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("No plugin failure means no error log", () => {
  const root = makeTestDir('aipa-tick-ok-');
  try {
    mkdirSync(join(root, 'user-space', 'tasks'), { recursive: true });
    execFileSync(process.execPath, [TICK, '--root', root, '--device', 'testbox', '--reason', 'session'], { encoding: 'utf8' });
    assert.equal(existsSync(join(root, 'state', 'errors.log')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Concurrent ticks admit one plugin process; others preserve lock ownership and each releases its own lock", async () => {
  const root = makeTestDir('aipa-tick-lock-'); mkdirSync(join(root, 'user-space', 'tasks'), { recursive: true });
  writeFileSync(join(root, 'user-space', 'tasks', 'slow.mjs'), `import {appendFileSync} from 'node:fs';appendFileSync(${JSON.stringify(join(root,'calls.txt'))},'called\\n');setTimeout(()=>console.log(JSON.stringify({status:'ok',actions:[]})),1000);`);
  const run = () => new Promise((resolve, reject) => { const child=spawn(process.execPath,[TICK,'--root',root,'--device','test','--reason','session']); let out='';child.stdout.on('data',x=>out+=x);child.on('error',reject);child.on('close',code=>resolve({code,out})); });
  const first = run();
  const deadline = Date.now() + 5000;
  while (!existsSync(join(root, 'state', 'tick.lock'))) { if(Date.now()>deadline) throw new Error("\u672a\u53d6\u5f97\u9501"); await new Promise(resolve=>setTimeout(resolve,20)); }
  const owner = readFileSync(join(root, 'state', 'tick.lock'), 'utf8');
  const second = await run(); assert.equal(second.code,0); assert.match(second.out,/locked/);
  assert.equal(readFileSync(join(root, 'state', 'tick.lock'), 'utf8'), owner);
  const result = await first; assert.equal(result.code,0); assert.match(result.out,/"status": "ok"/);
  assert.equal(readFileSync(join(root,'calls.txt'),'utf8').trim().split(/\r?\n/).length,1);
  assert.equal(existsSync(join(root,'state','tick.lock')),false);
});
