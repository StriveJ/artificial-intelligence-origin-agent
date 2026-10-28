
import { execFileSync } from 'node:child_process';
import { cpSync, writeFileSync, existsSync } from 'node:fs';
import { writeChecksums } from '../../../../../product/core-space/scripts/lib/origin-checksums.mjs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './test-tmp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));                          // .../lab/tests/core-space/scripts/lib
export const PRODUCT = resolve(HERE, '..', '..', '..', '..', '..', 'product'); // <origin>/product

export function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
}

export function commitAll(root, msg) {
  if (existsSync(join(root, 'ORIGIN-MANIFEST.yaml'))) writeChecksums(root);
  git(root, ['add', '-A']);
  execFileSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', msg], { encoding: 'utf8' });
}

export function commitOne(root, path, content, msg) {
  writeFileSync(join(root, path), content);
  const artifact = existsSync(join(root, 'ORIGIN-MANIFEST.yaml'));
  if (artifact) writeChecksums(root);
  git(root, ['add', path, ...(artifact ? ['origin-checksums.txt'] : [])]);
  execFileSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', msg], { encoding: 'utf8' });
}


export function makeOrigin(version) {
  const p = makeTestDir('origin-base-');
  cpSync(PRODUCT, p, { recursive: true });
  writeFileSync(join(p, 'ORIGIN-MANIFEST.yaml'), `origin:\n  version: ${version}\n  assist_prefix: "AIPA ${version.split('.')[1]} collaborates with you: "\n`);
  writeFileSync(join(p, 'VERSION'), version + '\n');
  git(p, ['init', '-q']);
  commitAll(p, 'base ' + version);
  return p;
}





export function makeChannelOrigin(baseVersion, betaVersion, extra = 'core-space/scripts/aipa-beta-only.mjs') {
  const p = makeOrigin(baseVersion);
  const main = git(p, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  git(p, ['checkout', '-q', '-b', 'beta']);
  writeFileSync(join(p, extra), "// Framework file present only on beta; baseline/upstream use beta while the default branch lacks it.\n");
  writeFileSync(join(p, 'ORIGIN-MANIFEST.yaml'), `origin:\n  version: ${betaVersion}\n  channel: beta\n  assist_prefix: "AIPA ${betaVersion.split('.')[1]} collaborates with you: "\n`);
  writeFileSync(join(p, 'VERSION'), betaVersion + '\n');
  commitAll(p, 'beta ' + betaVersion);
  git(p, ['checkout', '-q', main]);
  return p;
}
