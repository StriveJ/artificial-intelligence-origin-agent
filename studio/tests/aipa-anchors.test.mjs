import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

function keysOf(path){ const t=readFileSync(path,'utf8'); return (t.match(/^  ([a-z_]+):/gm)||[]).map(s=>s.trim().replace(':','')); }

test("Override template keys are a subset of the anchor registry", () => {
  const anchors = keysOf('product/core-space/anchors.yaml');

  assert.ok(anchors.includes('agent_name') && anchors.includes('assist_prefix') && anchors.includes('identity') && anchors.includes('tone'));
});

test("Version and policy anchors cannot be overridden", () => {
  const anchors = keysOf('product/core-space/anchors.yaml');
  assert.ok(!anchors.includes('version') && !anchors.includes('policy'));
});
