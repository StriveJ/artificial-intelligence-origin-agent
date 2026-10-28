// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {agendaInterface} from '../../support/agenda-interface.mjs';
import {createSyntheticFixture,LAB_ROOT,SOURCE_ROOT} from '../../support/synthetic-fixture.mjs';
import {listDueReminders} from '../../../product/core-space/scripts/lib/reminders.mjs';
import {collectReminderActions} from '../../../product/core-space/scripts/lib/reminder-plugin.mjs';
import {dispatchAgenda} from '../../../product/core-space/scripts/lib/agenda-provider.mjs';

test("Native agenda declarations match consumers; schemas 1/2 share reminder consumption",()=>{
 assert.deepEqual(JSON.parse(readFileSync(join(SOURCE_ROOT,'product/core-space/scripts/lib/agenda-interface.json'))),agendaInterface());
 const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance();
 f.put('instance/user-space/llm-provider.yaml','time_zone: Asia/Shanghai\nday_start_hour: 4\n');
 const base={schema:2,id:'synthetic-all-day',title:'Synthetic agenda',kind:'event',priority:'normal',status:'open',all_day:true,start_date:'2026-10-24',end_date_exclusive:'2026-10-25',time_zone:'Asia/Shanghai',remind_at:'2026-10-23T15:00:00Z'};
 f.put('instance/user-space/reminders/synthetic-all-day.json',JSON.stringify(base));
 f.put('instance/user-space/reminders/synthetic-legacy.json',JSON.stringify({schema:1,id:'synthetic-legacy',title:'Synthetic legacy',status:'open',event_at:'2026-10-24T03:00:00Z',remind_at:'2026-10-23T15:00:00Z'}));
 f.put('instance/user-space/reminders/synthetic-unknown.json',JSON.stringify({...base,schema:999,id:'synthetic-unknown'}));
 assert.equal(listDueReminders(root,'2026-10-24T00:00:00Z').length,2);
 const actions=collectReminderActions({root,nowISO:'2026-10-24T00:00:00Z',device:'synthetic',reason:'session'}).actions;
 assert.ok(actions.some(a=>a.lines[0].includes("all day")));assert.ok(actions.some(a=>a.lines[0].includes('2026-10-24 11:00')));
 assert.equal(listDueReminders(root,'2026-10-26T01:00:00Z').length,0);
});

test("Dispatch providers only through local bindings; reject instance/config replacement",async()=>{
 const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance(),script=join(SOURCE_ROOT,'product/core-space/scripts/aipa-signal.mjs');
 assert.notEqual(f.run(script,root,['agenda','--command','list']).status,0);
 const config=f.put('provider/config.json',JSON.stringify({root})),program=f.path('provider');
 f.put('provider/lib/agenda-cli.mjs',"console.log(JSON.stringify({synthetic:true,args:process.argv.slice(2)}));");
 f.put('instance/.git/aipa-hub-agenda.json',JSON.stringify({version:1,configFile:config,programDir:program}));
 const good=f.run(script,root,['agenda','--command','list']);assert.equal(good.status,0,good.stderr);assert.equal(JSON.parse(good.stdout).synthetic,true);
 await assert.rejects(()=>dispatchAgenda(root,['--config','invalid']),/cannot override/);
});
