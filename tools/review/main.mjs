import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { describeResult, runReview } from './review.mjs';
import { reviewTarget } from './entry.mjs';

export async function main({ env = process.env, readEvent = readFileSync, review = runReview, log = console.log, processState = process } = {}) {
  const need = name => {
    const value = env[name];
    if (!value) throw new Error(`Missing ${name}`);
    return value;
  };
  const event = JSON.parse(readEvent(need('GITHUB_EVENT_PATH'), 'utf8'));
  const target = reviewTarget({ eventName: need('GITHUB_EVENT_NAME'), ref: need('GITHUB_REF'), event });
  const result = await review({
    repository: need('GITHUB_REPOSITORY'),
    ...target,
    appId: need('AI_REVIEW_APP_ID'),
    privateKey: need('AI_REVIEW_APP_PRIVATE_KEY'),
    gatewayBaseUrl: need('AI_REVIEW_GATEWAY_BASE_URL'),
    gatewayApiKey: need('AI_REVIEW_GATEWAY_API_KEY'),
    model: need('AI_REVIEW_MODEL'),
    fetch,
    diagnostic: event => log(`[review-response] ${JSON.stringify(event)}`),
  });
  log(describeResult(result));
  if (result.conclusion === 'failure') processState.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
