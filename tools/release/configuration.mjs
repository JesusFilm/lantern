import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const query=`query($environment:String!,$service:String!){
 environment(id:$environment){id name projectId deploymentTriggers(first:100){edges{node{serviceId}} pageInfo{hasNextPage}}}
 serviceInstance(environmentId:$environment,serviceId:$service){environmentId serviceId builder dockerfilePath buildCommand startCommand preDeployCommand healthcheckPath healthcheckTimeout restartPolicyType restartPolicyMaxRetries rootDirectory cronSchedule railwayConfigFile source{repo image}}
}`;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
function requireSetting(condition, name){if(!condition)throw new Error(`Deployment preflight failed: ${name}.`);}
function command(args){
 // Provider responses and variable values never reach stdout/stderr, including on failure.
 try{return JSON.parse(execFileSync('railway',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000,maxBuffer:2*1024*1024}));}
 catch{throw new Error('Deployment preflight could not read Railway state.');}
}

/** Read-only provider preflight. No configuration writes, database access or deployments. */
export function verifyConfiguration(env){
 const {RAILWAY_PROJECT:project,RAILWAY_ENVIRONMENT:environment,RAILWAY_SERVICE:service,RELEASE_TARGET:target,LANTERN_DB_RUNTIME_ROLE:runtimeRole,APP_ORIGIN:origin}=env;
 requireSetting([project,environment,service].every(x=>uuid.test(x??'')),'explicit project/environment/service IDs required');
 requireSetting(['stage','production'].includes(target),'release target required');
 requireSetting(env.RAILWAY_TOKEN && !env.RAILWAY_API_TOKEN,'environment-scoped project token required');
 requireSetting(/^lantern_[a-z0-9_]+_runtime$/.test(runtimeRole??''),'expected runtime role required');
 requireSetting(origin && new URL(origin).protocol==='https:' && new URL(origin).origin===origin,'HTTPS origin required');
 const result=command(['api','--compact','--variables',JSON.stringify({environment,service}),query]);
 requireSetting(!result.errors?.length,'provider returned errors');
 const e=result.data?.environment,s=result.data?.serviceInstance;
 requireSetting(e?.id===environment && e?.projectId===project && e?.name===(target==='stage'?'staging':'production'),'environment identity mismatch');
 requireSetting(s?.serviceId===service && s?.environmentId===environment,'service identity mismatch');
 const expected={startCommand:'node dist/server/index.js',healthcheckPath:'/health',healthcheckTimeout:120,restartPolicyType:'ON_FAILURE',restartPolicyMaxRetries:3};
 for(const [key,value] of Object.entries(expected))requireSetting(s[key]===value,key);
 // Railway auto-detects the root Dockerfile even when the dashboard builder is RAILPACK.
 requireSetting(['RAILPACK','DOCKERFILE'].includes(s.builder),'builder');
 requireSetting(s.dockerfilePath===null || s.dockerfilePath==='Dockerfile','Dockerfile path');
 for(const key of ['buildCommand','cronSchedule','railwayConfigFile'])requireSetting(s[key]===null,key);
 requireSetting(s.rootDirectory===null || s.rootDirectory==='/' || s.rootDirectory==='','root directory');
 requireSetting(s.preDeployCommand===null || (Array.isArray(s.preDeployCommand)&&s.preDeployCommand.length===0),'runtime must not run pre-deploy commands');
 requireSetting(s.source===null || (s.source && s.source.repo===null && s.source.image===null),'independent source integration');
 const triggers=e.deploymentTriggers;
 requireSetting(triggers?.pageInfo?.hasNextPage===false && Array.isArray(triggers.edges),'complete deployment trigger inventory required');
 requireSetting(triggers.edges.every(edge=>typeof edge.node?.serviceId==='string' && edge.node.serviceId!==service),'independent deployment trigger');
 const v=command(['variables','--json','--project',project,'--environment',environment,'--service',service]);
 for(const [key,value] of Object.entries({LANTERN_ENV:target,NODE_ENV:'production',LOCAL_ACCESS:'0',LANTERN_HOSTING_ONLY:'0',APP_ORIGIN:origin,HOST:'0.0.0.0'}))requireSetting(v[key]===value,key);
 for(const key of ['BOOTSTRAP_DATABASE_URL','MIGRATION_DATABASE_URL','ADMIN_DATABASE_URL'])requireSetting(!(key in v),'privileged database credential present');
 for(const key of ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET'])requireSetting(typeof v[key]==='string' && v[key].length>0,key);
 requireSetting(v.COACH_ENABLED===undefined || ['0','1'].includes(v.COACH_ENABLED),'COACH_ENABLED');
 if(v.COACH_ENABLED==='1') {
  for(const key of ['AI_GATEWAY_CHAT_API_KEY','OPENROUTER_API_KEY'])requireSetting(typeof v[key]==='string' && v[key].trim().length>0 && !/[\r\n]/.test(v[key]),key);
  if(v.AI_GATEWAY_CHAT_BASE_URL){let endpoint;try{endpoint=new URL(v.AI_GATEWAY_CHAT_BASE_URL);}catch{throw new Error('Deployment preflight failed: coaching gateway URL.');}
   requireSetting(endpoint.protocol==='https:'&&!endpoint.username&&!endpoint.password&&!endpoint.search&&!endpoint.hash,'coaching gateway URL');}
 }
 let database;try{database=new URL(v.DATABASE_URL);}catch{throw new Error('Deployment preflight failed: runtime database URL.');}
 requireSetting(['postgres:','postgresql:'].includes(database.protocol) && decodeURIComponent(database.username)===runtimeRole && database.hostname.endsWith('.railway.internal'),'runtime database identity');
 return {project,environment,service,target};
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 try{verifyConfiguration(process.env);console.log('Read-only deployment configuration check passed. No deployment performed.');}
 catch{console.error('Deployment configuration check failed. Inspect target metadata and private variables; no deployment performed.');process.exitCode=1;}
}
