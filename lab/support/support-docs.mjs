
import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {coreSupportMarkdown} from '../../product/core-space/scripts/lib/support-contract.mjs';
import {strictArgs} from '../../product/core-space/scripts/lib/strict-args.mjs';
import {SOURCE_ROOT} from './synthetic-fixture.mjs';
export function supportBlock(text,kind){const begin='<!-- aipa-support:'+kind+':begin -->',end='<!-- aipa-support:'+kind+':end -->';if(text.split(begin).length!==2||text.split(end).length!==2||text.indexOf(end)<text.indexOf(begin))throw Error("Support declaration region is missing or duplicated: "+kind);return {before:text.slice(0,text.indexOf(begin)+begin.length),after:text.slice(text.indexOf(end)),body:text.slice(text.indexOf(begin)+begin.length,text.indexOf(end)).trim()};}
export function checkSupportBlock(text,kind,expected){if(supportBlock(text,kind).body.replace(/\r\n/g,'\n')!==expected)throw Error("Support declaration differs from the source contract: "+kind);}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const args=strictArgs(process.argv.slice(2),{values:['hub-source'],flags:['write']});if(!args['hub-source'])throw Error("Supply public --hub-source explicitly; do not discover real installations");
 const hub=resolve(args['hub-source']),{hubSupportMarkdown}=await import(pathToFileURL(join(hub,'lib/support-contract.mjs')).href);
 for(const [path,kind,expected] of [[join(SOURCE_ROOT,'product/core-space/shared-contracts.md'),'core',coreSupportMarkdown()],[join(hub,'README.md'),'hub',hubSupportMarkdown()]]){
  const text=readFileSync(path,'utf8');if(args.write){const part=supportBlock(text,kind);writeFileSync(path,part.before+'\n'+expected+'\n'+part.after);}else checkSupportBlock(text,kind,expected);
 }
 console.log(JSON.stringify({status:args.write?'generated':'verified',scope:'public-contract-documentation',personalDataInspected:false}));
}
