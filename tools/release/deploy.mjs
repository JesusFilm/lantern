import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { deploymentReceipt } from './gates.mjs';
const {RAILWAY_SERVICE:service, RAILWAY_ENVIRONMENT:environment, RELEASE_SHA:sha, GITHUB_ENV:output} = process.env;
try {
 if (![service,environment].every(x=>/^[a-f0-9-]{36}$/.test(x ?? '')) || !/^[a-f0-9]{40}$/.test(sha ?? '') || !output) throw new Error('Missing release target.');
 const result = execFileSync('railway',['up','--json','--service',service,'--environment',environment,'--message',sha],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:12*60*1000,maxBuffer:100*1024*1024});
 const deployment = deploymentReceipt(result,service,environment);
 appendFileSync(output,`EXPECTED_DEPLOYMENT_ID=${deployment}\n`);
 console.log('Railway deployment succeeded; verifying public readiness.');
} catch { console.error('Railway deployment failed or returned an invalid receipt. Inspect the target Railway deployment privately.'); process.exitCode=1; }
