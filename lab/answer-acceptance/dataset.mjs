
export const datasetVersion=1;
const families=[
 ["Mistpine","light gray","light gray",'fir-bin',"one hundred and twenty","120|one hundred and twenty","two people","two people|2 people|two reviewers"],
 ["Starfield","ivory","ivory",'river-bin',"eighty","80|eighty","three people","three people|3 people|three reviewers"],
 ["Sandstone","dark green","dark green",'stone-bin',"sixty","60|sixty","four people","four people|4 people|four reviewers"],
 ["Greenleaf","light purple","light purple",'leaf-bin',"ninety","90|ninety","five people","five people|5 people|five reviewers"],
 ["Cloudmist","sky blue","sky blue",'mist-bin',"seventy","70|seventy","two people","two people|2 people|two reviewers"],
];
export const facts=families.flatMap(([name,color,colorPattern,folder,quota,quotaPattern,reviewers,reviewerPattern],group)=>{
 const prefix='synthetic-family-'+(group+1),split=[1,4].includes(group)?'frozen':'dev';
 return [
  {key:prefix+'-color',title:name+"Cover",body:name+"The document cover uses "+color+'.',pattern:colorPattern,mode:'global',project:'',query:name+"What color is the document cover"},
  {key:prefix+'-folder',title:name+"Archive directory",body:name+"The project archive directory is "+folder+'.',pattern:folder,mode:'project',project:'synthetic-'+prefix,query:name+"Where are the project documents archived"},
  {key:prefix+'-quota',title:name+"Trial quota",body:name+"The trial quota is "+quota+" records.",pattern:quotaPattern,mode:'temporary',project:'',query:name+"How many records does this trial allow"},
  {key:prefix+'-old',title:name+"Previous release rule",body:name+"The previous rule allowed automatic releases, but has been withdrawn.",pattern:"automatic releases",mode:'revoked',project:'',replacementKey:prefix+'-current',query:name+"Can releases still run automatically under the previous rule"},
  {key:prefix+'-current',title:name+"Current release rule",body:"Current "+name+" releases require "+reviewers+" to review them; the previous automatic release rule is prohibited.",pattern:reviewerPattern,mode:'corrected',project:'',replaces:prefix+'-old',query:name+"How many people must review the current release"},
 ].map(row=>({...row,split,family:prefix}));
});
export const cases=facts.flatMap(fact=>[
 {id:fact.key+'-literal',query:fact.mode==='revoked'?fact.title.replace("Previous release rule","Which rule governs the current release"):fact.title,expected:fact.replacementKey||fact.key,category:fact.mode==='revoked'?'replacement-rule':'literal'},
 {id:fact.key+'-paraphrase',query:fact.query,expected:fact.replacementKey||fact.key,category:fact.mode==='revoked'?'replacement-denial':'paraphrase',...(fact.mode==='revoked'?{requiredDenial:true}:{})},
 {id:fact.key+'-boundary',query:fact.mode==='revoked'?fact.title+" has an original approval number that was not supplied; what is it":fact.title,expected:['temporary','project','revoked'].includes(fact.mode)?null:fact.key,category:fact.mode==='temporary'?'expiry':fact.mode==='project'?'scope':fact.mode==='revoked'?'missing-withdrawn-detail':'new-session'},
 {id:fact.key+'-missing',query:fact.title+" has an owner phone number that was not supplied; what is it",expected:null,category:'insufficient-detail'},
].map(row=>({...row,split:fact.split,fact:fact.key,project:fact.mode==='project'&&row.category==='scope'?'synthetic-other':fact.project,at:row.category==='expiry'?'2026-12-20':'2026-11-20'})));
export const acceptance={schema:4,positiveGroundedCorrectRate:.75,maxNegativeUnsafeRate:.05,maxCitationErrors:0,maxFormatErrors:0,scopeOrValidityViolations:0,minimumCalls:300};
