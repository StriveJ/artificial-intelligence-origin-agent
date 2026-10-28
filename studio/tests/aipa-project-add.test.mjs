// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';

const MASTER = "---\ndescription: \u6fc0\u6d3b\n---\n\n$ARGUMENTS\nassist_prefix\n";


function setupInstance() {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  mkdirSync(join(root, '.ide_activation'), { recursive: true });
  writeFileSync(join(root, '.ide_activation', 'aipa.md'), MASTER, 'utf8');
  return root;
}

test("Project registration records the instance and ignores the project backlink", () => {
  const root=setupInstance();
  const proj=mkdtempSync(join(tmpdir(),'proj-'));
  writeFileSync(join(proj,'AGENTS.md'),"# \u6211\u7684\u9879\u76ee\n\n## \u8bf4\u660e\n- \u5df2\u6709\u5185\u5bb9\n",'utf8');
  const out=execFileSync('node',['product/core-space/scripts/aipa-project-add.mjs','--root',root,'--local-path',proj,'--name',"\u5d4c\u5165\u5f0f\u7f51\u5173",'--goal',"\u91cd\u6784 GPIO",'--terms',"RTOS,\u4e2d\u65ad"],{encoding:'utf8'});
  const r=JSON.parse(out);
  assert.equal(r.project_id, basename(proj));
  const yaml=readFileSync(join(root,'user-space','projects',r.project_id,'project.yaml'),'utf8');
  assert.doesNotMatch(yaml,/local_path:/);
  assert.match(yaml,/\u5d4c\u5165\u5f0f\u7f51\u5173/);
  const lp=readFileSync(join(root,'user-space','projects',r.project_id,'local_path'),'utf8');
  assert.equal(lp.trim(), proj);

  const link=readFileSync(join(proj,'AIPA-INSTANCE.md'),'utf8');
  assert.match(link,/Instance directory/);
  const gi=readFileSync(join(proj,'.gitignore'),'utf8');
  assert.match(gi,/AIPA-INSTANCE\.md/);
  const agents=readFileSync(join(proj,'AGENTS.md'),'utf8');
  assert.match(agents,/AIPA-INSTANCE\.md/);
  assert.match(agents,/\u5df2\u6709\u5185\u5bb9/);
});

test("Repeated project registration is idempotent", () => {
  const root=setupInstance();
  const proj=mkdtempSync(join(tmpdir(),'proj-'));
  execFileSync('node',['product/core-space/scripts/aipa-project-add.mjs','--root',root,'--local-path',proj,'--name','x']);
  execFileSync('node',['product/core-space/scripts/aipa-project-add.mjs','--root',root,'--local-path',proj,'--name','x']);
  const agents=readFileSync(join(proj,'AGENTS.md'),'utf8');
  assert.equal(agents.split('AIPA-INSTANCE.md').length-1, 1);
  const gi=readFileSync(join(proj,'.gitignore'),'utf8');
  assert.equal(gi.split('AIPA-INSTANCE.md').length-1, 1);
});

test("Project registration installs and ignores the activation adapter", () => {
  const root=setupInstance();
  const proj=mkdtempSync(join(tmpdir(),'proj-'));
  execFileSync('node',['product/core-space/scripts/aipa-project-add.mjs','--root',root,'--local-path',proj,'--name','x']);
  const adapter=readFileSync(join(proj,'.claude','commands','aipa.md'),'utf8');
  assert.match(adapter,/assist_prefix/);
  assert.match(adapter,/\$ARGUMENTS/);
  const gi=readFileSync(join(proj,'.gitignore'),'utf8');
  assert.match(gi,/\.claude\/commands\/aipa\.md/);
});
