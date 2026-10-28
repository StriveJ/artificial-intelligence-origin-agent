import {writeFileSync,existsSync} from 'node:fs';
import {freezeIdentity} from './contract.mjs';
if(process.argv.length!==2)throw Error("Freeze does not accept overwrite or other arguments");
const path=new URL('./freeze.json',import.meta.url);if(existsSync(path))throw Error("A frozen identity already exists and will not be overwritten; create and review a new generation for changes");
writeFileSync(path,JSON.stringify(freezeIdentity(),null,2)+'\n');console.log(JSON.stringify({status:'frozen',path:path.pathname,modelCalls:0}));
