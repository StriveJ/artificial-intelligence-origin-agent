// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

test("Confirmation under a held lock writes no memory; retrying persisted entries does not append duplicates", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-confirm-lock-'));
  run(root,'add',['--type','method','--text',"\u786e\u8ba4\u9501\u4fdd\u62a4\u7684\u5408\u6210\u65b9\u6cd5"]);
  const queue=join(root,'state','distill.json'),before=readFileSync(queue,'utf8'),lock=queue+'.lock';
  writeFileSync(lock,JSON.stringify({pid:123,owner:'other',created:new Date().toISOString()}));
  assert.throws(()=>run(root,'confirm',['--auto']));
  assert.equal(existsSync(join(root,'user-space','memory','patterns.md')),false);
  assert.equal(readFileSync(queue,'utf8'),before);
  rmSync(lock);const file=join(root,'user-space','memory','patterns.md');mkdirSync(join(root,'user-space','memory'),{recursive:true});
  const landed="- [method] \u786e\u8ba4\u9501\u4fdd\u62a4\u7684\u5408\u6210\u65b9\u6cd5\n";writeFileSync(file,landed);
  run(root,'confirm',['--auto']);assert.equal(readFileSync(file,'utf8'),landed);
  assert.equal(JSON.parse(readFileSync(queue,'utf8')).entries.length,0);
});

test("Corrupted or invalid queues reject appends and preserve original bytes", () => {
  for (const content of ['{broken', '{"entries":null}', '{"entries":[null]}']) {
    const root = mkdtempSync(join(tmpdir(), 'aipa-bad-queue-'));
    mkdirSync(join(root, 'state'));
    const queue = join(root, 'state', 'distill.json'); writeFileSync(queue, content);
    assert.throws(() => run(root, 'add', ['--type', 'method', '--text', "\u65b0\u65b9\u6cd5"]));
    assert.equal(readFileSync(queue, 'utf8'), content);
  }
});

test("Successful concurrent appends match retained entries and failures are explicit", async () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-concurrent-queue-'));
  const commands = Array.from({ length: 8 }, (_, i) => ['product/core-space/scripts/aipa-distill.mjs', 'add', '--root', root, '--type', 'method', '--text', `\u5e76\u53d1\u65b9\u6cd5 ${i}`]);
  const results = await Promise.all(commands.map(args => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args); let stderr = '';
    child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject); child.on('close', code => resolve({ code, stderr }));
  })));
  const data = JSON.parse(readFileSync(join(root, 'state', 'distill.json')));
  assert.equal(data.entries.length, results.filter(r => r.code === 0).length);
  assert.equal(new Set(data.entries.map(e => e.id)).size, data.entries.length);
  assert.ok(results.every(r => r.code === 0 || /Queue|lock|concurrent/.test(r.stderr)), JSON.stringify(results));
});

function run(root, cmd, args = []) {
  return execFileSync('node', ['product/core-space/scripts/aipa-distill.mjs', cmd, '--root', root, ...args], { encoding: 'utf8' }).trim();
}

test("Adding seven candidate types assigns their tiers", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  const d1 = run(root, 'add', ['--type', 'decision', '--text', "\u9009 RTOS A \u800c\u975e B"]);
  assert.match(d1, /^distill-/);
  run(root, 'add', ['--type', 'skill', '--text', "## \u89e6\u53d1\u53e3\u4ee4\nGPIO", '--name', 'gpio-debug', '--scope', 'work', '--desc', "\u6392\u67e5 GPIO"]);
  run(root, 'add', ['--type', 'preference', '--text', "\u504f\u597d printf"]);
  const data = JSON.parse(readFileSync(join(root, 'state', 'distill.json'), 'utf8'));
  assert.equal(data.entries.length, 3);
  assert.equal(data.entries[0].tier, 'confirm');
  assert.equal(data.entries[1].tier, 'confirm');
  assert.equal(data.entries[1].scope, 'work');
  assert.equal(data.entries[2].tier, 'auto');
});

test("Candidate additions deduplicate text", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  run(root, 'add', ['--type', 'method', '--text', "\u5148\u5199\u6d4b\u8bd5\u518d\u6539"]);
  const dup = run(root, 'add', ['--type', 'method', '--text', "\u5148\u5199\u6d4b\u8bd5\u518d\u6539"]);
  assert.equal(dup, 'duplicate');
});

test("Invalid types and missing skill arguments fail", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  assert.throws(() => run(root, 'add', ['--type', 'nope', '--text', 'x']));
  assert.throws(() => run(root, 'add', ['--type', 'skill', '--text', 'x', '--name', 'n']));
});

test("Candidate lists include id, tier, type, and text", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  const id = run(root, 'add', ['--type', 'preference', '--text', "\u504f\u597d printf"]);
  const out = run(root, 'list');
  assert.match(out, new RegExp(id));
  assert.match(out, /\[auto\]/);
  assert.match(out, /preference/);
  assert.match(out, /\u504f\u597d printf/);
});

