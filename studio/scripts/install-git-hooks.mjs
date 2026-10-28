import { readFileSync, writeFileSync, mkdirSync, readdirSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isOwnRepository } from '../../product/core-space/scripts/lib/git-staging.mjs';
function arg(n){const i=process.argv.indexOf('--'+n);return i>=0?process.argv[i+1]:'';}
const root=arg('root')||'.';
const hooksDir=resolve(dirname(fileURLToPath(import.meta.url)),'..','hooks');
if (!isOwnRepository(root)) { console.error("Not an independent Git root; refusing to install hooks in a parent repository"); process.exit(1); }

const gitHooks = execFileSync('git', ['-C', root, 'rev-parse', '--path-format=absolute', '--git-path', 'hooks'], { encoding: 'utf8' }).trim();
mkdirSync(gitHooks, { recursive: true });
for(const f of readdirSync(hooksDir)){
  const target = join(gitHooks, f);
  writeFileSync(target, readFileSync(join(hooksDir,f),'utf8').replace(/\r\n/g, '\n'));
  if (process.platform !== 'win32') chmodSync(target, 0o755);
}
console.log(`installed ${readdirSync(hooksDir).length} hooks at ${gitHooks}`);
