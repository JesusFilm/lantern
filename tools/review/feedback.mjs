import { createHash } from 'node:crypto';
import { diffRightLines } from './diff.mjs';
import { LIST_MAX_PAGES, api, listAll } from './github.mjs';

export { diffRightLines };
export const APP_LOGIN = 'lantern-independent-review[bot]';
export const COMMENT_MARKER = '<!-- lantern-independent-review -->';
export const MAX_INLINE = 10;
const MAX_LISTED = 30;
const COMMENT_FINDINGS_MAX = 30_000;
export const CHECK_TEXT_MAX = 60_000;
const TOO_MANY = `more than ${LIST_MAX_PAGES * 100}`;
const HEAD = /<!-- head:([0-9a-f]{40}) -->/;
const RUN = /<!-- run:(\d+) -->/;
const FINDING = /<!-- lantern-ir:([0-9a-f]{16}) -->/;
const findingOf = comment => FINDING.exec(comment.body ?? '')?.[1];

const markup = text => text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/([\\`*_~|[\]()!])/g, '\\$1')
    .replace(/#(?=\d)/g, '#&#8203;')
    .replace(/@/g, '@&#8203;')
    .replace(/:\/\//g, ':&#8203;//')
    .replace(/www\./gi, 'www&#46;');

// The escaped result is at most max characters. Text cut to fit always says so and how much is missing.
export function escapeText(value, max = 2000) {
  const clean = String(value ?? '')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const whole = markup(clean);
  if (whole.length <= max) return whole;
  const cut = n => {
    let kept = clean.slice(0, n);
    if (/[\ud800-\udbff]$/.test(kept)) kept = kept.slice(0, -1);
    const missing = clean.length - kept.length;
    return `${markup(kept)} [truncated: ${missing} more character${missing === 1 ? '' : 's'} not shown]`;
  };
  let low = 0;
  let high = clean.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (cut(mid).length <= max) low = mid; else high = mid - 1;
  }
  return cut(low).slice(0, max);
}

export const FINDING_MESSAGE_MAX = 8000;

export const inlineCandidates = (verdict, rightLines) => verdict.findings
  .filter(f => f.severity !== 'minor' && f.file && f.line && rightLines.get(f.file)?.has(f.line))
  .slice(0, MAX_INLINE);

const where = f => (f.file ? ` ${escapeText(f.file, 300)}${f.line ? `:${f.line}` : ''}` : '');
const shortSha = sha => sha.slice(0, 7);
export const findingLine = f => `- **${f.severity}**${where(f)}: ${escapeText(f.message, FINDING_MESSAGE_MAX)}`;

// How many whole findings, from the start, fit in max characters.
export function fitFindings(findings, max) {
  let used = 0;
  let count = 0;
  for (const f of findings) {
    used += findingLine(f).length + 1;
    if (used > max) break;
    count++;
  }
  return count;
}
const findingKey = (sha, f) => createHash('sha256').update([sha, f.file, f.line, f.message].join('\0')).digest('hex').slice(0, 16);

export function summaryComment({ state, sha, runId, checkUrl, verdict, failureSummary, protectedFiles = [] }) {
  const head = `${COMMENT_MARKER}\n<!-- head:${sha} -->\n<!-- run:${runId} -->\n## Independent review\n\n`;
  const link = `[Open the check](${checkUrl})`;
  if (state === 'incomplete') return `${head}**Not completed** for \`${shortSha(sha)}\`\n\nThe check run could not be completed (${escapeText(failureSummary, 200)}), so no verdict is recorded for this commit. Run the review again.\n\n${link}`;
  if (state === 'unconfirmed') return `${head}**Outcome unconfirmed** for \`${shortSha(sha)}\`\n\nThe final update of the check run failed (${escapeText(failureSummary, 200)}) and its state could not be read back, so GitHub may or may not have recorded a verdict for this commit. Read the status of the **Independent review** check, which is the gate.\n\n${link}`;
  const label = state === 'success' ? 'Passed' : 'Requires changes';
  let body = `${head}**${label}** for \`${shortSha(sha)}\`\n\n`;
  if (verdict) {
    body += `${escapeText(verdict.summary, 4000)}\n\n`;
    const total = verdict.findings.length;
    if (total) {
      const listed = fitFindings(verdict.findings.slice(0, MAX_LISTED), COMMENT_FINDINGS_MAX);
      const inCheck = fitFindings(verdict.findings, CHECK_TEXT_MAX - 500);
      body += `### Findings (${total})\n\n${verdict.findings.slice(0, listed).map(findingLine).join('\n')}\n`;
      if (listed < total) body += inCheck >= total ? `- and ${total - listed} more in the check\n` : `- and ${total - listed} more not listed here; the check lists only the first ${inCheck} of ${total} because of its size limit, so ${total - inCheck} are not shown anywhere\n`;
      body += '\n';
    }
  } else {
    body += `${escapeText(failureSummary, 600)}\n\n`;
  }
  if (protectedFiles.length) body += `This change touches protected paths (${protectedFiles.map(file => escapeText(file, 200)).join(', ')}); it needs independent inspection and the owner's authorization before merge.\n\n`;
  return `${body}${link}\n\nAutomated advisory review of \`${shortSha(sha)}\` only. This is the result of one review run (check run ${runId}). Every run, including a rerun for the same commit, writes its own comment and no run edits another's, so confirm the pull request head is \`${shortSha(sha)}\` and read the status of the **Independent review** check, which is the gate. This is not a formal pull request approval or change request.`;
}

export function createFeedback({ fetch, token, repository, prNumber, sha, runId, checkUrl }) {
  const commentsPath = `/repos/${repository}/issues/${prNumber}/comments`;

  async function readPull() {
    const response = await api(fetch, token, 'GET', `/repos/${repository}/pulls/${prNumber}`);
    if (!response.ok) throw new Error(`status ${response.status}`);
    return response.json();
  }

  const isCurrent = pull => pull.state === 'open' && pull.head.sha === sha;
  const boundTo = comment => HEAD.exec(comment.body)?.[1];
  const isMine = comment => boundTo(comment) === sha && RUN.exec(comment.body)?.[1] === String(runId);

  async function ownComments() {
    const { items, truncated } = await listAll(fetch, token, commentsPath);
    if (truncated) throw new Error(`the pull request has ${TOO_MANY} comments, so this run's comment cannot be located safely`);
    return items.filter(c => c.user?.login === APP_LOGIN && typeof c.body === 'string' && c.body.startsWith(COMMENT_MARKER));
  }

  async function write(body, existing) {
    const response = existing
      ? await api(fetch, token, 'PATCH', `/repos/${repository}/issues/comments/${existing.id}`, { body: { body } })
      : await api(fetch, token, 'POST', commentsPath, { body: { body } });
    if (!response.ok) throw new Error(`status ${response.status}`);
    return { how: existing ? 'updated' : 'created', id: existing?.id ?? (await response.json()).id };
  }

  // Only this run's own comment is written: comments have no compare-and-swap.
  async function guardedUpsert(build) {
    if (!isCurrent(await readPull())) return { written: false };
    const mine = (await ownComments()).filter(isMine);
    const body = build();
    const { how } = await write(body, mine[0]);
    for (const duplicate of mine.slice(1)) await write(body, duplicate);
    return { written: true, how };
  }

  async function postInline(findings) {
    if (!isCurrent(await readPull())) return 'inline comments not posted: the pull request moved to a newer commit or closed';
    const { items: existing, truncated } = await listAll(fetch, token, `/repos/${repository}/pulls/${prNumber}/comments`);
    const done = new Set(existing.filter(c => c.user?.login === APP_LOGIN).map(findingOf));
    const fresh = findings.filter(f => !done.has(findingKey(sha, f)));
    if (!fresh.length) return `${findings.length ? 'inline findings already posted' : 'no inline findings'}`;
    const response = await api(fetch, token, 'POST', `/repos/${repository}/pulls/${prNumber}/reviews`, {
      body: {
        commit_id: sha,
        event: 'COMMENT',
        body: `Independent review of \`${shortSha(sha)}\`: ${fresh.length} blocker or major finding${fresh.length === 1 ? '' : 's'} on specific lines. See the summary comment for the full verdict. This is not a formal approval or change request.`,
        comments: fresh.map(f => ({ path: f.file, line: f.line, side: 'RIGHT', body: `**${f.severity}**: ${escapeText(f.message, FINDING_MESSAGE_MAX)}\n\n<!-- lantern-ir:${findingKey(sha, f)} -->` })),
      },
    });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const removed = truncated ? `; ${TOO_MANY} review comments exist, so duplicates could not be checked` : await removeDuplicates((await response.json()).id, new Set(fresh.map(f => findingKey(sha, f))));
    return `${fresh.length} inline comment${fresh.length === 1 ? '' : 's'} posted${removed}`;
  }

  // Listing and posting are not atomic, so concurrent runs can post the same finding; each run then deletes its own non-oldest copies. Best effort, not exactly-once.
  async function removeDuplicates(reviewId, keys) {
    try {
      const { items, truncated } = await listAll(fetch, token, `/repos/${repository}/pulls/${prNumber}/comments`);
      if (truncated) throw new Error(`${TOO_MANY} review comments exist`);
      const mine = items.filter(c => c.user?.login === APP_LOGIN).sort((a, b) => a.id - b.id);
      const oldest = new Map();
      for (const c of mine) if (keys.has(findingOf(c)) && !oldest.has(findingOf(c))) oldest.set(findingOf(c), c.id);
      const extra = mine.filter(c => c.pull_request_review_id === reviewId && keys.has(findingOf(c)) && oldest.get(findingOf(c)) !== c.id);
      let removed = 0;
      for (const c of extra) {
        const response = await api(fetch, token, 'DELETE', `/repos/${repository}/pulls/comments/${c.id}`);
        if (response.ok || response.status === 404) removed++;
        else throw new Error(`status ${response.status}`);
      }
      return removed ? `; ${removed} duplicate${removed === 1 ? '' : 's'} of a concurrent run removed` : '';
    } catch (error) {
      return `; duplicates from a concurrent run could not be checked or removed (${error.message})`;
    }
  }

  return {
    async markIncomplete({ reason, confirmed = true }) {
      try {
        await guardedUpsert(() => summaryComment({ state: confirmed ? 'incomplete' : 'unconfirmed', sha, runId, checkUrl, failureSummary: reason }));
      } catch { /* the run already fails and the check stays unfinished */ }
    },

    async publish({ conclusion, verdict, failureSummary, protectedFiles, diff }) {
      const notes = [];
      try {
        const result = await guardedUpsert(() => summaryComment({ state: conclusion, sha, runId, checkUrl, verdict, failureSummary, protectedFiles }));
        if (!result.written) return 'not published: the pull request moved to a newer commit or closed.';
        notes.push(`summary comment ${result.how}`);
      } catch (error) {
        return `could not be published (summary comment: ${error.message}). The verdict above is unaffected.`;
      }
      if (verdict && diff) {
        try {
          notes.push(await postInline(inlineCandidates(verdict, diffRightLines(diff))));
        } catch (error) {
          notes.push(`inline comments could not be published (${error.message}); the verdict is unaffected`);
        }
      }
      return `${notes.join('; ')}.`;
    },
  };
}
