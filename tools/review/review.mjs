import { installationToken } from './app-auth.mjs';
import { CONTEXT_FILE_MAX, CONTEXT_TOTAL_MAX, loadFileContext, loadGuidance } from './context.mjs';
import { MAX_FILES, assessChange, diffFiles, diffRightLines, protectedPathsIn } from './diff.mjs';
import { createFeedback, escapeText } from './feedback.mjs';
import { api } from './github.mjs';
import { callModel } from './gateway.mjs';
import { buildSystem, buildUserMessage, newNonce } from './prompt.mjs';
import { decide, parseVerdict } from './verdict.mjs';

export { diffFiles, protectedPathsIn };
export const CHECK_NAME = 'Independent review';
const MAX_DIFF_BYTES = 150_000;
const MAX_ANNOTATIONS = 50;
const MAX_LISTED_PROBLEMS = 20;
const FULL_SHA = /^[0-9a-f]{40}$/;

function render({ verdict, conclusion, rightLines, protectedFiles, notes }) {
  const lines = verdict.findings.map(f => `- **${f.severity}**${f.file ? ` ${escapeText(f.file, 300)}${f.line ? `:${f.line}` : ''}` : ''}: ${escapeText(f.message)}`);
  const closing = protectedFiles.length ? `\n\nThis change touches protected paths (${protectedFiles.map(file => escapeText(file, 200)).join(', ')}); it needs independent inspection and the owner's authorization before merge. This check is not a formal pull request approval.` : '\n\nThis check is not a formal pull request approval.';
  const extra = notes.length ? `\n\n${notes.map(note => `- ${note}`).join('\n')}` : '';
  const annotations = verdict.findings.filter(f => f.file && f.line && rightLines.get(f.file)?.has(f.line)).slice(0, MAX_ANNOTATIONS).map(f => ({
    path: f.file,
    start_line: f.line,
    end_line: f.line,
    annotation_level: f.severity === 'minor' ? 'notice' : f.severity === 'major' ? 'warning' : 'failure',
    title: `Independent review: ${f.severity}`,
    message: escapeText(f.message, 1000),
  }));
  return {
    title: conclusion === 'success' ? 'Review passed' : 'Review requires changes',
    summary: `${escapeText(verdict.summary, 4000)}${closing}${extra}`.slice(0, 60_000),
    text: (lines.length ? lines.join('\n') : 'No findings.').slice(0, 60_000),
    annotations,
  };
}

const failure = (title, summary) => ({ conclusion: 'failure', output: { title, summary, text: '' } });

