import {mkdirSync,existsSync,readFileSync,writeFileSync,chmodSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const tools='.cloudflare-tools';mkdirSync(tools,{recursive:true});
const archive=tools+'/mdbook-0.4.36.tar.gz';
if(!existsSync(archive)){const response=await fetch('https://github.com/rust-lang/mdBook/releases/download/v0.4.36/mdbook-v0.4.36-x86_64-unknown-linux-gnu.tar.gz');if(!response.ok)throw Error('mdBook download failed');writeFileSync(archive,new Uint8Array(await response.arrayBuffer()));}
if(createHash('sha256').update(readFileSync(archive)).digest('hex')!=='72a50f5eecefef173114b53543a968fd1e8265ef67760b9d5bb20cd7712a9511')throw Error('mdBook release checksum mismatch');
execFileSync('tar',['-xzf',archive,'-C',tools,'mdbook']);chmodSync(tools+'/mdbook',0o755);
if(execFileSync(tools+'/mdbook',['--version'],{encoding:'utf8'}).trim()!=='mdbook v0.4.36')throw Error('mdBook version mismatch');
execFileSync(tools+'/mdbook',['build','--dest-dir','dist'],{stdio:'inherit'});