test("Confirming a decision writes decisions.md and removes the candidate", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  const id = run(root, 'add', ['--type', 'decision', '--text', "\u9009 RTOS A"]);
  run(root, 'confirm', ['--id', id]);
  assert.match(readFileSync(join(root, 'user-space', 'memory', 'decisions.md'), 'utf8'), /\u9009 RTOS A/);
  const data = JSON.parse(readFileSync(join(root, 'state', 'distill.json'), 'utf8'));
  assert.equal(data.entries.length, 0);
});

test("Confirming a skill creates SKILL.md", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  const id = run(root, 'add', ['--type', 'skill', '--text', "## \u52a8\u4f5c\u94fe\n1. \u6392\u67e5", '--name', 'gpio-debug', '--scope', 'work', '--desc', "\u6392\u67e5 GPIO"]);
  run(root, 'confirm', ['--id', id]);
  const f = join(root, 'user-space', 'skills', 'work', 'gpio-debug', 'SKILL.md');
  const body = readFileSync(f, 'utf8');
  assert.match(body, /name: gpio-debug/);
  assert.match(body, /scope: work/);
  assert.match(body, /^version: 1\.0\.0$/m);
  // Confirming user-supplied content preserves its original language and headings.
  assert.match(body, /## \u52a8\u4f5c\u94fe/);
});

test("Automatic confirmation writes only the auto tier and preserves the confirmation tier", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  run(root, 'add', ['--type', 'preference', '--text', "\u504f\u597d printf"]);
  run(root, 'add', ['--type', 'method', '--text', "\u5148\u5199\u6d4b\u8bd5"]);
  run(root, 'add', ['--type', 'decision', '--text', "\u9009 RTOS A"]);
  const out = run(root, 'confirm', ['--auto']);
  assert.match(out, /auto-confirmed 2/);
  assert.match(readFileSync(join(root, 'user-space', 'memory', 'preferences.md'), 'utf8'), /\u504f\u597d printf/);
  assert.match(readFileSync(join(root, 'user-space', 'memory', 'patterns.md'), 'utf8'), /\[method\] \u5148\u5199\u6d4b\u8bd5/);
  const data = JSON.parse(readFileSync(join(root, 'state', 'distill.json'), 'utf8'));
  assert.equal(data.entries.length, 1);
  assert.equal(data.entries[0].type, 'decision');
});

test("Automatic confirmation without auto-tier entries reports nothing-to-auto", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  run(root, 'add', ['--type', 'decision', '--text', "\u9009 RTOS A"]);
  const out = run(root, 'confirm', ['--auto']);
  assert.match(out, /nothing-to-auto/);
});

test("Discard removes a candidate", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  const id = run(root, 'add', ['--type', 'decision', '--text', "\u9009 RTOS A"]);
  assert.equal(run(root, 'discard', ['--id', id]), 'discarded');
  const data = JSON.parse(readFileSync(join(root, 'state', 'distill.json'), 'utf8'));
  assert.equal(data.entries.length, 0);
});

test("Confirming a nonexistent ID fails", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  assert.throws(() => run(root, 'confirm', ['--id', 'distill-9999']));
});

test("Mixed candidate additions finish through auto/manual confirmation with correct files and an empty queue", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  const decisionId = run(root, 'add', ['--type', 'decision', '--text', "\u9009 RTOS A"]);
  run(root, 'add', ['--type', 'preference', '--text', "\u504f\u597d printf"]);
  run(root, 'add', ['--type', 'term', '--text', 'DMA']);
  run(root, 'confirm', ['--auto']);
  run(root, 'confirm', ['--id', decisionId]);
  assert.match(readFileSync(join(root, 'user-space', 'memory', 'preferences.md'), 'utf8'), /\u504f\u597d printf/);
  assert.match(readFileSync(join(root, 'user-space', 'memory', 'terms.md'), 'utf8'), /DMA/);
  assert.match(readFileSync(join(root, 'user-space', 'memory', 'decisions.md'), 'utf8'), /\u9009 RTOS A/);
  const data = JSON.parse(readFileSync(join(root, 'state', 'distill.json'), 'utf8'));
  assert.equal(data.entries.length, 0);
});

test("Adding after discard does not reuse deleted or existing IDs", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  const id1 = run(root, 'add', ['--type', 'decision', '--text', "\u9009 RTOS A"]);
  const id2 = run(root, 'add', ['--type', 'decision', '--text', "\u9009 RTOS B"]);
  run(root, 'discard', ['--id', id1]);
  const id3 = run(root, 'add', ['--type', 'decision', '--text', "\u9009 RTOS C"]);
  assert.notEqual(id3, id1);
  assert.notEqual(id3, id2);
});

test("Invalid skill scopes or names fail", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  assert.throws(() => run(root, 'add', ['--type', 'skill', '--text', 'x', '--name', 'n', '--scope', 'evil', '--desc', 'd']));
  assert.throws(() => run(root, 'add', ['--type', 'skill', '--text', 'x', '--name', '../x', '--scope', 'work', '--desc', 'd']));
});
