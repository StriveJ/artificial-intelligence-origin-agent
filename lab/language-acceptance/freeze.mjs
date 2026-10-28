import {writeFileSync} from 'node:fs';
import {freezeIdentity} from './contract.mjs';
// Exclusive creation preserves prior expected semantics and program identities.
writeFileSync(new URL('./freeze.json',import.meta.url),JSON.stringify(freezeIdentity(),null,2)+'\n',{flag:'wx'});
console.log('Created representative-language baseline freeze; existing freezes are never overwritten.');
