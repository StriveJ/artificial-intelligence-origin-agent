import { mkdirSync, readdirSync, statSync, existsSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDisjointPaths } from '../../product/core-space/scripts/lib/safe-path.mjs';
import { artifactFiles, writeChecksums } from '../../product/core-space/scripts/lib/origin-checksums.mjs';
import { sourceExecutables, applyWorkingModes, collectBuildSource, committedProduct } from './lib/artifact-modes.mjs';
import { withBuildSource } from '../../product/core-space/scripts/lib/build-source.mjs';
import { UPDATE_CONTRACT } from '../../product/core-space/scripts/lib/update-contract.mjs';
import { publicContentViolations } from '../../product/core-space/scripts/lib/public-content.mjs';
function arg(n){const i=process.argv.indexOf('--'+n);return i>=0?process.argv[i+1]:'';}
const src=arg('src')||'.';
const dest=arg('dest')||'dist';
const PRODUCT='product';
const sourceDir = resolve(src, PRODUCT);
try {
  if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) throw new Error("Missing valid product source directory");
  assertDisjointPaths(sourceDir, dest);
  if (!artifactFiles(sourceDir).length) throw new Error("The product source directory is empty");
} catch (error) { console.error("Assembly preflight failed: " + error.message); process.exit(1); }

const FILES=artifactFiles(sourceDir).map(rel=>PRODUCT+'/'+rel);
const canonical=committedProduct(src,FILES),buildSource=collectBuildSource(src),executables=sourceExecutables(src);
if(canonical&&buildSource?.commit!==canonical.commit)throw new Error("Build-source commit changed");
const contents=canonical?.contents||new Map(FILES.map(path=>[path,readFileSync(join(src,path))]));

try{
  execFileSync('node',[join(resolve(dirname(fileURLToPath(import.meta.url))),'aipa-content-policy.mjs'),'--root',src],{stdio:'inherit'});
}catch{
  console.error("Content policy blocked assembly");
  process.exit(1);
}

for(const [path,bytes]of contents)if(!bytes.includes(0)){
  const violations=publicContentViolations(bytes.toString('utf8'));
  if(violations.length){console.error("Content policy blocked the actual delivery object: "+path+' '+violations.join('、'));process.exit(1);}
}
if(JSON.stringify(collectBuildSource(src))!==JSON.stringify(buildSource))throw new Error("Source changed during assembly preflight");

if(existsSync(dest)) for(const n of readdirSync(dest)) if(n!=='.git') rmSync(join(dest,n),{recursive:true,force:true});
for(const f of FILES){
  const s=join(src,f); if(!existsSync(s)) throw new Error("Source files disappeared during assembly; success cannot be reported");
  const t=join(dest,f.replace(/^product\//,'')); mkdirSync(join(t,'..'),{recursive:true}); writeFileSync(t,contents.get(f));
}
const manifest=join(dest,'ORIGIN-MANIFEST.yaml');
if(existsSync(manifest))writeFileSync(manifest,withBuildSource(readFileSync(manifest,'utf8'),buildSource),'utf8');
writeFileSync(join(dest,'update-contract.json'),JSON.stringify({...UPDATE_CONTRACT,executables:executables.filter(p=>FILES.includes(PRODUCT+'/'+p))},null,2)+'\n');
const checksums = writeChecksums(dest);
applyWorkingModes(dest, executables.filter(p => checksums.has(p)));
console.log(`assembled ${checksums.size} files`);
