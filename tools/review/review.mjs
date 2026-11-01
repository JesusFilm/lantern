import { installationToken } from './app-auth.mjs';
import { callModel } from './gateway.mjs';
import { buildUserMessage, SYSTEM_PROMPT } from './prompt.mjs';
import { decide, parseVerdict } from './verdict.mjs';

export const CHECK_NAME = 'Independent review';
const MAX_DIFF_BYTES = 150_000;
const MAX_ANNOTATIONS = 50;
const PROTECTED = [/^\.github\//, /^tools\/review\//, /^tools\/release\//, /^CODEOWNERS$/, /^docs\/operations\/review-gate\.md$/];

export function diffFiles(diff) {
  return [...diff.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)].map(match => match[2]);
}

export const protectedPathsIn = diff => diffFiles(diff).filter(file => PROTECTED.some(pattern => pattern.test(file)));

async function api(fetch, token, method, path, { body, accept = 'application/vnd.github+json' } = {}) {
  return fetch(`https://api.github.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
}

function render({ verdict, conclusion, files, protectedFiles }) {
  const lines = verdict.findings.map(f => `- **${f.severity}**${f.file ? ` \`${f.file}${f.line ? `:${f.line}` : ''}\`` : ''}: ${f.message}`);
  const notes = protectedFiles.length ? `\n\nThis change touches protected paths (${protectedFiles.join(', ')}); a human code owner must approve it. This check is not a formal pull request approval.` : '\n\nThis check is not a formal pull request approval.';
  const annotations = verdict.findings.filter(f => f.file && f.line && files.includes(f.file)).slice(0, MAX_ANNOTATIONS).map(f => ({
    path: f.file, start_line: f.line, end_line: f.line, annotation_level: f.severity === 'minor' ? 'notice' : f.severity === 'major' ? 'warning' : 'failure', message: f.message,
  }));
  return {
    title: conclusion === 'success' ? 'Review passed' : 'Review requires changes',
    summary: `${verdict.summary}${notes}`.slice(0, 60_000),
    text: (lines.length ? lines.join('\n') : 'No findings.').slice(0, 60_000),
    annotations,
  };
}

const failure = (title, summary) => ({ conclusion: 'failure', output: { title, summary, text: '' } });

export async function runReview({ repository, prNumber, expectedSha, appId, privateKey, gatewayBaseUrl, gatewayApiKey, model, fetch }) {
  const token = await installationToken({ fetch, appId, privateKey, repository });
  const pullResponse = await api(fetch, token, 'GET', `/repos/${repository}/pulls/${prNumber}`);
  if (!pullResponse.ok) throw new Error(`Could not read pull request (status ${pullResponse.status})`);
  const pull = await pullResponse.json();
  if (pull.state !== 'open' || pull.head.sha !== expectedSha) return { skipped: true };

  const opened = await api(fetch, token, 'POST', `/repos/${repository}/check-runs`, { body: { name: CHECK_NAME, head_sha: expectedSha, status: 'in_progress', output: { title: 'Review running', summary: 'Waiting for the independent review to finish.' } } });
  if (!opened.ok) throw new Error(`Could not open check run (status ${opened.status})`);
  const { id } = await opened.json();

  let result;
  try {
    result = await review();
  } catch (error) {
    result = failure('Review could not complete', `The review failed closed: ${String(error.message).slice(0, 300)}`);
  }
  const done = await api(fetch, token, 'PATCH', `/repos/${repository}/check-runs/${id}`, { body: { status: 'completed', conclusion: result.conclusion, output: result.output } });
  if (!done.ok) throw new Error(`Could not complete check run (status ${done.status})`);
  return { conclusion: result.conclusion };

  async function review() {
    const diffResponse = await api(fetch, token, 'GET', `/repos/${repository}/pulls/${prNumber}`, { accept: 'application/vnd.github.diff' });
    if (!diffResponse.ok) return failure('Diff unavailable', `GitHub could not provide the diff (status ${diffResponse.status}), so the change was not reviewed.`);
    const diff = await diffResponse.text();
    if (!diff.trim()) return failure('Diff unavailable', 'The pull request diff was empty, so the change was not reviewed.');
    if (Buffer.byteLength(diff) > MAX_DIFF_BYTES) return failure('Diff too large', `The diff exceeds ${MAX_DIFF_BYTES} bytes and was not reviewed. Split the change.`);
    const text = await callModel({ fetch, baseUrl: gatewayBaseUrl, apiKey: gatewayApiKey, model, system: SYSTEM_PROMPT, user: buildUserMessage({ title: pull.title, body: pull.body, diff }) });
    const verdict = parseVerdict(text);
    const { conclusion } = decide(verdict);
    return { conclusion, output: render({ verdict, conclusion, files: diffFiles(diff), protectedFiles: protectedPathsIn(diff) }) };
  }
}
