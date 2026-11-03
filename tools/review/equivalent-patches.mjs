import { api } from './github.mjs';
import { decodeStrict } from './context.mjs';
import { parseDiff } from './diff.mjs';
import { provePatch } from './patch-proof.mjs';

// Only an exact-patch mismatch is eligible; all other global checks remain intact.
export async function equivalentPatches({ fetch, token, repository, mergeBaseSha, headSha, diff, files, problems }) {
  const verified = new Set();
  if (!/^[a-f0-9]{40}$/.test(mergeBaseSha ?? '')) return verified;
  let totalBytes = 0;
  async function read(path, ref) {
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    const response = await api(fetch, token, 'GET', `/repos/${repository}/contents/${encoded}?ref=${ref}`, { accept: 'application/vnd.github.raw+json' });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Patch proof cannot read ${path} at pinned revision (status ${response.status})`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    totalBytes += bytes.length;
    if (bytes.length > 2_000_000 || totalBytes > 4_000_000) throw new Error('Patch proof source budget exceeded');
    const decoded = decodeStrict(bytes);
    if (decoded.problem) throw new Error(`Patch proof requires valid text: ${path}`);
    return decoded.text;
  }
  const sections = parseDiff(diff);
  for (const problem of problems) {
    if (!problem.reason.startsWith('the diff does not match the patch GitHub lists for this file')) continue;
    const section = sections.find(s => s.path === problem.path);
    const file = files.find(f => f.filename === problem.path);
    if (!section?.reviewable || !file?.patch || file.additions !== section.additions || file.deletions !== section.deletions || file.changes !== section.additions + section.deletions) continue;
    const records = file.patch.split('\n');
    if (records.filter(line => line.startsWith('+')).length !== file.additions || records.filter(line => line.startsWith('-')).length !== file.deletions) continue;
    const before = await read(file.previous_filename ?? file.filename, mergeBaseSha);
    const after = await read(file.filename, headSha);
    if ((file.status === 'added' ? before !== null : before === null) || (file.status === 'removed' ? after !== null : after === null)) continue;
    if (provePatch(section.patch, before ?? '', after ?? '') && provePatch(file.patch, before ?? '', after ?? '')) verified.add(file.filename);
  }
  return verified;
}
