import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {datasetVersion,cases,acceptance,material,quotation,reference,outputContract} from './dataset.mjs';
import {hubCheckPaths} from '../support/check-inputs.mjs';
import {SOURCE_ROOT} from '../support/synthetic-fixture.mjs';
import {assertWithin} from '../../product/core-space/scripts/lib/safe-path.mjs';

export const digest=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
export const outputEnvelope='Evaluation output contract (outside the original user input):\n'+outputContract+'\n\nOriginal host prompt follows unchanged:\n';
export const wrapPrompt=actualPrompt=>outputEnvelope+actualPrompt;
export function treeIdentity(base,names){
 const root=resolve(base),files=[];
 function visit(path){path=assertWithin(root,path,{rejectLinks:true});const stat=lstatSync(path);if(stat.isDirectory())for(const name of readdirSync(path).sort())visit(join(path,name));else if(stat.isFile())files.push([relative(root,path).replaceAll('\\','/'),digest(readFileSync(path)),stat.mode&0o111?1:0]);else throw Error('Evaluation accepts only regular public source files');}
 for(const name of [...names].sort())visit(join(root,name));
 return {sha256:digest(files),files};
}
export const coreIdentity=()=>treeIdentity(SOURCE_ROOT,['product/core-space']);
export const hubIdentity=root=>treeIdentity(root,hubCheckPaths(root));
export function programIdentity(){
 const local=readdirSync(import.meta.dirname).filter(name=>name.endsWith('.mjs')).sort().map(name=>'./'+name),dependencies=['../eval/claude-client.mjs','../support/synthetic-fixture.mjs','../support/stage-hub.mjs','../support/check-inputs.mjs'];
 const files=[...local,...dependencies].map(name=>[name,digest(readFileSync(new URL(name,import.meta.url)))]);
 return {sha256:digest(files),files};
}
export function freezeIdentity(){return {datasetVersion,casesSha256:digest(cases),materialSha256:digest({material,reference,quotation,outputContract}),acceptanceSha256:digest(acceptance),program:programIdentity()};}
export function verifyFreeze(expected){const actual=freezeIdentity();if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Representative-language dataset, thresholds, or evaluator changed after freezing; refuse calls or result reuse');return actual;}

export function languageMatches(text,language){
 const letters=[...String(text).matchAll(/\p{L}/gu)].length;if(!letters)return false;
 const count=pattern=>[...text.matchAll(pattern)].length;
 if(language==='zh')return count(/\p{Script=Han}/gu)>=2&&count(/\p{Script=Han}/gu)/letters>=.6;
 if(language==='ja')return count(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu)>=1&&count(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/gu)/letters>=.5;
 if(language==='ar')return count(/\p{Script=Arabic}/gu)>=3&&count(/\p{Script=Arabic}/gu)/letters>=.6;
 if(count(/\p{Script=Latin}/gu)/letters<.8)return false;
 if(language==='es')return /\b(?:cuota|l[i\u00ed]mite|tareas|permitid[oa]s?|evidencia|disponible|proporcionad[oa]|puedo)\b/iu.test(text);
 const functionWords=new Set([...text.toLowerCase().matchAll(/\b(?:the|this|that|does|not|without|which|from|with|there|been)\b/g)].map(match=>match[0]));
 return /\b(?:quota|limit|allowed|tasks|evidence|unavailable|provided|cannot)\b/i.test(text)||functionWords.size>=2;
}
export function semanticMatches(text,language,available){
 if(!available){
  if(language==='zh')return /\u672a|\u6ca1|\u65e0|\u4e0d\u8db3|\u4e0d\u6e05\u695a/u.test(text);
  if(language==='ar')return /\u063a\u064a\u0631|\u0644\u0645|\u0644\u0627|\u0639\u062f\u0645|\u062f\u0648\u0646/u.test(text);
  return /\b(?:not|no|unavailable|insufficient|cannot|missing)\b/i.test(text);
 }
 const digit=/(?<![\p{N}.,/])[7\u0667](?!\p{N}|[.,/]\p{N})/u.test(text);
 const native={en:/\bseven\b/i,es:/\bsiete\b/i,zh:/(?<![\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343])\u4e03(?![\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343])/u,ja:/(?<![\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343])\u4e03(?![\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343])/u,ar:/(?<!\p{L})\u0633\u0628\u0639(?:\u0629)?(?!\p{L})/u};
 const contrary={en:/\b(?:not|isn.t|cannot be)\s+(?:7|seven)\b/i,es:/\bno\s+es\s+(?:7|siete)\b/i,zh:/\u4e0d\u662f|\u5e76\u975e|\u4e0d\u7b49\u4e8e/u,ja:/\u3067\u306f\u3042\u308a\u307e\u305b\u3093|\u3067\u306f\u306a\u3044/u,ar:/\u0644\u064a\u0633|\u0644\u064a\u0633\u062a/u};
 return Boolean((digit||native[language]?.test(text))&&!contrary[language]?.test(text));
}
export function score(item,answer){
 let parsed;try{parsed=JSON.parse(answer);}catch{return {passed:false,formatValid:false,languageValid:false,semanticValid:false,preservationValid:false};}
 const keys=['abstain','answer','decision','quotation','reference'];
 const formatValid=Boolean(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)&&JSON.stringify(Object.keys(parsed).sort())===JSON.stringify(keys)&&typeof parsed.answer==='string'&&parsed.answer.trim()&&typeof parsed.abstain==='boolean'&&['answer_supported','evidence_unavailable'].includes(parsed.decision)&&(parsed.reference===null||typeof parsed.reference==='string')&&(parsed.quotation===null||typeof parsed.quotation==='string'));
 if(!formatValid)return {passed:false,formatValid:false,languageValid:false,semanticValid:false,preservationValid:false};
 const languageValid=languageMatches(parsed.answer,item.language),semanticValid=semanticMatches(parsed.answer,item.language,item.available)&&(item.available?!parsed.abstain&&parsed.decision==='answer_supported':parsed.abstain&&parsed.decision==='evidence_unavailable');
 const preservationValid=item.available?parsed.reference===reference&&parsed.quotation===quotation:parsed.reference===null&&parsed.quotation===null;
 return {passed:formatValid&&languageValid&&semanticValid&&preservationValid,formatValid,languageValid,semanticValid,preservationValid,parsed};
}
export function summarize(results,jobs){
 const completed=results.filter(row=>row.status==='completed');
 const metrics={expected:jobs.length,completed:completed.length,unknown:results.filter(row=>row.status!=='completed').length,formatErrors:completed.filter(row=>!row.score.formatValid).length,languageErrors:completed.filter(row=>!row.score.languageValid).length,semanticErrors:completed.filter(row=>!row.score.semanticValid).length,preservationErrors:completed.filter(row=>!row.score.preservationValid).length};
 const expected=new Set(jobs.map(row=>row.id)),seen=new Set(results.map(row=>row.id));
 return {...metrics,passed:expected.size===acceptance.minimumCalls&&results.length===jobs.length&&seen.size===results.length&&results.every(row=>expected.has(row.id))&&Object.entries(metrics).filter(([key])=>key.endsWith('Errors')||key==='unknown').every(([,value])=>value===0)&&completed.length===jobs.length};
}
