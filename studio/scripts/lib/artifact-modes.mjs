import { execFileSync } from 'node:child_process';
import { chmodSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isOwnRepository } from '../../../product/core-space/scripts/lib/git-staging.mjs';


export function sourceExecutables(root) {
  if (!isOwnRepository(root)) return [];
  const entries = execFileSync('git', ['-C', root, 'ls-files', '--stage', '-z', '--', 'product/'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  return entries.filter(e => e.startsWith('100755 ')).map(e => e.slice(e.indexOf('\t') + 1).slice('product/'.length));
}
export function applyWorkingModes(root, files) {
  if (process.platform === 'win32') return;
  for (const file of files) { const path=join(root,file); chmodSync(path, statSync(path).mode | 0o111); }
}
export function applyIndexModes(root, files, executables) {
  const marked = new Set(executables), yes = files.filter(p => marked.has(p)), no = files.filter(p => !marked.has(p));
  const git = args => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
  if (no.length) git(['update-index', '--chmod=-x', '--', ...no]);
  if (yes.length) git(['update-index', '--chmod=+x', '--', ...yes]);
}

export function collectBuildSource(root) {
  if(!isOwnRepository(root))return null;
  const git=args=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:'pipe'}).trim();
  let commit;try{commit=git(['rev-parse','HEAD']);}catch{return null;}
  let branch;try{branch=git(['symbolic-ref','--short','HEAD']);}catch{branch='detached';}
  return {schema:1,commit,branch,dirty:Boolean(git(['status','--porcelain','--','product/','studio/scripts/','studio/hooks/','.gitattributes']))};
}


export function committedProduct(root, files) {
  if (!isOwnRepository(root)) return null;
  const git = (args, options = {}) => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe', maxBuffer: 256 * 1024 * 1024, ...options });
  let commit; try { commit = git(['rev-parse', '--verify', 'HEAD']).toString().trim(); } catch { return null; }
  if (git(['status', '--porcelain', '--untracked-files=all', '--', 'product/']).length) return null;
  const rows = git(['ls-tree', '-rz', '--full-tree', commit, '--', 'product/']).toString('utf8').split('\0').filter(Boolean).map(line => {
    const match = line.match(/^(100644|100755) blob ([a-f0-9]+)\t(.+)$/);
    if (!match) throw new Error("Build objects contain non-regular files");
    return { oid: match[2], path: match[3] };
  });
  const expected = new Set(files);
  if (rows.length !== expected.size || rows.some(row => !expected.has(row.path))) throw new Error("Build-object files differ from the product file set");
  const bytes = git(['cat-file', '--batch'], { input: rows.map(row => row.oid).join('\n') + '\n' }), contents = new Map();
  let offset = 0;
  for (const row of rows) {
    const end = bytes.indexOf(10, offset), header = bytes.subarray(offset, end).toString('ascii').match(/^([a-f0-9]+) blob (\d+)$/);
    if (end < 0 || !header || header[1] !== row.oid) throw new Error("Invalid build-object response");
    const size = Number(header[2]), start = end + 1, finish = start + size;
    if (!Number.isSafeInteger(size) || finish >= bytes.length || bytes[finish] !== 10) throw new Error("Truncated build-object content");
    contents.set(row.path, bytes.subarray(start, finish)); offset = finish + 1;
  }
  if (offset !== bytes.length || git(['rev-parse', 'HEAD']).toString().trim() !== commit) throw new Error("Source changed during the build");
  return { commit, contents };
}
