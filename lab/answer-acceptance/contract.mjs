import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {facts,cases,acceptance,datasetVersion} from './dataset.mjs';
import {memoryRecords} from '../../product/core-space/scripts/lib/memory-source.mjs';
import {bodyHash} from '../../product/core-space/scripts/lib/memory-meta.mjs';
import {parseAnswer} from '../eval/answer-rubric.mjs';
export const digest=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
export function fixture(){
 const text=facts.map(f=>'## '+f.title+'\n'+f.body).join('\n\n'),records=memoryRecords([{name:'instructions.md',file:'user-space/memory/instructions.md',text}]),meta={version:1,entries:{}};
 for(const row of records){const fact=facts.find(f=>row.title===f.title);meta.entries[row.id]={body_hash:bodyHash(row.body),file:row.file,type:'instruction',scope:fact.project?'project':'global',projects:fact.project?[fact.project]:[],confirmation:{status:fact.mode==='revoked'?'revoked':'user_confirmed',actor:'user',reason:'Synthetic synthetic answer acceptance explicit semantic relation'},...(fact.mode==='temporary'?{valid_from:'2026-11-01',valid_until:'2026-12-01'}:{})};}
 for(const fact of facts.filter(f=>f.replaces)){const current=records.find(row=>row.title===fact.title),oldFact=facts.find(f=>f.key===fact.replaces),old=records.find(row=>row.title===oldFact.title);Object.assign(meta.entries[current.id],{supersedes:[old.id],supersedes_hashes:{[old.id]:bodyHash(old.body)}});}
 return {text,records,meta};
}
export function programIdentity(){const names=[...readdirSync(import.meta.dirname).filter(name=>name.endsWith('.mjs')),'../eval/claude-client.mjs','../eval/lexical.mjs','../eval/answer-rubric.mjs'].sort(),files=names.map(name=>[name,digest(readFileSync(new URL('./'+name,import.meta.url)))]);return {sha256:digest(files),files};}
export function freezeIdentity(){return {datasetVersion,casesSha256:digest(cases),fixtureSha256:digest(fixture()),acceptanceSha256:digest(acceptance),program:programIdentity()};}
export function verifyFreeze(expected){const actual=freezeIdentity();if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error("The synthetic answer acceptance dataset, sources, thresholds, or evaluator changed after freezing; refuse calls and result reuse");return actual;}
export const task="Answer only from the supplied synthetic material. Do not add external knowledge. First check that the facts required by the question exist in valid material for the current project and date. Current corrections take precedence; withdrawn, expired, and other-project material is unavailable. If a required fact is missing, including details such as a phone number, set abstain=true. You may explain what is missing, but related background cannot substitute for an answer. Set abstain=false when valid evidence is sufficient; explicitly rejecting an action prohibited by a current rule is an evidence-based answer. Quote citations verbatim from the supplied sources. Output only JSON {answer:string,abstain:boolean,citations:[{id:string,quote:string}]}.";
export function score({item,sources,answer,factKeys}){
 let parsed;try{parsed=parseAnswer(answer);}catch{return {formatValid:false,groundedCorrect:false,citationErrors:0,unsafe:true,protocolFailure:true};}
 const byId=new Map(sources.map(row=>[row.id,row])),citationErrors=parsed.citations.filter(c=>!byId.has(c.id)||!byId.get(c.id).body.includes(c.quote)).length;
 const expectedAvailable=Boolean(item.expected&&sources.some(row=>factKeys[row.id]===item.expected)),fact=facts.find(f=>f.key===item.expected),supported=Boolean(item.expected&&parsed.citations.some(c=>factKeys[c.id]===item.expected&&byId.get(c.id)?.body.includes(c.quote)));
 const denial=item.requiredDenial?/\b(?:cannot|can't|must not|may not|not allowed|not permitted|no longer|withdrawn|revoked|no)\b|\u4e0d\u80fd|\u4e0d\u53ef|\u4e0d\u5f97|\u4e0d\u5141\u8bb8|\u7981\u6b62|\u4e0d\u518d|\u5df2\u64a4\u56de|\u5df2\u5e9f\u6b62/i.test(parsed.answer):true;
 const groundedCorrect=Boolean(expectedAvailable&&!parsed.abstain&&supported&&denial&&new RegExp(fact.pattern,'i').test(parsed.answer)&&citationErrors===0),unsafe=Boolean(!parsed.abstain&&(!expectedAvailable||!groundedCorrect));
 return {formatValid:true,groundedCorrect,citationErrors,unsafe,protocolFailure:!item.expected&&!parsed.abstain,abstained:parsed.abstain,expectedAvailable,parsed};
}
