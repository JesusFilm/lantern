import { createHash } from 'node:crypto';
import { api } from './github.mjs';

const pdfPath = 'docs/manual/lantern-manual.pdf';
const screenshot = /^docs\/manual\/screenshots\/([a-z0-9][a-z0-9-]*\.png)$/;
const allowed = path => path === pdfPath || screenshot.test(path);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const maxBytes = 20_000_000;

async function read(fetch, token, repository, path, headSha) {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  const response = await api(fetch, token, 'GET', `/repos/${repository}/contents/${encoded}?ref=${headSha}`, { accept: 'application/vnd.github.raw+json' });
  if (!response.ok) throw new Error(`${path}: unable to read head content (status ${response.status})`);
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error(`${path}: artifact exceeds size limit`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) throw new Error(`${path}: artifact exceeds size limit`);
  return bytes;
}

// Only ordinary binary additions and modifications qualify. Deletions, renames,
// mode changes and malformed sections stay in the normal fail-closed path.
export async function manualArtifacts({ fetch, token, repository, headSha, diff, files }) {
  const sections = diff.split(/^(?=diff --git )/m).filter(s => s.startsWith('diff --git '));
  const candidates = [];
  for (const file of files) {
    if (file.status === 'renamed' && (allowed(file.filename) || allowed(file.previous_filename ?? ''))) throw new Error(`${file.filename}: manual artifact renames require independent inspection`);
    if (!allowed(file.filename)) continue;
    const matching = sections.filter(s => s.startsWith(`diff --git a/${file.filename} b/${file.filename}\n`));
    if (matching.length !== 1) continue;
    const section = matching[0];
    const regular = file.status === 'modified'
      ? /^index [0-9a-f]+\.\.[0-9a-f]+ 100644$/m.test(section)
      : file.status === 'added' && /^new file mode 100644$/m.test(section);
    if (!regular || files.filter(other => other.filename === file.filename).length !== 1 || /^(old mode|new mode|deleted file mode|rename from|rename to) /m.test(section)
      || !/^Binary files .* differ$/m.test(section) || /^@@ /m.test(section)
      || file.patch || file.changes !== 0 || file.additions !== 0 || file.deletions !== 0) continue;
    candidates.push(file.filename);
  }
  if (!candidates.length) return [];
  let manifest;
  try { manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await read(fetch, token, repository, 'docs/manual/manifest.json', headSha))); }
  catch { throw new Error('docs/manual/manifest.json: head manifest is missing or invalid'); }
  for (const path of candidates) {
    const expected = path === pdfPath ? manifest?.pdf : manifest?.screenshots?.[screenshot.exec(path)[1]];
    if (typeof expected !== 'string' || !/^[0-9a-f]{64}$/.test(expected)) throw new Error(`${path}: missing valid SHA-256 in head manifest`);
    const data = await read(fetch, token, repository, path, headSha);
    const signature = path === pdfPath ? Buffer.from('%PDF-') : Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (!data.subarray(0, signature.length).equals(signature)) throw new Error(`${path}: invalid file signature`);
    if (sha(data) !== expected) throw new Error(`${path}: SHA-256 does not match head manifest`);
  }
  return candidates;
}
