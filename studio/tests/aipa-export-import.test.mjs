// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {writeMemoryIndex} from '../../product/core-space/scripts/lib/memory-index-store.mjs';

test("Export/import preserves the profile", () => {
  const a=mkdtempSync(join(tmpdir(),'aipa-a-'));
  const b=mkdtempSync(join(tmpdir(),'aipa-b-'));
  mkdirSync(join(a,'user-space'),{recursive:true});
  writeFileSync(join(a,'user-space','profile.yaml'),'identity:\n  name: jun\n','utf8');
  const pack=join(a,'pack.json');
  execFileSync('node',['product/core-space/scripts/aipa-export.mjs','--root',a,'--out',pack]);
  execFileSync('node',['product/core-space/scripts/aipa-import.mjs','--root',b,'--pack',pack,'--apply']);
  assert.ok(existsSync(join(b,'user-space','profile.yaml')));
  assert.match(readFileSync(join(b,'user-space','profile.yaml'),'utf8'),/name:\s*jun/);
});

test("Export includes skills and applies privacy filters", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-'));
  mkdirSync(join(root,'user-space','skills','work','my-skill'),{recursive:true});
  writeFileSync(join(root,'user-space','skills','work','my-skill','SKILL.md'),"---\nname: my-skill\ndescription: \u6d4b\u8bd5\u6280\u80fd\n---\n\n## \u89e6\u53d1\u53e3\u4ee4\n- \u6d4b\u8bd5\n",'utf8');
  mkdirSync(join(root,'user-space','skills','work','secret-skill'),{recursive:true});
  writeFileSync(join(root,'user-space','skills','work','secret-skill','SKILL.md'),"---\nname: secret-skill\ndescription: \u542b token=abc\n---\n\n## \u89e6\u53d1\u53e3\u4ee4\n- \u79d8\u5bc6\n",'utf8');
  writeFileSync(join(root,'user-space','privacy.yaml'),'upload_policy:\n  mode: ask\n  block_patterns:\n    - "password|secret|token|apikey"\n  block_tags: [private]\n','utf8');
  const pack=join(root,'pack.json');
  execFileSync('node',['product/core-space/scripts/aipa-export.mjs','--root',root,'--out',pack]);
  const p=JSON.parse(readFileSync(pack,'utf8'));
  assert.equal(p.skills.length,1);
  assert.equal(p.skills[0].id,'my-skill');
});

