// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';


test("Public CLIs and permission registrations correspond exactly", () => {
  const actual = readdirSync('product/core-space/scripts').filter(f => f.endsWith('.mjs')).sort();
  const declared = [...readFileSync('product/core-space/tools.yaml','utf8').matchAll(/^  (aipa-[^:]+\.mjs):/gm)].map(m => m[1]).sort();
  assert.deepEqual(declared, actual, "Every public CLI needs permissions and deleted entries must not remain registered");
});

test("All seam-declared scripts exist", () => {
  const seam = readFileSync('product/core-space/seam.yaml','utf8');
  const scripts = [...seam.matchAll(/core-space\/scripts\/[a-z0-9-]+\.mjs/g)].map(m => m[0]);
  assert.ok(scripts.length > 0, "Retain public capability declarations");
  for (const script of scripts) assert.ok(existsSync(join('product',script)), "Invalid capability entry: "+script);
});

test("Public documentation and licenses are assembled into the base", () => {
  for (const path of ['README.md','README_CN.md','README_EN.md','LICENSE']) assert.ok(existsSync(join('product',path)), "Missing public entry: "+path);
  assert.match(readFileSync('product/LICENSE','utf8'), /Version 2\.0, January 2004/);
});

test("All validator-required files exist under product", () => {
  for (const f of ['ORIGIN-MANIFEST.yaml', 'core-space/CONSTRAINTS.md', 'core-space/policy.md', 'AGENTS.md']) {
    assert.ok(existsSync(join('product', f)), `Missing required base file: ${f}`);
  }
});


test("The runtime count declared in studio/CLAUDE.md matches actual scripts", () => {
  const doc = readFileSync('studio/CLAUDE.md', 'utf8');
  const m = doc.match(/Core has (\d+) registered runtime entry points/);
  assert.ok(m, "studio/CLAUDE.md must declare the runtime script count");
  const actual = readdirSync('product/core-space/scripts').filter(f => f.endsWith('.mjs')).length;
  assert.equal(Number(m[1]), actual, `Declared runtime count ${m[1]} differs from actual count ${actual}`);
});

test("Contribution guidance agrees with hard boundaries and never recommends user-space/scripts for personal scripts", () => {
  const doc = readFileSync('CONTRIBUTING.md', 'utf8');
  assert.doesNotMatch(doc, /\u542b\s*`user-space\/scripts\/`/, "The primary guide must not retain the old user-space/scripts permission claim");
  assert.doesNotMatch(doc, /including\s+`user-space\/scripts\/`/, "The English guide must not retain the same obsolete statement");

  const section = doc.split('## Contributing from a Personal Instance')[1];
  assert.ok(section,'The contribution boundary section must exist');
  const sec = section.split('\n## ')[0];
  assert.match(sec, /Personal scripts may live elsewhere under user-space/, "Personal scripts remain permitted in suitable locations");
  assert.match(sec, /never user-space\/scripts\//, "The removed scripts directory remains forbidden");
  assert.match(sec, /hard export blocker/, "The removed directory remains a hard export gate");
});

test("ORIGIN-MANIFEST and VERSION agree", () => {
  const manifest = readFileSync('product/ORIGIN-MANIFEST.yaml', 'utf8');
  const version = readFileSync('product/VERSION', 'utf8').trim();
  assert.match(manifest, new RegExp(`version:\\s*${version.replace(/\./g, '\\.')}`), `ORIGIN-MANIFEST differs from VERSION (${version})`);
});
