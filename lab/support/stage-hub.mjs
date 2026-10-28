import { cpSync, readdirSync, mkdirSync, lstatSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { hubCheckPaths } from './check-inputs.mjs';
function rejectLinks(path) {
  const stat=lstatSync(path);if(stat.isSymbolicLink())throw Error("Public source entries must not contain links");
  if(stat.isDirectory())for(const entry of readdirSync(path))rejectLinks(join(path,entry));
  else if(!stat.isFile())throw Error("Public source accepts only directories and regular files");
}

export function stageHubSource(source, fixture) {
  const target=fixture.path('hub-source');mkdirSync(target);
  const names=[...hubCheckPaths(source),...(existsSync(join(source,'node_modules'))?['node_modules']:[])];
  for(const name of names)rejectLinks(join(source,name));
  for(const name of names){mkdirSync(dirname(join(target,name)),{recursive:true});cpSync(join(source,name),join(target,name),{recursive:true,dereference:false});}
  return target;
}
