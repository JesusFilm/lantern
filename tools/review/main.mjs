import { readFileSync } from 'node:fs';
import { describeResult, runReview } from './review.mjs';

const need = name => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const event = JSON.parse(readFileSync(need('GITHUB_EVENT_PATH'), 'utf8'));
const result = await runReview({
  repository: need('GITHUB_REPOSITORY'),
  prNumber: event.pull_request.number,
  expectedSha: event.pull_request.head.sha,
  appId: need('AI_REVIEW_APP_ID'),
  privateKey: need('AI_REVIEW_APP_PRIVATE_KEY'),
  gatewayBaseUrl: need('AI_REVIEW_GATEWAY_BASE_URL'),
  gatewayApiKey: need('AI_REVIEW_GATEWAY_API_KEY'),
  model: need('AI_REVIEW_MODEL'),
  fetch,
});
console.log(describeResult(result));
