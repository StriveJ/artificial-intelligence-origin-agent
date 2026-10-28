import { verifyChecksums,verifyOriginShape } from '../../product/core-space/scripts/lib/origin-checksums.mjs';
function arg(name){ const i=process.argv.indexOf('--'+name); return i>=0 ? process.argv[i+1] : ''; }
const dir=arg('origin')||'.';
try{verifyOriginShape(dir);}catch(error){console.error(error.message);process.exit(1);}
if(process.argv.includes('--strict')){
  try{
    verifyChecksums(dir);
    verifyOriginShape(dir,{strict:true});
  }catch(error){console.error("Strict artifact validation failed: "+error.message);process.exit(1);}
}
console.log('origin valid');
