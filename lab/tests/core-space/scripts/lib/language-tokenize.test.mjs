import test from 'node:test';
import assert from 'node:assert/strict';
import {tokenize,rankAsks} from '../../../../../product/core-space/scripts/lib/signal-core.mjs';

test('native segmentation retains exact legacy Latin and Han token sequences',()=>{
  assert.deepEqual(tokenize('Deploy C++ API-v2 aipa_1 \u4e2d\u6587\u8bb0\u5fc6'),[
    'deploy','c++','api-v2','aipa_1','\u4e2d\u6587','\u6587\u8bb0','\u8bb0\u5fc6',
  ]);
  assert.deepEqual(tokenize('how to \u7528\u4e2d\u6587 search memory'),[
    'search','memory','\u7528\u4e2d','\u4e2d\u6587',
  ]);
  const asks=[{date:'2026-10-27',text:'What is memory search?'},{date:'2026-10-26',text:'unrelated deployment'}];
  assert.deepEqual(rankAsks(asks,'search memory'),[{date:'2026-10-27',text:'What is memory search?',score:1}]);
});

test('Arabic, Cyrillic and Devanagari words participate in repeat-question matching',()=>{
  const samples=[
    {text:'\u0645\u0631\u062d\u0628\u0627 \u0628\u0627\u0644\u0639\u0627\u0644\u0645',tokens:['\u0645\u0631\u062d\u0628\u0627','\u0628\u0627\u0644\u0639\u0627\u0644\u0645']},
    {text:'\u041f\u0440\u0438\u0432\u0435\u0442 \u043c\u0438\u0440',tokens:['\u043f\u0440\u0438\u0432\u0435\u0442','\u043c\u0438\u0440']},
    {text:'\u0928\u092e\u0938\u094d\u0924\u0947 \u0926\u0941\u0928\u093f\u092f\u093e',tokens:['\u0928\u092e\u0938\u094d\u0924\u0947','\u0926\u0941\u0928\u093f\u092f\u093e']},
  ];
  for(const sample of samples) {
    const original=sample.text;
    assert.deepEqual(tokenize(original),sample.tokens);
    const asks=[{date:'2026-10-27',text:original},{date:'2026-10-26',text:'unrelated English text'}];
    assert.deepEqual(rankAsks(asks,original),[{date:'2026-10-27',text:original,score:1}]);
    assert.equal(sample.text,original);
    assert.equal(asks[0].text,original);
  }
});

test('Thai word boundaries work without spaces and preserve the original question',()=>{
  const original='\u0e20\u0e32\u0e29\u0e32\u0e44\u0e17\u0e22';
  const tokens=tokenize(original);
  assert.deepEqual(tokens,['\u0e20\u0e32\u0e29\u0e32','\u0e44\u0e17\u0e22']);
  const asks=[{date:'2026-10-27',text:original}];
  assert.equal(rankAsks(asks,'\u0e44\u0e17\u0e22')[0].text,original);
  assert.deepEqual(asks,[{date:'2026-10-27',text:original}]);
});
