
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const lib=fileURLToPath(new URL('../../product/core-space/scripts/lib/',import.meta.url));
export const AGENDA_READERS=['agenda-records.mjs','reminders.mjs','reminder-plugin.mjs','agenda-provider.mjs'];
export const agendaDigest=bytes=>createHash('sha256').update(String(bytes).replace(/\r\n/g,'\n')).digest('hex');
export function agendaInterface(){return{version:1,provider:'aipa-signal agenda',schemas:[1,2],writer_schema:2,files:Object.fromEntries(AGENDA_READERS.map(p=>[p,agendaDigest(readFileSync(join(lib,p),'utf8'))]))};}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const expected=JSON.stringify(agendaInterface(),null,2)+'\n',target=join(lib,'agenda-interface.json');
 if(process.argv.includes('--write'))writeFileSync(target,expected);
 else if(readFileSync(target,'utf8').replace(/\r\n/g,'\n')!==expected)throw Error("The native agenda interface digest is stale; regenerate and verify it");
}
