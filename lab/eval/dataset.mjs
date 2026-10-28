
export const DATASET_VERSION=1;
const topics=[
 ["Output format","Use a numbered list for conclusions and put evidence afterward.","How should the answer organize its key points",'global'],
 ["Review cadence","Check tasks every Wednesday and review goals on the first day of each month.","When should tasks be checked",'global'],
 ["Source attribution","External conclusions must cite their original sources.","What should accompany references to other people's views",'global'],
 ["Meeting minutes","Minutes include decisions, owners, and deadlines.","What must be recorded after a meeting",'global'],
 ["Glossary","Expand an abbreviation the first time it appears.","How should an abbreviation be introduced",'global'],
 ["Skyline deployment","The Skyline project requires two reviewers before release.","Which review must precede Skyline deployment",'project'],
 ["Stream backups","The Stream project saves incremental copies daily.","How does Stream retain daily data",'project'],
 ["Starbridge budget","The Starbridge project calculates its resource budget weekly.","How often does Starbridge check resource spending",'project'],
 ["Greenmist testing","The Greenmist project runs end-to-end regression after changes.","How does Greenmist verify the complete workflow after a change",'project'],
 ["FarSail delivery","The FarSail delivery package must include rollback guidance.","What materials must FarSail deliver to users",'project'],
 ["RockSpring encoding","RockSpring source files use UTF-8.","Which character encoding does RockSpring use for text",'project'],
 ["Dewdrop logs","The Dewdrop project retains request IDs for debugging.","How does Dewdrop correlate requests after an error",'project'],
 ["Swiftwing permissions","New Swiftwing permissions require human review.","How is expanded Swiftwing access approved",'project'],
 ["Egret acceptance","The Egret project performs acceptance testing with synthetic orders.","Which type of orders does Egret use for delivery verification",'project'],
 ["Spruce naming","Spruce interface paths use lowercase nouns.","How does Spruce name its interfaces",'project'],
 ["Temporary window","The trial maintenance window is Saturday morning.","When is maintenance performed during the trial",'temporary'],
 ["Previous address","Trial documentation is hosted on synthetic site Alpha.","Where is the trial documentation hosted",'temporary'],
 ["Phase goal","The trial phase verifies offline capabilities only.","Which capabilities does the trial phase verify",'temporary'],
 ["Temporary limit","The trial runs at most two jobs concurrently.","What is the trial concurrency limit",'temporary'],
 ["Transition format","The trial export uses CSV.","Which export format does the trial use",'temporary'],
 ["Withdrawn channel","The proposed email notification channel has been withdrawn.","Can the previous notification channel be used",'revoked'],
 ["Withdrawn list","The proposed candidate member list has been withdrawn.","Is the previous candidate list still valid",'revoked'],
 ["Withdrawn rule","The proposed automatic approval rule has been withdrawn.","Can changes still be approved automatically",'revoked'],
 ["Change approval","Current change approval requires an explicit human decision.","How are changes approved now",'corrected'],
 ["Build evidence","Current build evidence must record the source digest and test results.","Which verification materials must current builds retain",'corrected'],
];
export const facts=topics.map(([title,body,paraphrase,mode],i)=>({key:'synthetic-'+String(i+1).padStart(2,'0'),title,body,paraphrase,mode,project:mode==='project'?'synthetic-p'+i:'',split:i%5<3?'dev':'frozen'}));
export const cases=facts.flatMap(f=>[
 {id:f.key+'-literal',split:f.split,fact:f.key,query:f.title,project:f.project,at:f.mode==='temporary'?'2026-10-15':'2026-10-24',expected:f.mode==='revoked'?null:f.key,category:'literal'},
 {id:f.key+'-paraphrase',split:f.split,fact:f.key,query:f.paraphrase,project:f.project,at:f.mode==='temporary'?'2026-10-15':'2026-10-24',expected:f.mode==='revoked'?null:f.key,category:'paraphrase'},
 {id:f.key+'-boundary',split:f.split,fact:f.key,query:f.title,project:f.mode==='project'?'synthetic-other':f.project,at:'2026-11-10',expected:['temporary','project','revoked'].includes(f.mode)?null:f.key,category:f.mode==='project'?'project-isolation':f.mode==='temporary'?'expiry':f.mode==='revoked'?'revocation':'fresh-session'},
 {id:f.key+'-missing',split:f.split,fact:f.key,query:f.title+" has a contact phone number that was not supplied",project:f.project,at:'2026-10-24',expected:null,category:'insufficient-detail'},
]);
export const thresholds={mrrGain:0.05,maxFalsePositiveIncrease:0.01,maxComputeLatencyRatio:2,scopeOrValidityViolations:0};
