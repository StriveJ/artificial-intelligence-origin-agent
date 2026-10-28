
import {readdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {SOURCE_ROOT} from './synthetic-fixture.mjs';
export const originCheckPaths=()=>[
 'product','studio/scripts','studio/tests','studio/ci','lab/tests','lab/support','lab/eval','lab/release','lab/answer-acceptance','lab/language-acceptance',
 ...readdirSync(join(SOURCE_ROOT,'lab')).filter(name=>name.endsWith('.mjs')).sort().map(name=>'lab/'+name),
 ...['README.md','README_EN.md','README_CN.md','LICENSE','CONTRIBUTING.md','CLAUDE.md','.gitignore','.gitattributes','docs/instance-to-origin-contribution.md','lab/README.md','studio/CLAUDE.md','MAINTAINERS.md','.github/CODEOWNERS','studio/internal','studio/hooks','.github/workflows'].filter(path=>existsSync(join(SOURCE_ROOT,path))),
];
export const hubCheckPaths=root=>['lib','public','tests','README.md','README_EN.md','LICENSE','package.json','package-lock.json',...['.gitattributes','.gitignore','AGENTS.md','README_CN.md','CHANGELOG.md','docs/release-process.md','docs/pushes.md','config.example.json','config.main.example.json','config.sub.example.json'].filter(path=>existsSync(join(root,path))),...readdirSync(root).filter(name=>/\.(?:mjs|ps1|sh)$/.test(name)).sort()];
export const HUB_CAPACITY_PATHS=['lib','package.json','package-lock.json'];
