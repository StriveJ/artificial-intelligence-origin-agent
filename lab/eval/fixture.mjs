
import {createHash} from 'node:crypto';
import {facts,cases,thresholds,DATASET_VERSION} from './dataset.mjs';
import {memoryRecords} from '../../product/core-space/scripts/lib/memory-source.mjs';
import {bodyHash} from '../../product/core-space/scripts/lib/memory-meta.mjs';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function evaluationFixture(){
 const text=[...facts.map(x=>'## '+x.title+'\n'+x.body),...facts.filter(x=>x.mode==='corrected').map(x=>'## '+x.title+"Historical version\nSynthetic superseded instruction for "+x.title+"; retained for history only and no longer applicable.")].join('\n\n');
 const records=memoryRecords([{name:'instructions.md',file:'user-space/memory/instructions.md',text}]),meta={version:1,entries:{}};
 for(const row of records){const fact=facts.find(x=>x.title===row.title||x.title+"Historical version"===row.title);meta.entries[row.id]={body_hash:bodyHash(row.body),file:row.file,type:'instruction',projects:fact.project?[fact.project]:[],scope:fact.project?'project':'global',...(fact.mode==='temporary'?{valid_from:'2026-10-01',valid_until:'2026-11-01'}:{}),confirmation:{status:fact.mode==='revoked'?'revoked':'user_confirmed',actor:'user',reason:'Synthetic fixture declaration'}};}
 for(const fact of facts.filter(x=>x.mode==='corrected')){const current=records.find(r=>r.title===fact.title),old=records.find(r=>r.title===fact.title+"Historical version");Object.assign(meta.entries[current.id],{supersedes:[old.id],supersedes_hashes:{[old.id]:bodyHash(old.body)}});}
 return {text,records,meta};
}
export function freezeHashes({fixture=evaluationFixture(),questions=cases,acceptance=thresholds}={}){
 const frozen=questions.filter(c=>c.split==='frozen');
 return {frozenCaseSha256:digest(frozen),frozenFixtureSha256:digest({schema:1,datasetVersion:DATASET_VERSION,fixture,frozen,thresholds:acceptance})};
}
export function verifyFreeze(expected,input){
 const actual=freezeHashes(input);
 if(actual.frozenCaseSha256!==expected.frozenCaseSha256)throw Error("The frozen dataset changed; independent review and an explicit new frozen identity are required");
 if(actual.frozenFixtureSha256!==expected.frozenFixtureSha256)throw Error("The frozen corpus, metadata, expected evidence, or thresholds changed; independent review is required");
 return actual;
}
