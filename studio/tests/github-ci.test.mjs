import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Public CI uses both supported desktop platforms, Node 24, pinned actions, and the complete mechanical gate',()=>{
 const workflow=readFileSync('.github/workflows/ci.yml','utf8');
 assert.match(workflow,/branches: \[master, dev\]/);
 assert.match(workflow,/push:\s*\n\s+branches: \[master, dev, 'codex\/\*\*'\]/);
 assert.match(workflow,/os: \[ubuntu-latest, windows-latest\]/);
 assert.match(workflow,/node-version: '24'/);
 assert.match(workflow,/node studio\/scripts\/aipa-check\.mjs --mode all/);
 assert.match(workflow,/core\.longpaths true/);
 const actions=[...workflow.matchAll(/uses: (actions\/[\w-]+)@([^\s]+)/g)];
 assert.deepEqual(actions.map(row=>row[1]).sort(),['actions/checkout','actions/setup-node']);
 for(const [,name,commit] of actions)assert.match(commit,/^[a-f0-9]{40}$/,name);
});

test('Untrusted contribution CI receives no persistent Git credential, write permission, provider secret, or model invocation',()=>{
 const workflow=readFileSync('.github/workflows/ci.yml','utf8');
 assert.match(workflow,/contents: read/);
 assert.match(workflow,/persist-credentials: false/);
 assert.match(workflow,/package-manager-cache: false/);
 assert.doesNotMatch(workflow,/pull_request_target|workflow_run|contents: write|id-token: write|secrets\.|--allow-model|--push|private\.pem/);
});
