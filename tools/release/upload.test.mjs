import {test} from 'node:test';
import assert from 'node:assert/strict';
import {queueDeployment} from './upload.mjs';
test('detached receipt must resolve to the exact service and environment',()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const deployment={id,serviceId:'runner',environmentId:'stage'};
 const call=(patch={})=>args=>args[0]==='up'?JSON.stringify({deploymentId:id,logsUrl:'https://railway.com/logs'}):JSON.stringify({data:{deployment:{...deployment,...patch}}});
 assert.equal(queueDeployment(call(),[],'runner','stage'),id);
 for(const patch of [{id:'different'},{serviceId:'app'},{environmentId:'production'}]) assert.throws(()=>queueDeployment(call(patch),[],'runner','stage'));
 assert.throws(()=>queueDeployment(()=>'{"status":"success"}',[],'runner','stage'));
});
