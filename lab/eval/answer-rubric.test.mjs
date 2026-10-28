// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreAnswer,parseAnswer} from './answer-rubric.mjs';
const item={expected:'synthetic-06'},sources=[{id:'synthetic-source',body:"\u82cd\u7a79\u9879\u76ee\u53d1\u5e03\u524d\u9700\u8981\u4e24\u4eba\u5ba1\u9605。"}],factKeys={'synthetic-source':'synthetic-06'};
const answer=overrides=>JSON.stringify({answer:"\u9700\u8981\u4e24\u4eba\u5ba1\u9605。",abstain:false,citations:[{id:'synthetic-source',quote:"\u4e24\u4eba\u5ba1\u9605"}],...overrides});
test("Answer scoring requires key points, real IDs, and verbatim citations; fabricated or unsupported answers fail",()=>{
 assert.equal(scoreAnswer({item,sources,factKeys,answer:answer()}).groundedCorrect,true);
 for(const invalid of [answer({answer:"\u4e0d\u9700\u8981\u5ba1\u6838"}),answer({citations:[{id:'missing',quote:"\u4e24\u4eba\u5ba1\u9605"}]}),answer({citations:[{id:'synthetic-source',quote:"\u672a\u63d0\u4f9b\u539f\u6587"}]}),'not json'])assert.equal(scoreAnswer({item,sources,factKeys,answer:invalid}).groundedCorrect,false);
 assert.equal(scoreAnswer({item,sources:[],factKeys,answer:answer()}).unsafe,true);assert.equal(scoreAnswer({item:{expected:null},sources,factKeys,answer:answer()}).unsafe,true);
 assert.equal(scoreAnswer({item:{expected:null},sources:[],factKeys,answer:answer({abstain:true,answer:"\u8d44\u6599\u4e0d\u8db3",citations:[]})}).unsafe,false);assert.throws(()=>parseAnswer('{"answer":"Missing protocol"}'));
});
