// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function skill(dir, id, trigger){
  const p=join(dir,id);
  mkdirSync(p,{recursive:true});
  writeFileSync(join(p,'SKILL.md'), `---\nname: ${id}\ndescription: test\n---\n\n## \u89e6\u53d1\u53e3\u4ee4\n- ${trigger}\n`, 'utf8');
}
test("Matching personal skills return personal", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-'));
  skill(join(root,'personal'),'a',"\u91cd\u6784");
  const out=execFileSync('node',['product/core-space/scripts/aipa-route.mjs','--query',"\u91cd\u6784",'--personal-skills',join(root,'personal'),'--base-skills',join(root,'origin')]);
  assert.equal(out.toString().trim(),'personal');
});
test("Matching base skills return base", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-'));
  skill(join(root,'base'),'b',"\u8c03\u8bd5");
  const out=execFileSync('node',['product/core-space/scripts/aipa-route.mjs','--query',"\u8c03\u8bd5",'--personal-skills',join(root,'personal'),'--base-skills',join(root,'base')]);
  assert.equal(out.toString().trim(),'base');
});
test("Unmatched routes return llm", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-'));
  const out=execFileSync('node',['product/core-space/scripts/aipa-route.mjs','--query',"\u968f\u4fbf",'--personal-skills',join(root,'personal'),'--base-skills',join(root,'origin')]);
  assert.equal(out.toString().trim(),'llm');
});

test("Categorized personal skills route and override public triggers; sandbox skills do not route or lint", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-scoped-skill-'));
  skill(join(root, 'user-space', 'skills', 'work'), 'shared', "\u5206\u7c7b\u53e3\u4ee4");
  skill(join(root, 'core-space', 'common', 'skills'), 'shared', "\u5206\u7c7b\u53e3\u4ee4");
  skill(join(root, 'user-space', 'skills', '_sandbox', 'work'), 'hidden', "\u6c99\u7bb1\u53e3\u4ee4");
  const run = query => execFileSync(process.execPath, ['product/core-space/scripts/aipa-route.mjs', '--root', root, '--query', query], { encoding: 'utf8' }).trim();
  assert.equal(run("\u5206\u7c7b\u53e3\u4ee4"), 'personal'); assert.equal(run("\u6c99\u7bb1\u53e3\u4ee4"), 'llm');
  const lint = JSON.parse(execFileSync(process.execPath, ['product/core-space/scripts/aipa-skill-lint.mjs', '--root', root, '--json'], { encoding: 'utf8' }));
  assert.equal(lint.total, 2); assert.equal(lint.report.some(r => r.file.includes('_sandbox')), false);
});

test("Renamed personal triggers prevent the overridden public trigger from bypassing precedence", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-skill-override-'));
  skill(join(root,'user-space','skills','work'),'same-id',"\u4e2a\u4eba\u65b0\u53e3\u4ee4");skill(join(root,'core-space','common','skills'),'same-id',"\u516c\u5171\u65e7\u53e3\u4ee4");
  const run=query=>execFileSync(process.execPath,['product/core-space/scripts/aipa-route.mjs','--root',root,'--query',query],{encoding:'utf8'}).trim();
  assert.equal(run("\u4e2a\u4eba\u65b0\u53e3\u4ee4"),'personal');assert.equal(run("\u516c\u5171\u65e7\u53e3\u4ee4"),'llm');
});
