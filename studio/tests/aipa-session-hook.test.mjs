// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, existsSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function setupInstance() {
  const root = mkdtempSync(join(tmpdir(), 'aipa-inst-'));
  mkdirSync(join(root, '.claude', 'hooks'), { recursive: true });
  mkdirSync(join(root, 'state'), { recursive: true });
  cpSync('product/.claude/hooks/session-hook.mjs', join(root, '.claude', 'hooks', 'session-hook.mjs'));
  cpSync('product/core-space/scripts', join(root, 'core-space', 'scripts'), { recursive: true });
  return root;
}

test("SessionStart dispatches resume and writes current-sid", () => {
  const root = setupInstance();
  execFileSync('node', [join(root, '.claude', 'hooks', 'session-hook.mjs'), 'SessionStart'], { input: JSON.stringify({ hook_event_name: 'SessionStart' }) });
  assert.ok(existsSync(join(root, 'state', 'current-sid')));
  assert.match(execFileSync('node', ['product/core-space/scripts/aipa-event.mjs', 'list', '--root', root]).toString(), /"type":"session_start"/);
});

test("UserPromptSubmit dispatches user_message", () => {
  const root = setupInstance();
  execFileSync('node', [join(root, '.claude', 'hooks', 'session-hook.mjs'), 'UserPromptSubmit'], { input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: "\u7ee7\u7eed\u4e0a\u6b21\u4efb\u52a1" }) });
  const evs = execFileSync('node', ['product/core-space/scripts/aipa-event.mjs', 'list', '--root', root]).toString();
  assert.match(evs, /"type":"user_message"/);
  assert.match(evs, /\u7ee7\u7eed\u4e0a\u6b21\u4efb\u52a1/);
});

test("Missing script directories exit harmlessly with code 0", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-inst-'));
  mkdirSync(join(root, '.claude', 'hooks'), { recursive: true });
  cpSync('product/.claude/hooks/session-hook.mjs', join(root, '.claude', 'hooks', 'session-hook.mjs'));
  execFileSync('node', [join(root, '.claude', 'hooks', 'session-hook.mjs'), 'Stop'], { input: JSON.stringify({ hook_event_name: 'Stop' }) });
});

test("Oversized PostToolUse results use stdin and truncate without crashing", () => {
  const root = setupInstance();
  const big = JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Read', tool_response: 'x'.repeat(50000) });
  execFileSync('node', [join(root, '.claude', 'hooks', 'session-hook.mjs'), 'PostToolUse'], { input: big });
  const line = execFileSync('node', ['product/core-space/scripts/aipa-event.mjs', 'list', '--root', root]).toString().trim();
  const e = JSON.parse(line);
  assert.equal(e.type, 'tool_result');
  assert.match(e.data, /Read/);
  assert.ok(e.data.length < 2100);
});

test("Stop only flushes automatic candidates; SessionEnd ends the host session", () => {
  const root = setupInstance();
  execFileSync('node', ['product/core-space/scripts/aipa-distill.mjs', 'add', '--root', root, '--type', 'preference', '--text', "\u504f\u597d printf"]);
  execFileSync('node', [join(root, '.claude', 'hooks', 'session-hook.mjs'), 'Stop'], { input: JSON.stringify({ hook_event_name: 'Stop' }) });
  assert.doesNotMatch(execFileSync('node', ['product/core-space/scripts/aipa-event.mjs', 'list', '--root', root]).toString(), /"type":"session_end"/);
  execFileSync('node', [join(root, '.claude', 'hooks', 'session-hook.mjs'), 'SessionEnd'], {input:JSON.stringify({hook_event_name:'SessionEnd',reason:'other'})});
  assert.match(execFileSync('node', ['product/core-space/scripts/aipa-event.mjs', 'list', '--root', root]).toString(), /"type":"session_end"/);
  assert.match(readFileSync(join(root, 'user-space', 'memory', 'preferences.md'), 'utf8'), /\u504f\u597d printf/);
});

test("Host compaction preserves SID, hook ownership prevents duplicate protocol writes, and equal real inputs are retained",()=>{
 const root=setupInstance(),hook=(name,extra={})=>execFileSync(process.execPath,[join(root,'.claude','hooks','session-hook.mjs'),name],{input:JSON.stringify({hook_event_name:name,session_id:'host-1',...extra})});
 hook('SessionStart',{source:'startup'});const sid=readFileSync(join(root,'state','current-sid'),'utf8').trim();
 hook('SessionStart',{source:'compact'});assert.equal(readFileSync(join(root,'state','current-sid'),'utf8').trim(),sid);
 hook('UserPromptSubmit',{prompt:"\u7ee7\u7eed"});hook('UserPromptSubmit',{prompt:"\u7ee7\u7eed"});
 const out=execFileSync(process.execPath,['product/core-space/scripts/aipa-event.mjs','add','--root',root,'--type','user_message','--sid',sid,'--data',"\u7ee7\u7eed"],{encoding:'utf8'});assert.match(out,/owned-by-hook/);
 const lines=execFileSync(process.execPath,['product/core-space/scripts/aipa-event.mjs','list','--root',root],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
 assert.equal(lines.filter(e=>e.type==='user_message').length,2);assert.equal(lines.filter(e=>e.type==='session_start').length,1);
});
