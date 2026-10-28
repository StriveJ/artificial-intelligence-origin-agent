import { readFileSync,writeFileSync } from 'node:fs';
import { strictArgs } from '../../product/core-space/scripts/lib/strict-args.mjs';
import { packageArtifact,sha256 } from '../../product/core-space/scripts/lib/release-package.mjs';
import { assertDisjointPaths } from '../../product/core-space/scripts/lib/safe-path.mjs';
try{
 const a=strictArgs(process.argv.slice(2),{values:['artifact','out']});if(!a.artifact||!a.out)throw new Error("--artifact and --out are required");assertDisjointPaths(a.artifact,a.out);
 const bytes=packageArtifact(a.artifact);writeFileSync(a.out,bytes,{flag:'wx'});writeFileSync(a.out+'.sha256',sha256(bytes)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'packaged-local',bytes:readFileSync(a.out).length,sha256:sha256(bytes),published:false}));
}catch(error){console.error(error.message);process.exitCode=1;}
