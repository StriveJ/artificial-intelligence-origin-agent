// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createSyntheticFixture, LAB_ROOT, SOURCE_ROOT } from '../../support/synthetic-fixture.mjs';
import { stageHubSource } from '../../support/stage-hub.mjs';

test("Missing or out-of-scope roots reject before target creation or reading", () => {
  assert.throws(() => createSyntheticFixture(), /explicit/);
  assert.throws(() => createSyntheticFixture({ parent: SOURCE_ROOT }), /outside|escape/);
  const f = createSyntheticFixture({ parent: LAB_ROOT });
  assert.throws(() => f.checked(), /explicit/);
  assert.throws(() => f.checked(SOURCE_ROOT), /outside|escape/);
  assert.throws(() => f.put('../outside', 'bad'), /Invalid/);
});

test("Configuration must not discover instances, connect to remotes, or inherit developer credentials", () => {
  const f = createSyntheticFixture({ parent: LAB_ROOT }), root = f.instance(), runtimeDir = f.path('runtime');
  assert.throws(() => f.config({ runtimeDir, testMode: true }), /explicit/);
  for (const extra of [{ testMode: false }, { mainUrl: 'https://example.invalid' }, { token: 'synthetic-even-when-fake' }, {model:{apiKey:'synthetic'}}, {installationId:'synthetic'}]) {
    assert.throws(() => f.config({ root, runtimeDir, testMode: true, ...extra }), /rejected/);
  }
  assert.equal(f.config({ root, runtimeDir, testMode: true }).root, root);
  const key = 'AIPA_PRIVATE_FIXTURE_TOKEN', previous = process.env[key];
  try { process.env[key] = 'must-not-inherit'; assert.equal(f.env()[key], undefined); }
  finally { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; }
  assert.equal(f.env().HOME, f.path('home'));
  assert.throws(() => f.run(join(SOURCE_ROOT, 'product/core-space/scripts/aipa-prune.mjs'), root, ['--root', SOURCE_ROOT]), /overwrite/);
});
test("Nested public-Hub links reject before copying and without entering their targets",()=>{
  const source=createSyntheticFixture({parent:LAB_ROOT}),target=createSyntheticFixture({parent:LAB_ROOT}),outside=createSyntheticFixture({parent:LAB_ROOT});
  source.put('source/lib/public.mjs','export const synthetic=true;');outside.put('private/sentinel.txt','synthetic outside data');
  symlinkSync(outside.path('private'),source.path('source/lib/linked'),process.platform==='win32'?'junction':'dir');
  assert.throws(()=>stageHubSource(source.path('source'),target),/links/);
  assert.equal(existsSync(target.path('hub-source/lib/linked/sentinel.txt')),false);
});

test("Directory links cannot expand synthetic write scope", () => {
  const f = createSyntheticFixture({ parent: LAB_ROOT }), outside = createSyntheticFixture({ parent: LAB_ROOT });
  const link = join(f.root, 'linked');
  mkdirSync(outside.path('target'));
  symlinkSync(outside.path('target'), link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => f.put('linked/sentinel', 'bad'), /outside|escape|link/);
  assert.equal(existsSync(outside.path('target/sentinel')), false);
});
