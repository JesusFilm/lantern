import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import sharp from 'sharp';

export interface AvatarOptions { directory?: string; fetch?: typeof globalThis.fetch }
const maximumBytes=2_000_000;
export function githubAvatarCache(options:AvatarOptions={}) {
  const directory=options.directory??resolve(homedir(),'.local/state/lantern/github-avatars');
  const download=options.fetch??globalThis.fetch;
  const pending=new Map<string,Promise<Buffer>>();
  async function load(username:string):Promise<Buffer> {
    const filename=resolve(directory,username+'.webp');
    try {return await readFile(filename);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    let url=new URL(`https://github.com/${username}.png?size=120`);
    const signal=AbortSignal.timeout(8000);
    for(let redirects=0;redirects<4;redirects++) {
      if(url.protocol!=='https:' || !['github.com','avatars.githubusercontent.com'].includes(url.hostname) || url.port || url.username || url.password)throw new Error('Invalid avatar destination.');
      const response=await download(url,{redirect:'manual',signal,headers:{Accept:'image/png,image/jpeg,image/webp'}});
      if([301,302,303,307,308].includes(response.status)) {
        await response.body?.cancel();
        const location=response.headers.get('location');if(!location)throw new Error('Missing avatar destination.');
        url=new URL(location,url);continue;
      }
      if(!response.ok || !response.body)throw new Error('Avatar unavailable.');
      if(Number(response.headers.get('content-length'))>maximumBytes){await response.body.cancel();throw new Error('Avatar too large.');}
      const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
      try {while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>maximumBytes)throw new Error('Avatar too large.');chunks.push(item.value);}}
      finally {await reader.cancel();}
      const bytes=await sharp(Buffer.concat(chunks),{limitInputPixels:4_000_000}).resize(120,120,{fit:'cover'}).webp({quality:85}).toBuffer();
      await mkdir(directory,{recursive:true});
      const temporary=filename+'.'+randomUUID()+'.tmp';
      try{await writeFile(temporary,bytes,{mode:0o600});await rename(temporary,filename);}finally{await rm(temporary,{force:true});}
      return bytes;
    }
    throw new Error('Too many avatar redirects.');
  }
  return {get(username:string):Promise<Buffer>{
    if(!/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/.test(username)||username.includes('--'))return Promise.reject(new Error('Invalid GitHub username.'));
    let request=pending.get(username);
    if(!request){request=load(username).finally(()=>pending.delete(username));pending.set(username,request);}
    return request;
  }};
}
