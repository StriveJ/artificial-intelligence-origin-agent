// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';
import { addDays } from '../../../../product/core-space/scripts/lib/time-boundary.mjs';
import {claudeDirName} from '../../../../product/core-space/scripts/lib/host-usage.mjs';

const SCRIPT = join(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts'), 'aipa-host-usage.mjs');
const TODAY = '2026-09-12';
const run = (root, argv) => execFileSync(process.execPath, [SCRIPT, '--root', root, ...argv], { encoding: 'utf8' }).trim();


function fakeHome(instanceRoot, day) {
  const home = makeTestDir('aipa-homedir-');
  const sessDir = join(home, '.codex', 'sessions', '2026', '09', '12');
  mkdirSync(sessDir, { recursive: true });
  const iso = (hhmm) => `${day}T${hhmm}:00.000Z`;
  const prevDay = addDays(day,-1);
  const line = (ts, cum, ctx) => JSON.stringify({
    timestamp: ts, type: 'event_msg',
    payload: { type: 'token_count', info: {
      total_token_usage: { input_tokens: cum.input, cached_input_tokens: cum.cached, output_tokens: cum.output, reasoning_output_tokens: 0 },
      last_token_usage: { input_tokens: ctx, cached_input_tokens: ctx - 50, output_tokens: 10, reasoning_output_tokens: 0 },
      model_context_window: 1000000,
    } },
  });
  writeFileSync(join(sessDir, 'rollout-1.jsonl'), [
    JSON.stringify({ timestamp: `${prevDay}T04:00:00.000Z`, type: 'session_meta', payload: { cwd: instanceRoot } }),

    line(`${prevDay}T07:00:00.000Z`, { input: 1000, cached: 900, output: 20 }, 900),
    line(iso('05:00'), { input: 6000, cached: 5700, output: 80 }, 5000),
  ].join('\n') + '\n', 'utf8');
  writeFileSync(join(sessDir, 'rollout-2.jsonl'), [
    JSON.stringify({ timestamp: iso('04:00'), type: 'session_meta', payload: { cwd: 'D:\\somewhere\\unrelated' } }),
    line(iso('04:10'), { input: 999999, cached: 999999, output: 999999 }, 999999),
  ].join('\n') + '\n', 'utf8');
  return home;
}

test("Host-usage snapshots include only this instance and registered-project sessions", () => {
  const root = makeTestDir('aipa-hostusage-');
  const home = fakeHome(root, TODAY);
  try {
    const out = JSON.parse(run(root, ['snapshot', '--home', home, '--day', TODAY]));
    assert.equal(out.status, 'ok');
    assert.deepEqual(out.hosts, ['codex']);
    const row = JSON.parse(readFileSync(join(root, 'user-space', 'logs', 'metrics', 'host-usage.jsonl'), 'utf8').trim());
    assert.equal(row.host, 'codex');
    assert.equal(row.sessions, 1, "Exclude the unrelated-project session");
    assert.equal(row.inputTokens, 6000 - 1000, "Daily usage is the cumulative delta after subtracting the previous day");
    assert.equal(row.ctxTokens, 5000);
    assert.equal(row.ctxWindow, 1000000);
    assert.equal(row.cacheHitPct, 96, "Cache hit rate is delta cached divided by delta input");
    assert.equal(row.freshTokens, 5000 - 4800, "Recompute new input after merging threads instead of returning zero");
    assert.ok(!JSON.stringify(row).includes('999999'), "Do not include unrelated-project numbers");
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test("Host-usage snapshots without daily sessions report no data without fabricated rows", () => {
  const root = makeTestDir('aipa-hostusage-');
  const home = fakeHome(root, TODAY);
  try {
    const out = JSON.parse(run(root, ['snapshot', '--home', home, '--day', '2000-01-01']));
    assert.deepEqual(out.hosts, []);
    assert.equal(existsSync(join(root, 'user-space', 'logs', 'metrics', 'host-usage.jsonl')), false, "Do not persist a row without data");
    assert.match(out.lines.join(''), /No host usage yet/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test("Host usage retains one row per day and host, replacing repeat samples idempotently", () => {
  const root = makeTestDir('aipa-hostusage-');
  const home = fakeHome(root, TODAY);
  try {
    assert.match(run(root, ['show']), /No host-usage snapshot yet/);
    run(root, ['snapshot', '--home', home, '--day', TODAY]);
    run(root, ['snapshot', '--home', home, '--day', TODAY]);
    const rows = readFileSync(join(root, 'user-space', 'logs', 'metrics', 'host-usage.jsonl'), 'utf8').trim().split(/\r?\n/);
    assert.equal(rows.length, 1, "Repeat sampling on the same day retains one row");
    const shown = run(root, ['show']);
    assert.match(shown, new RegExp(TODAY));
    assert.match(shown, /Codex/);
    assert.match(shown, /Cache hit/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('Host-usage snapshots apply the configured clock to real synthetic Codex and Claude logs across OS zones and DST boundaries',()=>{
 const scenarios=[
  {zone:'UTC',hour:6,day:'2026-09-12',instants:['2026-09-12T05:59:59Z','2026-09-12T06:00:00Z','2026-09-12T07:00:00Z','2026-09-13T06:00:00Z']},
  {zone:'Asia/Kathmandu',hour:6,day:'2026-09-12',instants:['2026-09-12T00:14:59Z','2026-09-12T00:15:00Z','2026-09-12T01:00:00Z','2026-09-13T00:15:00Z']},
  {zone:'America/New_York',hour:2,day:'2026-03-08',instants:['2026-03-08T06:59:59Z','2026-03-08T07:00:00Z','2026-03-08T07:30:00Z','2026-03-09T06:00:00Z']},
  {zone:'America/New_York',hour:2,day:'2026-11-01',instants:['2026-11-01T06:59:59Z','2026-11-01T07:00:00Z','2026-11-01T07:30:00Z','2026-11-02T07:00:00Z']},
  {zone:'America/New_York',hour:1,day:'2026-11-01',instants:['2026-11-01T04:59:59Z','2026-11-01T05:30:00Z','2026-11-01T06:30:00Z','2026-11-02T06:00:00Z']},
 ];
 for(const spec of scenarios)for(const hostZone of ['UTC','Asia/Shanghai']){
  const root=makeTestDir('aipa-hostusage-clock-'),home=makeTestDir('aipa-hostusage-clock-home-');
  try{
   mkdirSync(join(root,'user-space'),{recursive:true});writeFileSync(join(root,'user-space','llm-provider.yaml'),'time_zone: '+spec.zone+'\nday_start_hour: '+spec.hour+'\n');
   mkdirSync(join(root,'state'),{recursive:true});writeFileSync(join(root,'state','host-id'),'synthetic-clock\n');
   const codexDir=join(home,'.codex','sessions'),claudeDir=join(home,'.claude','projects',claudeDirName(root));
   mkdirSync(codexDir,{recursive:true});mkdirSync(claudeDir,{recursive:true});
   const codexRows=[JSON.stringify({type:'session_meta',payload:{cwd:root}}),...spec.instants.map((timestamp,index)=>JSON.stringify({timestamp,type:'event_msg',payload:{type:'token_count',info:{total_token_usage:{input_tokens:[100,300,600,900][index],cached_input_tokens:[40,120,300,500][index],output_tokens:[10,30,60,90][index],reasoning_output_tokens:0},last_token_usage:{input_tokens:[80,220,420,640][index]},model_context_window:1000}}}))];
   writeFileSync(join(codexDir,'rollout-synthetic-clock.jsonl'),codexRows.join('\n')+'\n');
   writeFileSync(join(claudeDir,'synthetic-clock.jsonl'),spec.instants.map((timestamp,index)=>JSON.stringify({timestamp,type:'assistant',message:{usage:{input_tokens:10*(index+1),cache_read_input_tokens:100*(index+1),cache_creation_input_tokens:index,output_tokens:index+1}}})).join('\n')+'\n');
   const result=JSON.parse(execFileSync(process.execPath,[SCRIPT,'snapshot','--root',root,'--home',home,'--day',spec.day],{encoding:'utf8',env:{...process.env,TZ:hostZone},windowsHide:true}));
   assert.deepEqual(result.hosts,['claude-code','codex'],spec.zone+' on '+hostZone);
   const rows=readFileSync(result.path,'utf8').trim().split(/\r?\n/).map(row=>JSON.parse(row)),codex=rows.find(row=>row.host==='codex'),claude=rows.find(row=>row.host==='claude-code');
   assert.equal(codex.date,spec.day);assert.equal(codex.points,2);assert.equal(codex.inputTokens,500);assert.equal(codex.cachedTokens,260);assert.equal(codex.freshTokens,240);assert.equal(codex.outputTokens,50);assert.equal(codex.ctxTokens,420);
   assert.equal(claude.date,spec.day);assert.equal(claude.points,2);assert.equal(claude.freshTokens,53);assert.equal(claude.cachedTokens,500);assert.equal(claude.inputTokens,553);assert.equal(claude.outputTokens,5);
  }finally{rmSync(root,{recursive:true,force:true});rmSync(home,{recursive:true,force:true});}
 }
});
