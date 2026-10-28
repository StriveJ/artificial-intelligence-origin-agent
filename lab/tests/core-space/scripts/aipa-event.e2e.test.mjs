// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';

const SCRIPT = join(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts'), 'aipa-event.mjs');

function makeRoot() {
  return makeTestDir('aipa-event-');
}

function run(root, argv, extra = {}) {
  return execFileSync(process.execPath, [SCRIPT, ...argv, '--root', root], { encoding: 'utf8', ...extra });
}

function eventsOf(root) {
  const dir = join(root, 'state', 'events');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir)) {
    for (const line of readFileSync(join(dir, f), 'utf8').split(/\r?\n/).filter(Boolean)) {
      out.push(JSON.parse(line));
    }
  }
  return out;
}

test("--data persists event content", () => {
  const root = makeRoot();
  try {
    run(root, ['add', '--project', 'demo', '--type', 'user_message', '--data', "\u7528 data \u4f20"]);
    const events = eventsOf(root);
    assert.equal(events.length, 1);
    assert.equal(events[0].data, "\u7528 data \u4f20");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("--text also persists event content consistently with repository conventions", () => {
  const root = makeRoot();
  try {
    run(root, ['add', '--project', 'demo', '--type', 'user_message', '--text', "\u7528 text \u4f20"]);
    const events = eventsOf(root);
    assert.equal(events.length, 1);
    assert.equal(events[0].data, "\u7528 text \u4f20", "Do not silently ignore --text");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("--data takes precedence when both content arguments are supplied", () => {
  const root = makeRoot();
  try {
    run(root, ['add', '--project', 'demo', '--type', 'user_message', '--data', "data \u4f18\u5148", '--text', "text \u5ffd\u7565"]);
    const events = eventsOf(root);
    assert.equal(events[0].data, "data \u4f18\u5148");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("An empty user_message warns without failing", () => {
  const root = makeRoot();
  try {
    const r = spawnSync(process.execPath, [SCRIPT, 'add', '--project', 'demo', '--type', 'user_message', '--root', root], { encoding: 'utf8' });
    assert.equal(r.status, 0, "Empty content must not cause a nonzero exit");
    assert.equal(r.stdout.trim().split(/\r?\n/)[0], 'event-added');
    assert.match(r.stderr, /has empty data/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("assistant_message is valid and empty content also warns", () => {
  const root = makeTestDir('aipa-event-');
  try {
    const ok = run(root, ['add', '--project', 'demo', '--type', 'assistant_message', '--data', "【\u7b54】\u7ed3\u8bba\u4e00\u53e5\u8bdd"]);
    assert.equal(ok.trim().split(/\r?\n/)[0], 'event-added');

    const empty = spawnSync(process.execPath, [SCRIPT, 'add', '--project', 'demo', '--type', 'assistant_message', '--root', root], { encoding: 'utf8' });
    assert.equal(empty.status, 0);
    assert.match(empty.stderr, /has empty data/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Two real sends with identical content retain both events", () => {
  const root = makeRoot();
  try {
    run(root, ['add', '--project', 'demo', '--type', 'user_message', '--data', "\u91cd\u590d\u5185\u5bb9"]);
    const second = run(root, ['add', '--project', 'demo', '--type', 'user_message', '--data', "\u91cd\u590d\u5185\u5bb9"]);
    assert.equal(second.trim().split(/\r?\n/)[0], 'event-added');
    assert.equal(eventsOf(root).length, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("A day transition returns newDay without consuming it in event handling", () => {
  const root = makeTestDir('aipa-event-');
  try {
    mkdirSync(join(root, 'state'), { recursive: true });
    writeFileSync(join(root, 'state', 'last-active-day'), '2000-01-01\n', 'utf8');

    const first = run(root, ['add', '--project', 'demo', '--type', 'user_message', '--data', "\u7532"]).trim().split(/\r?\n/);
    assert.equal(first[0], 'event-added');
    const mark = JSON.parse(first[1]);
    assert.equal(mark.newDay.from, '2000-01-01');

    const second = run(root, ['add', '--project', 'demo', '--type', 'checkpoint', '--data', "\u4e59"]).trim().split(/\r?\n/);
    assert.equal(second.length, 2, "The marker must reappear because day-check owns consumption");
    assert.ok(JSON.parse(second[1]).newDay, "The second run still includes newDay");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("Missing --project falls back to the current checkout directory", () => {
  const root = makeRoot();
  try {
    const out = run(root, ['add', '--type', 'user_message', '--data', 'x']);
    assert.equal(out.trim().split(/\r?\n/)[0], 'event-added');
    assert.equal(
      eventsOf(root)[0].project,
      basename(process.cwd()),
      "Without lines.yaml, fall back to the repository directory name",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Retries skip identical event IDs, reject content conflicts, and preserve equal IDs across sessions",()=>{
 const root=makeRoot();try{
 const args=['add','--type','user_message','--data',"\u540c\u4e00\u8f93\u5165",'--sid','s1','--event-id','turn-1','--project','demo'];
 run(root,args);assert.match(run(root,args),/dedup-skipped/);
 assert.throws(()=>run(root,['add','--type','user_message','--data',"\u7be1\u6539",'--sid','s1','--event-id','turn-1','--project','demo']));
 run(root,args.map(x=>x==='s1'?'s2':x));assert.equal(eventsOf(root).length,2);
 }finally{rmSync(root,{recursive:true,force:true});}
});
