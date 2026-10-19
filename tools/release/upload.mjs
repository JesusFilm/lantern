import assert from 'node:assert/strict';

// Detached uploads return an ID, not proof of readiness. Resolve its target from Railway.
export function queueDeployment(call,args,service,environment) {
 const output=call(['up','--detach','--json',...args]);
 const receipt=JSON.parse(output.trim().split('\n').at(-1));
 assert.match(receipt.deploymentId??'',/^[a-f0-9-]{36}$/);
 const result=JSON.parse(call(['api','--compact','--variables',JSON.stringify({id:receipt.deploymentId}),'query($id:String!){deployment(id:$id){id serviceId environmentId}}']));
 assert.ok(!result.errors?.length);
 const deployment=result.data?.deployment;
 assert.equal(deployment?.id,receipt.deploymentId);
 assert.equal(deployment?.serviceId,service);
 assert.equal(deployment?.environmentId,environment);
 return deployment.id;
}
