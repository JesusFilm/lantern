import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { coachingFixture } from './coach-test-support.js';
import { removeMember } from './membership.js';
import { githubAvatarCache } from './github-avatars.js';

test('avatars are authenticated local images, persist without upstream access and enforce active team scope', async()=>{
  const directory=await mkdtemp(join(tmpdir(),'lantern-avatars-'));
  const png=await sharp({create:{width:2,height:2,channels:3,background:'#557788'}}).png().toBuffer();
  let calls=0;
  const upstream:typeof fetch=async input=>{calls++;assert.equal(String(input),'https://github.com/octocat.png?size=120');return new Response(png,{headers:{'Content-Type':'image/png'}});};
  const f=await coachingFixture(undefined,undefined,{githubAvatars:{directory,fetch:upstream}});
  const path='/api/github-avatars/octocat';
  try {
    await f.request('peer','/api/integrations/github/profile','PATCH',{username:'octocat'});
    assert.equal((await f.request('missing',path)).status,401);
    assert.equal((await f.request('outsider',path)).status,404);
    assert.equal((await f.request('member','/api/github-avatars/not--valid')).status,400);
    assert.equal(calls,0);
    const [a,b]=await Promise.all([f.request('member',path),f.request('member',path)]);
    assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(a.headers.get('content-type'),'image/webp');
    const bytes=Buffer.from(await a.arrayBuffer());assert.equal((await sharp(bytes).metadata()).format,'webp');assert.equal(calls,1);
    const restarted=githubAvatarCache({directory,fetch:async()=>{throw new Error('No internet');}});
    assert.deepEqual(await restarted.get('octocat'),bytes);
    await removeMember(f.admin,f.ids.member);assert.equal((await f.request('member',path)).status,403);
    await removeMember(f.admin,f.ids.peer);assert.equal((await f.request('lead',path)).status,404);
  } finally {await f.close();await rm(directory,{recursive:true,force:true});}
});

test('avatar cache rejects non-image payloads and redirects outside GitHub',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'lantern-avatars-'));
  try {
    const invalid=githubAvatarCache({directory,fetch:async()=>new Response('<html>not an image</html>')});
    await assert.rejects(invalid.get('invalid'));
    let calls=0;
    const redirect=githubAvatarCache({directory,fetch:async()=>{calls++;return new Response(null,{status:302,headers:{Location:'http://127.0.0.1/private'}});}});
    await assert.rejects(redirect.get('redirect'));assert.equal(calls,1);
  }finally{await rm(directory,{recursive:true,force:true});}
});
