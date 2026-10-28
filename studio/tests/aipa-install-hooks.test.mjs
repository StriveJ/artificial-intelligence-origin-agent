// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Hook installation writes the pre-push version gate", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-hooks-'));
  execFileSync('git', ['-C', root, 'init'], { stdio: 'ignore' });
  execFileSync('node', ['studio/scripts/install-git-hooks.mjs', '--root', root]);
  const hook = readFileSync(join(root, '.git', 'hooks', 'pre-push'), 'utf8');
  assert.match(hook, /ORIGIN-MANIFEST\.yaml/, "The hook must check ORIGIN-MANIFEST changes");
  assert.match(hook, /BLOCKED/, "The hook must include a rejection explanation");
  assert.match(hook, /refs\/heads\/master/, "The hook gates master pushes only");
});

test("Hook installation fails outside Git repositories", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-hooks-'));
  assert.throws(() => execFileSync('node', ['studio/scripts/install-git-hooks.mjs', '--root', root], { stdio: 'ignore' }));
});

test("Hook installation respects actual core.hooksPath and writes LF scripts", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-hooks-custom-'));
  execFileSync('git', ['init', root], { stdio: 'ignore' });
  execFileSync('git', ['-C', root, 'config', 'core.hooksPath', 'custom-hooks']);
  const out = execFileSync(process.execPath, ['studio/scripts/install-git-hooks.mjs', '--root', root], { encoding: 'utf8' });
  const hook = join(root, 'custom-hooks', 'pre-push');
  assert.match(out, /custom-hooks/);
  assert.doesNotMatch(readFileSync(hook, 'utf8'), /\r/);
  if (process.platform !== 'win32') assert.equal(statSync(hook).mode & 0o111, 0o111);
});

test("Real Git invokes pre-push and rejects master pushes without a version change", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-hook-execution-')),remote=mkdtempSync(join(tmpdir(),'aipa-hook-remote-'));
  execFileSync('git',['init','--bare',remote],{stdio:'pipe'});execFileSync('git',['init','-b','master',root],{stdio:'pipe'});
  const git=args=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:'pipe'});git(['config','user.name','Test']);git(['config','user.email','test@example.com']);
  mkdirSync(join(root,'product'));writeFileSync(join(root,'product','ORIGIN-MANIFEST.yaml'),'origin:\n  version: 0.01.0\n');writeFileSync(join(root,'product','policy.md'),'first');
  git(['add','-A']);git(['commit','-m','first']);git(['remote','add','origin',remote]);git(['push','origin','master']);
  execFileSync(process.execPath,['studio/scripts/install-git-hooks.mjs','--root',root],{stdio:'pipe'});
  writeFileSync(join(root,'product','policy.md'),'changed');git(['add','-A']);git(['commit','-m','no version bump']);
  assert.throws(()=>git(['push','origin','master']),e=>/BLOCKED/.test(String(e.stderr)));
});

test("Real Git invokes the installed instance pre-commit hook and blocks non-trunk ledger commits", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-instance-hook-execution-'));
  execFileSync(process.execPath,['product/scripts/aipa-init.mjs','--root',root,'--owner','synthetic'],{stdio:'pipe'});
  const git=args=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:'pipe'});git(['branch','-M','master']);git(['config','user.name','Test']);git(['config','user.email','test@example.com']);
  execFileSync(process.execPath,[join(root,'core-space','scripts','aipa-git-guard.mjs'),'--install','--root',root,'--trunk','master'],{stdio:'pipe'});
  git(['switch','-c','feature']);writeFileSync(join(root,'user-space','memory','hook-probe.md'),"\u5408\u6210\u8bb0\u8d26");git(['add','user-space/memory/hook-probe.md']);
  assert.throws(()=>git(['commit','-m','must be blocked']),e=>/Commit refused|accounting belongs on trunk/.test(String(e.stderr)));
});
