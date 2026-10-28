
import {readFileSync,mkdirSync,existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {extname,join} from 'node:path';
const allowed=['ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','ANTHROPIC_BASE_URL','ANTHROPIC_MODEL','ANTHROPIC_DEFAULT_HAIKU_MODEL','ANTHROPIC_DEFAULT_SONNET_MODEL','ANTHROPIC_DEFAULT_OPUS_MODEL','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY'];
export function createClaudeEvaluationClient({entry,fixture,settingsFile,timeoutMs=180000}){
 if(!entry||!existsSync(entry))throw Error("An installed Claude CLI entry must be supplied explicitly");
 const settings=settingsFile?JSON.parse(readFileSync(settingsFile,'utf8').replace(/^\uFEFF/,'')):{};
 const environment={...fixture.env(),...Object.fromEntries(allowed.filter(key=>typeof process.env[key]==='string').map(key=>[key,process.env[key]])),...Object.fromEntries(allowed.filter(key=>typeof settings.env?.[key]==='string').map(key=>[key,settings.env[key]]))};
 if(!environment.ANTHROPIC_API_KEY&&!environment.ANTHROPIC_AUTH_TOKEN)throw Error("Isolated evaluation received no explicit API credentials; do not fall back to OAuth, keychain, or apiKeyHelper");
 const config=fixture.path('claude-config'),work=fixture.path('claude-work');mkdirSync(config,{recursive:true});mkdirSync(work,{recursive:true});environment.CLAUDE_CONFIG_DIR=config;
 const js=['.js','.mjs'].includes(extname(entry));let calls=0;
 async function run(prompt){
  calls++;const started=Date.now();
  const args=[...(js?[entry]:[]),'--print','--bare','--tools','','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--disable-slash-commands','--no-session-persistence','--max-turns','1','--setting-sources','','--system-prompt',"You evaluate questions against closed material. Answer only from the supplied synthetic material. Tools, networking, file access, and external knowledge are prohibited. Output exactly the requested JSON.",'--output-format','json'];
  return new Promise((resolve,reject)=>{
   const child=spawn(js?process.execPath:entry,args,{cwd:work,env:environment,windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});let stdout='',overflow=false;
   const timer=setTimeout(()=>{child.kill();reject(Error("Model outcome unknown: timeout; no automatic retry"));},timeoutMs);
   child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{stdout+=chunk;if(stdout.length>2000000){overflow=true;child.kill();}});
   
   child.stderr.resume();child.on('error',()=>{clearTimeout(timer);reject(Error("The model executor could not start"));});
   child.on('close',code=>{clearTimeout(timer);let data;try{data=JSON.parse(stdout);}catch{}
    if(code!==0||data?.is_error||typeof data?.result!=='string'||overflow){reject(Error("The model did not complete this turn; exit "+code+"; no automatic retry"));return;}
    resolve({answer:data.result,elapsedMs:Date.now()-started,usage:data.usage||null,models:Object.keys(data.modelUsage||{}),reportedCostUsd:typeof data.total_cost_usd==='number'?data.total_cost_usd:null});
   });child.stdin.on('error',()=>{});child.stdin.end(prompt,'utf8');
  });
 }
 return{run,calls:()=>calls,model:environment.ANTHROPIC_MODEL||settings.model||'configured-default',isolation:{syntheticWorkingDirectory:true,tools:false,mcp:false,skills:false,personalInstructions:false,sessionPersistence:false,credentialContentsRecorded:false}};
}
