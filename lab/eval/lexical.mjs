
const segmenter=new Intl.Segmenter('zh',{granularity:'word'});
export const terms=text=>[...segmenter.segment(String(text).toLowerCase())].filter(p=>p.isWordLike).map(p=>p.segment);
export function bm25(entries,query){
 const words=terms(query),docs=entries.map(e=>({entry:e,tokens:terms(e.title+' '+e.body)})),average=docs.reduce((n,d)=>n+d.tokens.length,0)/(docs.length||1);
 return docs.map(d=>{
  let score=0;
  for(const word of new Set(words)){
   const tf=d.tokens.filter(t=>t===word).length;if(!tf)continue;
   const df=docs.filter(x=>x.tokens.includes(word)).length,idf=Math.log(1+(docs.length-df+0.5)/(df+0.5));
   score+=idf*(tf*2.2)/(tf+1.2*(0.25+0.75*d.tokens.length/(average||1)));
  }
  return {...d.entry,score};
 }).filter(d=>d.score>0).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
}
