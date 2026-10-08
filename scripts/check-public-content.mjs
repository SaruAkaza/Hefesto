import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
function walk(directory) {
  return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    if(['node_modules','.git','data','backups'].includes(entry.name)||entry.isSymbolicLink())return [];
    const full=path.join(directory,entry.name);
    return entry.isDirectory()?walk(full):[path.relative(root,full).replace(/\\/g,'/')];
  });
}
let files;
try {files=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8',timeout:10000,stdio:['ignore','pipe','ignore']}).split('\0').filter(Boolean);}
catch {files=walk(root);}
if(!files.length)files=walk(root);
const issues=[];
for(const name of files) {
  if(/(?:^|\/)(?:node_modules|backups|logs)(?:\/|$)|\.(?:db(?:-wal|-shm|-journal)?|log|zip|exe|dll|pfx|pem|key)$/i.test(name))issues.push(`${name}: arquivo operacional ou binário`);
  if(/(?:^|\/)\.env(?:$|\.(?!example$))/.test(name))issues.push(`${name}: configuração local`);
  if(name.startsWith('server/data/')&&name!=='server/data/branding.example.json')issues.push(`${name}: dados locais`);
  if(name.endsWith('.min.js')||name==='server/package-lock.json')continue;
  const content=readFileSync(path.join(root,name),'utf8');
  const privateNetwork=/(?<![\w.])(?:10\.\d+\.\d+(?:\.\d+)?|192\.168\.\d+(?:\.\d+)?|172\.(?:1[6-9]|2\d|3[01])\.\d+(?:\.\d+)?)(?!\w|\.\d)/g;
  for(const match of content.matchAll(privateNetwork)) {
    const genericRouting=['server/snmp-service.js','scripts/check-public-content.mjs'].includes(name)&&['10.0.0.0','172.16.0.0','192.168.0.0'].includes(match[0]);
    if(!genericRouting)issues.push(`${name}: use endereços reservados em exemplos`);
  }
  if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}/.test(content))issues.push(`${name}: possível credencial`);
}
if(issues.length){console.error([...new Set(issues)].join('\n'));process.exitCode=1;}
else console.log(`${files.length} arquivos revisados: sem dados locais, binários, redes privadas de exemplo ou credenciais reconhecidas.`);