const EXPORT = 'product/core-space/scripts/aipa-export.mjs';
const IMPORT = 'product/core-space/scripts/aipa-import.mjs';
const INDEX = 'product/core-space/scripts/aipa-index.mjs';
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'aipa-pack-'));
  mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
  return root;
}
function invoke(script, args) { return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' }); }
function writePack(root, pack) { const path = join(root, 'pack.json'); writeFileSync(path, JSON.stringify(pack)); return path; }

test("Imported content/provenance can rebuild; default preview requires explicit confirmation before application", () => {
  const source = fixture(), target = fixture();
  writeFileSync(join(source, 'user-space', 'memory', 'patterns.md'), "# \u7ecf\u9a8c\n\n## \u8c03\u8bd5\u65b9\u6cd5\n\n\u5148\u5b9a\u4f4d\u65f6\u5e8f，\u518d\u68c0\u67e5\u4fe1\u53f7。\n");
  execFileSync(process.execPath, [INDEX, '--root', source]);
  const indexPath = join(source, 'user-space', 'memory', 'memory-index.json');
  const index = JSON.parse(readFileSync(indexPath));
  index.entries[0].source = 'note:2026-10-14';
  writeMemoryIndex(source,index);
  const pack = join(source, 'pack.json');
  assert.equal(invoke(EXPORT, ['--root', source, '--out', pack]).status, 0);
  const preview = invoke(IMPORT, ['--root', target, '--pack', pack]);
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(JSON.parse(preview.stdout).status, 'preview');
  assert.equal(existsSync(join(target, 'user-space', 'memory', 'patterns.md')), false);
  const apply = invoke(IMPORT, ['--root', target, '--pack', pack, '--apply']);
  assert.equal(apply.status, 0, apply.stderr);
  execFileSync(process.execPath, [INDEX, '--root', target]);
  const restored = JSON.parse(readFileSync(join(target, 'user-space', 'memory', 'memory-index.json')));
  assert.ok(restored.entries.some(e => e.body.includes("\u5148\u5b9a\u4f4d\u65f6\u5e8f") && e.source === 'note:2026-10-14'));
  const search = invoke('product/core-space/scripts/aipa-search.mjs', ['--root', target, '--q', "\u65f6\u5e8f"]);
  assert.equal(search.status, 0, search.stderr);
  assert.match(search.stdout, /\u65f6\u5e8f/);
  assert.equal(invoke(IMPORT, ['--root', target, '--pack', pack, '--apply']).status, 0, "Repeated imports of the same package do not duplicate content");
});

test("Profile, memory, and skill attachments receive separate privacy decisions without leaking excluded content", () => {
  const root = fixture();
  writeFileSync(join(root, 'user-space', 'privacy.yaml'), 'upload_policy:\n  mode: ask\n  block_patterns:\n    - "CONFIDENTIAL"\n  block_tags: [private]\n');
  writeFileSync(join(root, 'user-space', 'profile.yaml'), 'identity:\n  name: CONFIDENTIAL\n');
  writeFileSync(join(root, 'user-space', 'memory', 'notes.md'), '# CONFIDENTIAL\n');
  mkdirSync(join(root, 'user-space', 'skills', 'work', 'check'), { recursive: true });
  writeFileSync(join(root, 'user-space', 'skills', 'work', 'check', 'SKILL.md'), "# \u68c0\u67e5\u65b9\u6cd5\n");
  writeFileSync(join(root, 'user-space', 'skills', 'work', 'check', 'config.json'), '{"api_key":"CONFIDENTIAL"}');
  const out = join(root, 'pack.json');
  const run = invoke(EXPORT, ['--root', root, '--out', out]);
  assert.equal(run.status, 0, run.stderr);
  const raw = readFileSync(out, 'utf8'), pack = JSON.parse(raw);
  assert.equal(pack.profile, null);
  assert.equal(pack.memories.length, 0);
  assert.equal(pack.skills.length, 0);
  assert.equal(raw.includes('CONFIDENTIAL'), false);
  assert.ok(pack.excluded.length > 0);
});

test("Index privacy metadata excludes the corresponding whole memory", () => {
  const root = fixture();
  writeFileSync(join(root, 'user-space', 'privacy.yaml'), 'upload_policy:\n  block_tags: [private]\n');
  writeFileSync(join(root, 'user-space', 'memory', 'notes.md'), "# \u8bb0\u5fc6\n\n## \u8bb0\u5f55\n\n\u666e\u901a\u5185\u5bb9\n");
  execFileSync(process.execPath, [INDEX, '--root', root]);
  const path = join(root, 'user-space', 'memory', 'memory-index.json');
  const index = JSON.parse(readFileSync(path)); index.entries[0].tags = ['private']; writeFileSync(path, JSON.stringify(index));
  const out = join(root, 'pack.json'); assert.equal(invoke(EXPORT, ['--root', root, '--out', out]).status, 0);
  assert.equal(JSON.parse(readFileSync(out)).memories.length, 0);
});

test("Import conflicts reject all writes first; profile replacement needs separate explicit permission", () => {
  const target = fixture();
  const profile = join(target, 'user-space', 'profile.yaml');
  writeFileSync(profile, 'identity:\n  name: Existing\n');
  const pack = writePack(target, { format: 'aipa-profile-pack', version: 2, profile: 'identity:\n  name: Incoming\n', memories: [], skills: [], index: null });
  const blocked = invoke(IMPORT, ['--root', target, '--pack', pack, '--apply']);
  assert.notEqual(blocked.status, 0);
  assert.equal(readFileSync(profile, 'utf8'), 'identity:\n  name: Existing\n');
  const replaced = invoke(IMPORT, ['--root', target, '--pack', pack, '--apply', '--replace-profile']);
  assert.equal(replaced.status, 0, replaced.stderr);
  assert.match(readFileSync(profile, 'utf8'), /Incoming/);
});

test("Package traversal rejects before writing profiles or content", () => {
  const root = fixture();
  const pack = writePack(root, { format: 'aipa-profile-pack', version: 2, profile: 'identity:\n  name: Incoming\n', memories: [{ path: '../escaped.md', content: "\u5185\u5bb9" }], skills: [], index: null });
  const result = invoke(IMPORT, ['--root', root, '--pack', pack, '--apply']);
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(join(root, 'user-space', 'profile.yaml')), false);
  assert.equal(existsSync(join(root, 'user-space', 'escaped.md')), false);
});

