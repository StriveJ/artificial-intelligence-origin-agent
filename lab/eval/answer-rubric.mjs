
const terms=[
 [/\u7f16\u53f7|\u5e8f\u53f7/,/\u8bc1\u636e/,/\u4e4b\u540e|\u540e\u9762|\u540e\u7f6e/],
 [/\u5468\u4e09|\u661f\u671f\u4e09/,/\u6bcf\u6708.*(\u9996\u65e5|1\u65e5|\u4e00\u65e5|\u7b2c\u4e00\u5929)/],
 [/\u539f\u59cb.*(\u51fa\u5904|\u6765\u6e90)/],
 [/\u51b3\u5b9a|\u51b3\u7b56/,/\u8d1f\u8d23\u4eba|\u8d23\u4efb\u4eba/,/\u622a\u6b62|\u671f\u9650/],
 [/\u5168\u79f0|\u5b8c\u6574\u540d\u79f0|\u5b8c\u6574\u540d/],
 [/\u4e24\u4eba|\u4e24\u4f4d|2\u4eba|2\u4f4d/,/\u5ba1\u9605|\u5ba1\u67e5|\u590d\u6838/],
 [/\u6bcf\u5929|\u6bcf\u65e5/,/\u589e\u91cf/],
 [/\u6bcf\u5468|\u6bcf\u661f\u671f|\u4e00\u5468\u4e00\u6b21/],
 [/\u7aef\u5230\u7aef|E2E/i,/\u56de\u5f52/],
 [/\u56de\u9000|\u56de\u6eda/],
 [/UTF.?8/i],
 [/\u8bf7\u6c42.*(\u7f16\u53f7|\u6807\u8bc6|ID)/i],
 [/\u4eba\u5de5|\u4eba\u4e3a/,/\u5ba1\u9605|\u5ba1\u67e5/],
 [/\u5408\u6210.*\u8ba2\u5355/],
 [/\u5c0f\u5199/,/\u540d\u8bcd/],
 [/\u5468\u516d|\u661f\u671f\u516d/,/\u4e0a\u5348/],
 [/Alpha/i],
 [/\u79bb\u7ebf/],
 [/\u4e24\u4e2a|2\u4e2a|\u4e24\u9879|2\u9879/],
 [/CSV/i],
 [],[],[],
 [/\u660e\u786e/,/\u4eba\u5de5|\u4eba\u4e3a/],
 [/\u6e90\u7801.*(\u6458\u8981|\u54c8\u5e0c)|\u6e90\u4ee3\u7801.*(\u6458\u8981|\u54c8\u5e0c)/,/\u6d4b\u8bd5.*\u7ed3\u679c/],
];
export const answerAcceptance={schema:1,positiveGroundedCorrectRate:.75,maxNegativeUnsafeRate:.05,maxCitationErrors:0,scopeOrValidityViolations:0,minimumCalls:300,notes:"Closed synthetic material and predeclared key-point scoring; not a substitute for open-domain evaluation, long-term personal experience, or human semantic review"};
export const answerRubricIdentity=terms.map(row=>row.map(term=>String(term)));
export function parseAnswer(value){
 const text=String(value).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
 const result=JSON.parse(text);
 if(!result||typeof result.answer!=='string'||typeof result.abstain!=='boolean'||!Array.isArray(result.citations)||result.citations.some(c=>!c||typeof c.id!=='string'||typeof c.quote!=='string'||!c.quote.trim()))throw Error("Answer JSON violates the response contract");
 return result;
}
export function scoreAnswer({item,sources,answer,factKeys}){
 let parsed;try{parsed=parseAnswer(answer);}catch{return{formatValid:false,groundedCorrect:false,citationErrors:0,unsafe:true,abstained:false};}
 const byId=new Map(sources.map(row=>[row.id,row]));
 const citationErrors=parsed.citations.filter(c=>!byId.has(c.id)||!byId.get(c.id).body.includes(c.quote)).length;
 const citedExpected=parsed.citations.some(c=>factKeys[c.id]===item.expected&&byId.has(c.id)&&byId.get(c.id).body.includes(c.quote));
 const expectedAvailable=Boolean(item.expected&&sources.some(row=>factKeys[row.id]===item.expected));
 const index=item.expected?Number(item.expected.split('-').at(-1))-1:-1;
 const matches=index>=0&&terms[index].every(term=>term.test(parsed.answer));
 const groundedCorrect=Boolean(item.expected&&!parsed.abstain&&matches&&citedExpected&&citationErrors===0);
 return{formatValid:true,groundedCorrect,citationErrors,unsafe:!parsed.abstain&&(!expectedAvailable||!groundedCorrect),abstained:parsed.abstain,expectedAvailable,parsed};
}
