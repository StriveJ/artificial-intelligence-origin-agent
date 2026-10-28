import {readdirSync,readFileSync,lstatSync} from 'node:fs';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {SOURCE_ROOT} from './synthetic-fixture.mjs';


export function snapshotInputs(paths) {
  const rows=[];
  function walk(path) {
    const stat=lstatSync(path);if(stat.isSymbolicLink())throw Error("Acceptance source must not contain links");
    if(stat.isDirectory())for(const name of readdirSync(path).sort())walk(join(path,name));
    else if(stat.isFile())rows.push([relative(SOURCE_ROOT,path).replaceAll('\\','/'),createHash('sha256').update(readFileSync(path)).digest('hex')]);
    else throw Error("Acceptance source must be regular files");
  }
  for(const path of paths)walk(path);
  return {sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex'),files:rows};
}
