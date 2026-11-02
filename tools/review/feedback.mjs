import { createHash } from 'node:crypto';
import { diffRightLines } from './diff.mjs';
import { api, listAll } from './github.mjs';

export { diffRightLines };
export const APP_LOGIN = 'lantern-independent-review[bot]';
export const COMMENT_MARKER = '<!-- lantern-independent-review -->';
export const MAX_INLINE = 10;
const MAX_LISTED = 30;
const HEAD = /<!-- head:([0-9a-f]{40}) -->/;

export function escapeText(value, max = 2000) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f‪-‮⁦-⁩]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/([\\`*_~|[\]()!])/g, '\\$1')
    .replace(/#(?=\d)/g, '#&#8203;')
    .replace(/@/g, '@&#8203;')
    .replace(/:\/\//g, ':&#8203;//')
    .replace(/www\./gi, 'www&#46;');
}

export const inlineCandidates = (verdict, rightLines) => verdict.findings
  .filter(f => f.severity !== 'minor' && f.file && f.line && rightLines.get(f.file)?.has(f.line))
  .slice(0, MAX_INLINE);

const where = f => (f.file ? ` ${escapeText(f.file, 300)}${f.line ? `:${f.line}` : ''}` : '');
const shortSha = sha => sha.slice(0, 7);
const findingKey = (sha, f) => createHash('sha256').update([sha, f.file, f.line, f.message].join('\0')).digest('hex').slice(0, 16);

export function summaryComment({ state, sha, previousSha, currentSha, checkUrl, checksUrl, verdict, failureSummary, protectedFiles = [] }) {
  const head = `${COMMENT_MARKER}\n<!-- head:${sha} -->\n## Independent review\n\n`;
  const link = `[Open the check](${checkUrl})`;
  if (state === 'superseded') return `${head}**Superseded**: the head is now \`${shortSha(currentSha)}\`, so this comment no longer describes it. See the [checks](${checksUrl}) for its verdict.`;
  if (state === 'running') {
    const superseded = previousSha && previousSha !== sha ? ` The earlier verdict for \`${shortSha(previousSha)}\` is superseded.` : '';
    return `${head}**Reviewing** \`${shortSha(sha)}\`.${superseded}\n\n${link}`;
  }
  const label = state === 'success' ? 'Passed' : 'Requires changes';
  let body = `${head}**${label}** for \`${shortSha(sha)}\`\n\n`;
  if (verdict) {
    body += `${escapeText(verdict.summary, 4000)}\n\n`;
    if (verdict.findings.length) {
      body += `### Findings (${verdict.findings.length})\n\n${verdict.findings.slice(0, MAX_LISTED).map(f => `- **${f.severity}**${where(f)}: ${escapeText(f.message)}`).join('\n')}\n`;
      if (verdict.findings.length > MAX_LISTED) body += `- and ${verdict.findings.length - MAX_LISTED} more in the check\n`;
      body += '\n';
    }
  } else {
    body += `${escapeText(failureSummary, 600)}\n\n`;
  }
  if (protectedFiles.length) body += `This change touches protected paths (${protectedFiles.map(file => escapeText(file, 200)).join(', ')}); it needs independent inspection and the owner's authorization before merge.\n\n`;
  return `${body}${link}\n\nAutomated advisory review of \`${shortSha(sha)}\` only; a new push supersedes it. The **Independent review** check is the gate. This is not a formal pull request approval or change request.`;
}

export function createFeedback({ fetch, token, repository, prNumber, sha, checkUrl }) {
  const commentsPath = `/repos/${repository}/issues/${prNumber}/comments`;
  const checksUrl = `https://github.com/${repository}/pull/${prNumber}/checks`;

  async function readPull() {
    const response = await api(fetch, token, 'GET', `/repos/${repository}/pulls/${prNumber}`);
    if (!response.ok) throw new Error(`status ${response.status}`);
    return response.json();
  }

  const isCurrent = pull => pull.state === 'open' && pull.head.sha === sha;

  async function ownComment() {
    const comments = await listAll(fetch, token, commentsPath);
    return comments.find(c => c.user?.login === APP_LOGIN && typeof c.body === 'string' && c.body.startsWith(COMMENT_MARKER));
  }

  async function upsert(body, existing) {
    const response = existing
      ? await api(fetch, token, 'PATCH', `/repos/${repository}/issues/comments/${existing.id}`, { body: { body } })
      : await api(fetch, token, 'POST', commentsPath, { body: { body } });
    if (!response.ok) throw new Error(`status ${response.status}`);
    return existing ? 'updated' : 'created';
  }

  // GitHub has no compare-and-swap for comments: guard before the write, repair after it.
  async function guardedUpsert(build) {
    if (!isCurrent(await readPull())) return { written: false };
    const existing = await ownComment();
    const how = await upsert(build(existing), existing);
    const after = await readPull();
    if (after.head.sha === sha) return { written: true, how };
    const own = await ownComment();
    if (own && HEAD.exec(own.body)?.[1] === sha) {
      await upsert(summaryComment({ state: 'superseded', sha, currentSha: after.head.sha, checksUrl }), own);
      return { written: true, how, repaired: true };
    }
    return { written: true, how };
  }

  async function postInline(findings) {
    if (!isCurrent(await readPull())) return 'inline comments not posted: the pull request moved to a newer commit or closed';
    const existing = await listAll(fetch, token, `/repos/${repository}/pulls/${prNumber}/comments`);
    const done = new Set(existing.filter(c => c.user?.login === APP_LOGIN).map(c => /<!-- lantern-ir:([0-9a-f]{16}) -->/.exec(c.body ?? '')?.[1]));
    const fresh = findings.filter(f => !done.has(findingKey(sha, f)));
    if (!fresh.length) return `${findings.length ? 'inline findings already posted' : 'no inline findings'}`;
    const response = await api(fetch, token, 'POST', `/repos/${repository}/pulls/${prNumber}/reviews`, {
      body: {
        commit_id: sha,
        event: 'COMMENT',
        body: `Independent review of \`${shortSha(sha)}\`: ${fresh.length} blocker or major finding${fresh.length === 1 ? '' : 's'} on specific lines. See the summary comment for the full verdict. This is not a formal approval or change request.`,
        comments: fresh.map(f => ({ path: f.file, line: f.line, side: 'RIGHT', body: `**${f.severity}**: ${escapeText(f.message)}\n\n<!-- lantern-ir:${findingKey(sha, f)} -->` })),
      },
    });
    if (!response.ok) throw new Error(`status ${response.status}`);
    return `${fresh.length} inline comment${fresh.length === 1 ? '' : 's'} posted`;
  }

  return {
    async announce() {
      try {
        await guardedUpsert(existing => summaryComment({ state: 'running', sha, previousSha: existing ? HEAD.exec(existing.body)?.[1] : undefined, checkUrl }));
      } catch { /* the final publication reports any problem */ }
    },

    async publish({ conclusion, verdict, failureSummary, protectedFiles, diff }) {
      const notes = [];
      try {
        const result = await guardedUpsert(() => summaryComment({ state: conclusion, sha, checkUrl, verdict, failureSummary, protectedFiles }));
        if (!result.written) return 'not published: the pull request moved to a newer commit or closed.';
        notes.push(`summary comment ${result.how}${result.repaired ? ', then marked superseded because the head moved while publishing' : ''}`);
        if (result.repaired) return `${notes.join('; ')}.`;
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
