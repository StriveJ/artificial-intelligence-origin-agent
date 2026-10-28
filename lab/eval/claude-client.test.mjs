import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticFixture,LAB_ROOT} from '../support/synthetic-fixture.mjs';
import {createClaudeEvaluationClient} from './claude-client.mjs';
test("Real evaluation isolates HOME, disables tools/extensions, and passes only allowlisted model environment variables",async()=>{
 const f=createSyntheticFixture({parent:LAB_ROOT,prefix:'model-client-test-'}),settings=f.put('settings.json',JSON.stringify({env:{ANTHROPIC_AUTH_TOKEN:'synthetic-auth',ANTHROPIC_MODEL:'synthetic-model',SHOULD_NOT_PASS:'synthetic-private'},hooks:{SessionStart:[{command:'must-not-run'}]}}));
 const entry=f.put('fake-cli.mjs',`import assert from 'node:assert/strict';
assert.equal(process.env.ANTHROPIC_AUTH_TOKEN,'synthetic-auth');assert.equal(process.env.SHOULD_NOT_PASS,undefined);assert.ok(process.env.CLAUDE_CONFIG_DIR.endsWith('claude-config'));for(const flag of ['--bare','--strict-mcp-config','--no-session-persistence','--disable-slash-commands'])assert.ok(process.argv.includes(flag));assert.equal(process.argv[process.argv.indexOf('--tools')+1],'');let input='';for await(const chunk of process.stdin)input+=chunk;process.stdout.write(JSON.stringify({result:'Synthetic answer',usage:{input_tokens:1,output_tokens:2},modelUsage:{'synthetic-model':{}},total_cost_usd:0}));`);
 const client=createClaudeEvaluationClient({entry,fixture:f,settingsFile:settings}),result=await client.run('Synthetic only');assert.equal(result.answer,'Synthetic answer');assert.equal(client.calls(),1);assert.deepEqual(result.models,['synthetic-model']);assert.equal(client.isolation.personalInstructions,false);
});
