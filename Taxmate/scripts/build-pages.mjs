import {cpSync,mkdirSync,writeFileSync,rmSync,existsSync} from 'node:fs';
mkdirSync('docs',{recursive:true});
if(existsSync('docs/assets'))rmSync('docs/assets',{recursive:true,force:true});
cpSync('dist','docs',{recursive:true});
writeFileSync('docs/.nojekyll','');
console.log('GitHub Pages static build ready in docs/');