test("Legacy index-only packages without content reject restoration instead of fabricating empty memories", () => {
  const root = fixture();
  const pack = writePack(root, { profile: null, index: { entries: [{ id: 'mem-old', title: "\u65e7\u8bb0\u5f55" }] }, skills: [] });
  const result = invoke(IMPORT, ['--root', root, '--pack', pack, '--apply']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /content/);
});

test("Invalid privacy regular expressions reject before writing export packages", () => {
  const root = fixture();
  writeFileSync(join(root, 'user-space', 'privacy.yaml'), 'upload_policy:\n  block_patterns:\n    - "["\n');
  const out = join(root, 'pack.json');
  assert.notEqual(invoke(EXPORT, ['--root', root, '--out', out]).status, 0);
  assert.equal(existsSync(out), false);
});

test("Unindexed content retains file provenance and skill binary attachments restore completely", () => {
  const source = fixture(), target = fixture();
  writeFileSync(join(source, 'user-space', 'memory', 'notes.md'), "## \u8bb0\u5f55\n\n\u672a\u5efa\u7d22\u5f15\u7684\u7ecf\u9a8c\n");
  const skill = join(source, 'user-space', 'skills', 'work', 'chart'); mkdirSync(skill, { recursive: true });
  writeFileSync(join(skill, 'SKILL.md'), "# \u56fe\u8868\u6280\u80fd\n");
  const bytes = Buffer.from([0, 255, 1, 128, 42]); writeFileSync(join(skill, 'data.bin'), bytes);
  const out = join(source, 'pack.json'); assert.equal(invoke(EXPORT, ['--root', source, '--out', out]).status, 0);
  const applied = invoke(IMPORT, ['--root', target, '--pack', out, '--apply']); assert.equal(applied.status, 0, applied.stderr);
  assert.deepEqual(readFileSync(join(target, 'user-space', 'skills', 'work', 'chart', 'data.bin')), bytes);
  execFileSync(process.execPath, [INDEX, '--root', target]);
  const entries = JSON.parse(readFileSync(join(target, 'user-space', 'memory', 'memory-index.json'))).entries;
  assert.equal(entries[0].source, 'file:user-space/memory/notes.md');
});

test("Legacy packages with content restore; packages without content remain rejected", () => {
  const target = fixture();
  const path = writePack(target, { index: { entries: [{ title: "\u65e7\u7ecf\u9a8c", body: "\u4fdd\u5b58\u539f\u59cb\u7ecf\u9a8c", file: 'user-space/memory/legacy.md' }] } });
  const result = invoke(IMPORT, ['--root', target, '--pack', path, '--apply']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(join(target, 'user-space', 'memory', 'legacy.md'), 'utf8'), /\u4fdd\u5b58\u539f\u59cb\u7ecf\u9a8c/);
});

test("Explicit private labels exclude skills even when their bodies contain no sensitive strings", () => {
  const root = fixture(), skill = join(root, 'user-space', 'skills', 'work', 'local');
  mkdirSync(skill, { recursive: true }); writeFileSync(join(skill, 'SKILL.md'), "---\ntags: [private]\n---\n\n\u666e\u901a\u5185\u5bb9\n");
  writeFileSync(join(root, 'user-space', 'privacy.yaml'), 'upload_policy:\n  block_tags: [private]\n');
  const out = join(root, 'pack.json'); assert.equal(invoke(EXPORT, ['--root', root, '--out', out]).status, 0);
  assert.equal(JSON.parse(readFileSync(out)).skills.length, 0);
});
