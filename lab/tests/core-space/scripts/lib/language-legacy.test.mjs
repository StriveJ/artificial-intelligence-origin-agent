import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {makeTestDir} from './test-tmp.mjs';
import {renderScene,extractManual} from '../../../../../product/core-space/scripts/lib/sceneblock.mjs';
import {renderDraft} from '../../../../../product/core-space/scripts/lib/profile-draft.mjs';
import {isSummaryPending,summarySection,timelineSection} from '../../../../../product/core-space/scripts/lib/daily-note.mjs';
import {parseCanvas} from '../../../../../product/core-space/scripts/lib/canvas.mjs';
import {extractTodoItems} from '../../../../../product/core-space/scripts/lib/signal-core.mjs';

const SOURCE=resolve(dirname(fileURLToPath(import.meta.url)),'../../../../..');
function fixture(t) {
  const root=makeTestDir('language-legacy-');
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const put=(relative,text)=>{const path=join(root,relative);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,text);};
  return {root,put};
}

test('scene and draft writers accept old section keys and preserve native bodies under English headings',()=>{
  const native='\u4fdd\u7559\u7528\u6237\u539f\u6587';
  const scene=renderScene({project:'demo',updated:'2026-10-27',sections:{'\u5f53\u524d\u72b6\u6001':native},manual:native});
  assert.ok(scene.includes('## Current State\n'+native));
  assert.ok(scene.includes('## Open Loops\n(none yet)'));
  assert.equal(extractManual(scene),native);
  assert.equal(extractManual('## \u624b\u5de5\u8865\u5145\n'+native+'\n'),native);
  assert.equal(extractManual('## \u624b\u5de5\u8865\u5145\n\uff08\u53ef\u5728\u91cd\u7b97\u540e\u4fdd\u7559\u7684\u624b\u5de5\u8865\u5145\uff09\n'),'');
  const draft=renderDraft({date:'2026-10-27',sections:{'\u5efa\u8bae\u65b0\u589e':native}});
  assert.ok(draft.startsWith('# Profile Draft (2026-10-27 generated)'));
  assert.ok(draft.includes('## Suggested Additions\n'+native));
});

test('daily, canvas and task readers accept old persisted markers alongside English',()=>{
  const native='\u4e00\u6761\u539f\u6587';
  const old='## \u65f6\u95f4\u7ebf\uff08\u673a\u68b0\u751f\u6210\uff09\n- [10:00] demo\n## \u4eca\u65e5\u603b\u7ed3\n'+native+'\n';
  assert.match(timelineSection(old),/10:00/);
  assert.equal(summarySection(old).trim(),native);
  assert.equal(isSummaryPending('## \u4eca\u65e5\u603b\u7ed3\n\uff08\u5f85\u8865\u603b\u7ed3\uff09\n'),true);
  assert.equal(isSummaryPending('## Daily Summary\n(summary pending)\n'),true);
  assert.equal(parseCanvas('## \u76ee\u6807\n'+native+'\n## Steps\n').goal,native);
  assert.equal(parseCanvas('## \u76ee\u6807\n\uff08\u672a\u586b\u5199\uff09\n').goal,'');
  assert.deepEqual(extractTodoItems('## \u5f85\u529e\n- **\u72b6\u6001**\uff1a\u5f85\u505a\n- [ ] '+native),['\u5f85\u529e','**\u72b6\u6001**\uff1a\u5f85\u505a',native]);
  assert.deepEqual(extractTodoItems('## Pending\n- **Status**: completed\n- [ ] task'),['Pending','task']);
});

test('native persisted mentor preferences match an English mentor without editing source profile',t=>{
  const {root,put}=fixture(t);
  put('industry-map.yaml','industries:\n  hardware/embedded:\n    - embedded development\n');
  put('mentors/demo/mentor.yaml','mentor_id: demo\nname: Synthetic Mentor\nindustry: embedded development\ntech_stack: [C, embedded Linux]\nrole: Professional\n');
  const profile='identity:\n  industry: \u5d4c\u5165\u5f0f\u5f00\u53d1\n  role: \u4ece\u4e1a\u8005\n';
  put('user-space/profile.yaml',profile);
  const result=JSON.parse(execFileSync(process.execPath,[join(SOURCE,'product/scripts/aipa-match-mentor.mjs'),'--industry','\u5d4c\u5165\u5f0f\u5f00\u53d1','--role','\u4ece\u4e1a\u8005','--tech','C,\u5d4c\u5165\u5f0fLinux','--mentors',join(root,'mentors'),'--map',join(root,'industry-map.yaml')],{encoding:'utf8'}));
  assert.deepEqual(result.top,[{mentor_id:'demo',name:'Synthetic Mentor',score:1}]);
  assert.equal(readFileSync(join(root,'user-space/profile.yaml'),'utf8'),profile);
});
