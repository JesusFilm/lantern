import assert from 'node:assert/strict';
import { test } from 'node:test';
import { world, run, json, finalCheck, BASE, SHA, modelCalls } from './fake-github.mjs';
const path='server/example.ts';
const narrow='@@ -2 +2 @@\n-old\n+new';
const wide='@@ -1,3 +1,3 @@\n first\n-old\n+new\n last';
function example({listed=wide,head='first\nnew\nlast\n',base='first\nold\nlast\n'}={}) {
 const diff=`diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n${narrow}\n`;
 const files=[{filename:path,status:'modified',additions:1,deletions:1,changes:2,patch:listed}];
 const w=world({diff,files,contents:{[path+'@base']:base,[path+'@head']:head}});
 const fetch=w.fetch;
 w.fetch=async(url,init)=>{const response=await fetch(url,init);if(url.includes('/compare/') && !init.headers.Accept.includes('diff'))return json({...await response.json(),merge_base_commit:{sha:BASE}});return response;};
 return w;
}
test('equivalent context layouts pass only after both patches prove complete pinned contents',async()=>{
 const w=example();assert.equal((await run(w)).conclusion,'success');
 assert.ok(w.calls.some(c=>c.path.endsWith('/contents/'+path)&&c.search===`?ref=${BASE}`));
 assert.ok(w.calls.some(c=>c.path.endsWith('/contents/'+path)&&c.search===`?ref=${SHA}`));
});
test('equivalence fallback rejects altered context, omitted edits and hidden characters before inference',async()=>{
 for(const opts of [{listed:wide.replace(' first',' WRONG')},{head:'first\nnew\nCHANGED\n'},{listed:wide.replace('+new','+n\u200bew')},{base:null}]) {
  const w=example(opts);assert.equal((await run(w)).conclusion,'failure');assert.equal(modelCalls(w).length,0);assert.notEqual(finalCheck(w).conclusion,'success');
 }
});

test('captured PR66 manifest mismatch is accepted with complete real source evidence',async()=>{
 const {readFileSync}=await import('node:fs');
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/pr66-manifest.json',import.meta.url),'utf8'));
 const p=fixture.file.filename;
 const w=world({diff:fixture.diff,files:[fixture.file],contents:{[p+'@base']:fixture.before,[p+'@head']:fixture.after}});
 const fetch=w.fetch;
 w.fetch=async(url,init)=>{const response=await fetch(url,init);if(url.includes('/compare/')&&!init.headers.Accept.includes('diff'))return json({...await response.json(),merge_base_commit:{sha:BASE}});return response;};
 assert.equal((await run(w)).conclusion,'success');
 assert.ok(modelCalls(w).length>0);
 assert.match(finalCheck(w).output.summary,/independently verified/);
});

test('proof reads the compare merge base rather than the moving base tip',async()=>{
 const w=example();const fetch=w.fetch;const merge='c'.repeat(40);
 w.fetch=async(url,init)=>{
  if(url.endsWith(`?ref=${merge}`)&&url.includes('/contents/server/example.ts'))return new Response('first\nold\nlast\n');
  if(url.endsWith(`?ref=${BASE}`)&&url.includes('/contents/server/example.ts'))return new Response('base tip has diverged\n');
  const response=await fetch(url,init);
  if(url.includes('/compare/')&&!init.headers.Accept.includes('diff'))return json({...await response.json(),merge_base_commit:{sha:merge}});
  return response;
 };
 assert.equal((await run(w)).conclusion,'success');
});

test('missing merge-base evidence and read failures cannot approve equivalent layouts',async()=>{
 for(const missing of [true,false]){
  const w=example();const fetch=w.fetch;
  w.fetch=async(url,init)=>{
   if(!missing&&url.includes('/contents/server/example.ts'))return new Response('unavailable',{status:503});
   const response=await fetch(url,init);
   if(missing&&url.includes('/compare/')&&!init.headers.Accept.includes('diff')){const data=await response.json();delete data.merge_base_commit;return json(data);}
   return response;
  };
  assert.equal((await run(w)).conclusion,'failure');assert.equal(modelCalls(w).length,0);
 }
});

test('listed patch edit counts must match API totals even for valid no-op rewrites',async()=>{
 const w=example({listed:wide.replace(' first','-first\n+first')});
 assert.equal((await run(w)).conclusion,'failure');
 assert.equal(modelCalls(w).length,0);
});
