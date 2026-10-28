import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { verifyChecksums } from '../product/core-space/scripts/lib/origin-checksums.mjs';
function arg(n){const i=process.argv.indexOf('--'+n);return i>=0?process.argv[i+1]:'';}
const repo=arg('repo');
if(!repo){console.error("Missing --repo");process.exit(1);}
const REQUIRED=['core-space/policy.md','user-space','scripts/aipa-init.mjs','AGENTS.md','ORIGIN-MANIFEST.yaml','framework.md'];
const FORBIDDEN=['studio','lab','CODEOWNERS','CLAUDE.md','MAINTAINERS.md','BUILD-MANIFEST.yaml'];
const missing=REQUIRED.filter(p=>!existsSync(join(repo,p)));
const leaked=FORBIDDEN.filter(p=>existsSync(join(repo,p)));
if(missing.length){console.error("Missing contract: "+missing.join(', '));process.exit(1);}
if(leaked.length){console.error("Internal asset leak: "+leaked.join(', '));process.exit(1);}
try{verifyChecksums(repo);}catch(error){console.error("Artifact integrity verification failed: "+error.message);process.exit(1);}
console.log('verify ok');
