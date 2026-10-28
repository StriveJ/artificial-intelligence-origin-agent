
//

//


import { mkdirSync, mkdtempSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertWithin } from '../../../../../product/core-space/scripts/lib/safe-path.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..');
const DIR_NAME = 'aipa-test-tmp';

function ensure(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function testRoot() {
  const fromEnv = String(process.env.AIPA_TEST_TMP || '').trim();
  const allowed=join(REPO_ROOT,'lab','.upgrade-runs');
  return ensure(assertWithin(allowed,fromEnv?resolve(fromEnv):join(allowed,DIR_NAME),{allowRoot:true,rejectLinks:true}));
}

export function makeTestDir(prefix = 'aipa-') {
  return mkdtempSync(join(testRoot(), prefix));
}
