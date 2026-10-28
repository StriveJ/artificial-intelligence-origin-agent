// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PROJ = 'demo';

function add(root, type, data) {
  execFileSync('node', ['product/core-space/scripts/aipa-event.mjs', 'add', '--root', root, '--project', PROJ, '--type', type, '--data', data]);
}

test("Resume without history does not claim cross-device history", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  const out = execFileSync('node', ['product/core-space/scripts/aipa-session.mjs', 'resume', '--root', root, '--project', PROJ]).toString();
  assert.match(out, /\(no historical sessions for this project\)/);
  assert.doesNotMatch(out, /other device\/history/);
  assert.doesNotMatch(out, /Previous checkpoint/);
  assert.ok(existsSync(join(root, 'state', 'resume-prompt.md')));
  assert.ok(existsSync(join(root, 'state', 'current-sid')));
});

test("Resume combines checkpoints and event tails", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  execFileSync('node', ['product/core-space/scripts/aipa-checkpoint.mjs', '--root', root, '--project', PROJ, '--intent', "\u91cd\u6784 GPIO", '--next', "\u5b8c\u6210\u8349\u7a3f"]);
  add(root, 'tool_call', 'aipa-checkpoint');
  const out = execFileSync('node', ['product/core-space/scripts/aipa-session.mjs', 'resume', '--root', root, '--project', PROJ]).toString();
  assert.match(out, /\u91cd\u6784 GPIO/);
  assert.match(out, /tool_call/);

  assert.match(readFileSync(join(root, 'state', 'session-checkpoint.md'), 'utf8'), /\u5b8c\u6210\u8349\u7a3f/);
});

test("The session status subcommand is retired", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  assert.throws(() => execFileSync('node', ['product/core-space/scripts/aipa-session.mjs', 'status', '--root', root], { stdio: 'pipe' }));
});

test("The same host session retains SID; a new session ID or explicit --new creates one",()=>{
 const root=mkdtempSync(join(tmpdir(),'aipa-'));
 const resume=(args=[])=>execFileSync(process.execPath,['product/core-space/scripts/aipa-session.mjs','resume','--root',root,'--project',PROJ,'--tool','codex',...args]);
 const sid=()=>readFileSync(join(root,'state','current-sid'),'utf8').trim();
 resume(['--host-session-id','host-a']);const first=sid();resume(['--host-session-id','host-a']);assert.equal(sid(),first);
 resume(['--host-session-id','host-b']);assert.notEqual(sid(),first);
 resume(['--host-session-id','host-a']);assert.equal(sid(),first);
 resume();assert.equal(sid(),first);resume(['--new']);assert.notEqual(sid(),first);
});

test("Interleaved hosts keep their own SIDs; resume/due use explicit identity rather than another host's current ID",()=>{
 const root=mkdtempSync(join(tmpdir(),'aipa-multi-host-'));
 const resume=(tool,host,extra=[])=>JSON.parse(execFileSync(process.execPath,['product/core-space/scripts/aipa-session.mjs','resume','--root',root,'--project','shared','--tool',tool,'--host-session-id',host,'--json',...extra],{encoding:'utf8',stdio:'pipe'}));
 const a=resume('codex','host-a'),b=resume('claude-code','host-b');assert.notEqual(a.sid,b.sid);
 execFileSync(process.execPath,['product/core-space/scripts/aipa-event.mjs','add','--root',root,'--type','user_message','--project','shared','--sid',a.sid,'--data',"A \u7684\u8f93\u5165"]);
 execFileSync(process.execPath,['product/core-space/scripts/aipa-checkpoint.mjs','set','--root',root,'--project','shared','--sid',a.sid,'--intent',"A \u7684\u8fdb\u5ea6",'--next',"A \u4e0b\u4e00\u6b65"]);
 execFileSync(process.execPath,['product/core-space/scripts/aipa-checkpoint.mjs','set','--root',root,'--project','shared','--sid',b.sid,'--intent',"B \u7684\u8fdb\u5ea6"]);
 const again=resume('codex','host-a');assert.equal(again.sid,a.sid);assert.match(again.prompt,/A \u7684\u8fdb\u5ea6/);assert.doesNotMatch(again.prompt,/B \u7684\u8fdb\u5ea6/);
 const checkpoint=execFileSync(process.execPath,['product/core-space/scripts/aipa-checkpoint.mjs','get','--root',root,'--sid',a.sid],{encoding:'utf8'});assert.match(checkpoint,/A \u4e0b\u4e00\u6b65/);assert.doesNotMatch(checkpoint,/B \u7684\u8fdb\u5ea6/);
});
