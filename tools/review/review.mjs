import { installationToken } from './app-auth.mjs';
import { CONTEXT_FILE_MAX, CONTEXT_TOTAL_MAX, loadFileContext, loadGuidance } from './context.mjs';
import { MAX_FILES, assessChange, diffFiles, diffRightLines, protectedPathsIn } from './diff.mjs';
import { CHECK_TEXT_MAX, createFeedback, escapeText, findingLine, fitFindings } from './feedback.mjs';
import { api } from './github.mjs';
import { callModel } from './gateway.mjs';
import { buildSystem, buildUserMessage, newNonce } from './prompt.mjs';
import { decide, parseVerdict } from './verdict.mjs';

export { diffFiles, protectedPathsIn };
export const CHECK_NAME = 'Independent review';

// When the note update fails, the job log is the only place left to say so.
export const describeResult = result => {
  if (result.skipped) return 'Skipped: pull request head moved or pull request closed.';
  const line = `Review completed: ${result.conclusion}. Pull request feedback: ${result.feedback.note}`;
  return result.feedback.recorded ? line : `${line}\n::warning::The check summary could not be updated with the pull request feedback outcome (${result.feedback.problem}); the check verdict above is unaffected.`;
};
const MAX_DIFF_BYTES = 150_000;
const MAX_ANNOTATIONS = 50;
const MAX_LISTED_PROBLEMS = 20;
const FULL_SHA = /^[0-9a-f]{40}$/;

function render({ verdict, conclusion, rightLines, protectedFiles, notes }) {
  const total = verdict.findings.length;
  const shown = fitFindings(verdict.findings, CHECK_TEXT_MAX - 500);
  const lines = verdict.findings.slice(0, shown).map(findingLine);
  if (shown < total) {
    notes = [...notes, `Only the first ${shown} of ${total} findings fit in the check's size limit; the other ${total - shown} are not shown.`];
    lines.push(`- ${total - shown} more findings are not shown because of the check's size limit.`);
  }
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
    text: lines.length ? lines.join('\n') : 'No findings.',
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
  const feedback = createFeedback({ fetch, token, repository, prNumber, sha: expectedSha, runId: id, checkUrl: `https://github.com/${repository}/pull/${prNumber}/checks?check_run_id=${id}` });

  let result;
  try {
    result = await review();
  } catch (error) {
    result = failure('Review could not complete', `The review failed closed: ${escapeText(error.message, 300)}`);
  }
  const moved = () => failure('Head moved or could not be verified', `The pull request head could not be confirmed as \`${expectedSha.slice(0, 7)}\` after the review, so the verdict was discarded and the check fails closed. A new run reviews the new head.`);
  if (result.conclusion === 'success' && !(await headStillCurrent())) result = moved();
  const { annotations = [], ...rest } = result.output;
  const complete = output => api(fetch, token, 'PATCH', `/repos/${repository}/check-runs/${id}`, { body: { status: 'completed', conclusion: result.conclusion, output } }).then(response => (response.ok ? null : `status ${response.status}`), () => 'a network error');
  let summary = result.output.summary.slice(0, 60_000);
  let sent = false;
  const attempt = async output => {
    const failed = await complete(output);
    if (failed && !/^status 4\d\d$/.test(failed)) sent = true;
    return failed;
  };
  let problem = await attempt({ ...rest, summary, ...(annotations.length ? { annotations } : {}) });
  if (problem && annotations.length) {
    summary = `${summary}\n\nAnnotations could not be attached (${problem}); the findings are listed in the details.`.slice(0, 60_000);
    problem = await attempt({ ...rest, summary });
  }
  // A failed request may still have been applied, or may still arrive: only an HTTP 4xx answer to every attempt, with the check read back as open, proves nothing was recorded.
  const state = problem ? await completionState() : 'accepted';
  if (state !== 'accepted') {
    const refused = state === 'open' && !sent;
    await feedback.markIncomplete({ reason: `the completion request failed (${problem})`, confirmed: refused });
    throw new Error(`Could not complete check run (${problem}${refused ? '' : '; the outcome could not be confirmed'})`);
  }
  // Publish only after GitHub accepted the final state, so a comment never says Passed for an unfinished check.
  const note = await feedback.publish({ conclusion: result.conclusion, verdict: result.verdict, failureSummary: result.output.summary, protectedFiles: result.protectedFiles, diff: result.diff });
  const record = () => complete({ ...rest, summary: `${summary}\n\nPull request feedback: ${note}`.slice(0, 60_000) });
  const failed = (await record()) && (await record());
  return { conclusion: result.conclusion, feedback: { note, recorded: !failed, ...(failed ? { problem: failed } : {}) } };

  async function completionState() {
    try {
      const response = await api(fetch, token, 'GET', `/repos/${repository}/check-runs/${id}`);
      if (!response.ok) return 'unknown';
      const check = await response.json();
      if (check.status !== 'completed') return 'open';
      return check.conclusion === result.conclusion ? 'accepted' : 'unknown';
    } catch {
      return 'unknown';
    }
  }

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
