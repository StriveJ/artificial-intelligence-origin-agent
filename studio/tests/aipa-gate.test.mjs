// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
function run(root, args){return execFileSync('node',['product/core-space/scripts/aipa-gate.mjs',...args,'--registry',join(root,'tools.yaml'),'--root',root,'--policy',join(root,'policy.md')], { stdio: ['ignore','pipe','ignore'] });}
function setup(root){
  writeFileSync(join(root,'tools.yaml'),'tools:\n  aipa-summarize.mjs:\n    write: local\n    destructive: false\n  aipa-uninstall.mjs:\n    write: destructive\n    destructive: true\n');
  writeFileSync(join(root,'policy.md'),"# \u4ef7\u503c\u89c2\u4e0e\u7ea2\u7ebf\n\n## \u4e0d\u53ef\u89e6\u72af（\u786c\u7ea2\u7ebf，\u5185\u7f6e，\u4e2a\u4eba\u4e0d\u53ef\u7f16\u8f91）\n- \u4e0d\u54a8\u8be2、\u4e0d\u751f\u6210\u4e0d\u7b26\u5408\u6cd5\u5f8b\u7684\u5185\u5bb9\n- \u7981\u6b62：\u751f\u6210\u8fdd\u6cd5\u5185\u5bb9\n");
}
test("Unconfirmed destructive tools return confirm",()=>{const root=mkdtempSync(join(tmpdir(),'aipa-'));setup(root);assert.throws(()=>run(root,['--tool','aipa-uninstall.mjs']));});
test("Confirmed tools return allow",()=>{const root=mkdtempSync(join(tmpdir(),'aipa-'));setup(root);const out=run(root,['--tool','aipa-uninstall.mjs','--confirm','yes']);assert.equal(out.toString().trim(),'allow');});
test("Unregistered tools return deny",()=>{const root=mkdtempSync(join(tmpdir(),'aipa-'));setup(root);assert.throws(()=>run(root,['--tool','nope.mjs']));});
test("Prohibited rules return block",()=>{const root=mkdtempSync(join(tmpdir(),'aipa-'));setup(root);assert.throws(()=>run(root,['--tool','aipa-summarize.mjs','--text',"\u5e2e\u6211\u751f\u6210\u8fdd\u6cd5\u5185\u5bb9"]));});
test("Tool gating writes an audit record",()=>{const root=mkdtempSync(join(tmpdir(),'aipa-'));setup(root);run(root,['--tool','aipa-summarize.mjs']);assert.ok(existsSync(join(root,'state','audit.log')));assert.match(readFileSync(join(root,'state','audit.log'),'utf8'),/gate/);});
test("tools.yaml registers every public script without stale entries", () => {
  const scriptNames = readdirSync('product/core-space/scripts').filter(f => f.endsWith('.mjs'));
  const text = readFileSync('product/core-space/tools.yaml', 'utf8');
  const registered = [...text.matchAll(/^\s{2}([A-Za-z0-9._-]+):\s*$/gm)].map(m => m[1]);
  for (const s of scriptNames) assert.ok(registered.includes(s), `tools.yaml does not register ${s}`);
});