export async function runReview({ repository, prNumber, expectedSha, appId, privateKey, gatewayBaseUrl, gatewayApiKey, model, fetch, nonce = newNonce() }) {
  const token = await installationToken({ fetch, appId, privateKey, repository });
  const pullPath = `/repos/${repository}/pulls/${prNumber}`;
  const pullResponse = await api(fetch, token, 'GET', pullPath);
  if (!pullResponse.ok) throw new Error(`Could not read pull request (status ${pullResponse.status})`);
  const pull = await pullResponse.json();
  if (pull.state !== 'open' || pull.head.sha !== expectedSha) return { skipped: true };
  const baseSha = pull.base?.sha;

  const opened = await api(fetch, token, 'POST', `/repos/${repository}/check-runs`, { body: { name: CHECK_NAME, head_sha: expectedSha, status: 'in_progress', output: { title: 'Review running', summary: 'Waiting for the independent review to finish.' } } });
  if (!opened.ok) throw new Error(`Could not open check run (status ${opened.status})`);
  const { id } = await opened.json();
  const feedback = createFeedback({ fetch, token, repository, prNumber, sha: expectedSha, checkUrl: `https://github.com/${repository}/pull/${prNumber}/checks?check_run_id=${id}` });
  await feedback.announce();

  let result;
  try {
    result = await review();
  } catch (error) {
    result = failure('Review could not complete', `The review failed closed: ${escapeText(error.message, 300)}`);
  }
  const moved = () => failure('Head moved or could not be verified', `The pull request head could not be confirmed as \`${expectedSha.slice(0, 7)}\` after the review, so the verdict was discarded and the check fails closed. A new run reviews the new head.`);
  if (result.conclusion === 'success' && !(await headStillCurrent())) result = moved();
  let note = await feedback.publish({ conclusion: result.conclusion, verdict: result.verdict, failureSummary: result.output.summary, protectedFiles: result.protectedFiles, diff: result.diff });
  if (result.conclusion === 'success' && !(await headStillCurrent())) {
    result = moved();
    note += ` ${await feedback.reconcile({ failureSummary: result.output.summary })}`;
  }
  const summary = `${result.output.summary}\n\nPull request feedback: ${note}`.slice(0, 60_000);
  const { annotations = [], ...rest } = result.output;
  const complete = output => api(fetch, token, 'PATCH', `/repos/${repository}/check-runs/${id}`, { body: { status: 'completed', conclusion: result.conclusion, output } });
  let done = await complete({ ...rest, summary, ...(annotations.length ? { annotations } : {}) });
  if (!done.ok && annotations.length) {
    done = await complete({ ...rest, summary: `${summary}\n\nAnnotations could not be attached (status ${done.status}); the findings are listed in the details.`.slice(0, 60_000) });
  }
  if (!done.ok) throw new Error(`Could not complete check run (status ${done.status})`);
  return { conclusion: result.conclusion };

  async function headStillCurrent() {
    try {
      const response = await api(fetch, token, 'GET', pullPath);
      if (!response.ok) return false;
      const current = await response.json();
      return current.state === 'open' && current.head?.sha === expectedSha;
    } catch {
      return false;
    }
  }

  async function review() {
    if (!FULL_SHA.test(baseSha ?? '')) return failure('Base unavailable', 'GitHub did not report the base commit, so the change could not be bound to a fixed range and was not reviewed.');
    const compare = `/repos/${repository}/compare/${baseSha}...${expectedSha}`;
    const diffResponse = await api(fetch, token, 'GET', compare, { accept: 'application/vnd.github.diff' });
    if (!diffResponse.ok) return failure('Diff unavailable', `GitHub could not provide the diff (status ${diffResponse.status}), so the change was not reviewed.`);
    const diff = await diffResponse.text();
    if (!diff.trim()) return failure('Diff unavailable', 'The diff was empty, so the change was not reviewed.');
    if (Buffer.byteLength(diff) > MAX_DIFF_BYTES) return failure('Diff too large', `The diff exceeds ${MAX_DIFF_BYTES} bytes and was not reviewed. Split the change.`);

    const listResponse = await api(fetch, token, 'GET', `${compare}?per_page=100`);
    if (!listResponse.ok) return failure('File list unavailable', `GitHub could not list the changed files (status ${listResponse.status}), so completeness could not be checked and the change was not reviewed.`);
    const files = (await listResponse.json()).files;
    if (!Array.isArray(files)) return failure('File list unavailable', 'GitHub returned no file list, so completeness could not be checked and the change was not reviewed.');
    if (files.length >= MAX_FILES) return failure('Too many files', `The change lists ${MAX_FILES} or more files, which may be truncated, so it was not reviewed. Split the change.`);

    const { problems, renames } = assessChange(diff, files);
    if (problems.length) {
      const listed = problems.slice(0, MAX_LISTED_PROBLEMS).map(p => `- ${escapeText(p.path, 200)}: ${p.reason}`).join('\n');
      const more = problems.length > MAX_LISTED_PROBLEMS ? `\n- and ${problems.length - MAX_LISTED_PROBLEMS} more` : '';
      return failure('Unreviewable changes', `Some changes could not be fully assessed (binary files, omitted or mismatched patches, or file mode changes), so the change was not approved. Only pure renames and empty files are allowed without a patch.\n\n${listed}${more}`);
    }

    const paths = files.flatMap(file => [file.filename, file.previous_filename].filter(Boolean));
    const guidance = await loadGuidance({ fetch, token, repository, baseSha, paths });
    const context = await loadFileContext({ fetch, token, repository, headSha: expectedSha, files });
    const insufficient = [...guidance.map(file => ({ ...file, kind: 'repository guidance' })), ...context.map(file => ({ ...file, kind: 'full file at head' }))].filter(file => file.omitted || file.clipped);
    if (insufficient.length) {
      const listed = insufficient.slice(0, MAX_LISTED_PROBLEMS).map(file => `- ${escapeText(file.path, 200)} (${file.kind}): ${file.omitted ? `not provided, ${file.omitted}` : `longer than the limit and cut off`}`).join('\n');
      const more = insufficient.length > MAX_LISTED_PROBLEMS ? `\n- and ${insufficient.length - MAX_LISTED_PROBLEMS} more` : '';
      return failure('Insufficient context', `The review needs the complete repository guidance and the complete head version of every modified file (up to ${CONTEXT_FILE_MAX} characters per file and ${CONTEXT_TOTAL_MAX} in total), because a change cannot be judged against a file it cannot fully see. Nothing was approved. Split the change or reduce the files it touches.\n\n${listed}${more}`);
    }
    const text = await callModel({
      fetch, baseUrl: gatewayBaseUrl, apiKey: gatewayApiKey, model,
      system: buildSystem({ guidance, baseSha, nonce }),
      user: buildUserMessage({ title: pull.title, body: pull.body, diff, files: context, renames, baseSha, headSha: expectedSha, nonce }),
    });
    const verdict = parseVerdict(text);
    const { conclusion } = decide(verdict);
    const protectedFiles = protectedPathsIn(diff);
    const notes = [`Reviewed ${baseSha.slice(0, 7)}...${expectedSha.slice(0, 7)} with ${guidance.length} trusted guidance file${guidance.length === 1 ? '' : 's'} from the base commit.`];
    notes.push(`Full head content was provided for ${context.length} modified file${context.length === 1 ? '' : 's'}; files the change depends on but does not modify were not provided.`);
    return { conclusion, verdict, diff, protectedFiles, output: render({ verdict, conclusion, rightLines: diffRightLines(diff), protectedFiles, notes }) };
  }
}
