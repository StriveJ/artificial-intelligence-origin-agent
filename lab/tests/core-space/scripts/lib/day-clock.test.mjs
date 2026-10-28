import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { dayStartHour, todayKey, tsLocal } from '../../../../../product/core-space/scripts/lib/day-clock.mjs';
import { makeTestDir } from './test-tmp.mjs';

function fixture(config = 'day_start_hour: 6\n') {
  const root = makeTestDir('aipa-dayclock-');
  if (config) {
    mkdirSync(join(root, 'user-space'), { recursive: true });
    writeFileSync(join(root, 'user-space', 'llm-provider.yaml'), config, 'utf8');
  }
  return root;
}

test("todayKey uses the local business date and day_start_hour; before 06:00 belongs to yesterday", () => {
  const root = fixture();
  try {
    assert.equal(todayKey(root, { ts: '2026-09-12 07:00:00' }), '2026-09-12', "Local 07:00 is today");
    assert.equal(todayKey(root, { ts: '2026-09-12 05:59:00' }), '2026-09-11', "Local 05:59 belongs to yesterday");
    assert.equal(todayKey(root, { ts: '2026-09-12 00:30:00' }), '2026-09-11', "Early hours belong to the preceding day");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("todayKey differs from UTC date during local 06:00-08:00 (the target regression)", () => {
  const root = fixture();
  try {

    const localDay = todayKey(root, { ts: '2026-09-12 07:00:00' });
    assert.equal(localDay, '2026-09-12');
    assert.notEqual(localDay, new Date('2026-09-12T07:00:00+08:00').toISOString().slice(0, 10), "The UTC date is incorrect during this interval");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("dayStartHour reads llm-provider.yaml, defaults to 6 for missing file/field, and supports customization", () => {
  const a = fixture();
  const b = fixture('day_start_hour: 4\n');
  const c = fixture('');
  try {
    assert.equal(dayStartHour(a), 6);
    assert.equal(dayStartHour(b), 4);
    assert.equal(dayStartHour(c), 6, "Work without a configuration file using the default 6");
    assert.equal(todayKey(b, { ts: '2026-09-12 04:30:00' }), '2026-09-12', "With day_start_hour=4,04:30 is already today");
    assert.equal(todayKey(b, { ts: '2026-09-12 03:59:00' }), '2026-09-11');
  } finally {
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
    rmSync(c, { recursive: true, force: true });
  }
});

test("tsLocal uses YYYY-MM-DD HH:mm:ss local format", () => {
  const s = tsLocal(new Date(2026, 8, 12, 7, 5, 9));
  assert.equal(s, '2026-09-12 07:05:09');
});

test("Shared day boundaries take priority; invalid values are visible and machine overrides are rejected",()=>{
 const root=fixture('day_start_hour: 4\n');try{
 mkdirSync(join(root,'state','hosts','test-host'),{recursive:true});writeFileSync(join(root,'state','host-id'),'test-host\n');
 writeFileSync(join(root,'state','hosts','test-host','llm-provider.yaml'),'day_start_hour: 9\n');
 assert.equal(dayStartHour(root),4);
 for(const value of ['24','-1','6.5','6junk','']){writeFileSync(join(root,'user-space','llm-provider.yaml'),'day_start_hour: '+value+'\n');assert.throws(()=>dayStartHour(root),/from 0 to 23/);}
 }finally{rmSync(root,{recursive:true,force:true});}
});
