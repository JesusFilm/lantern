import { api } from './github.mjs';
import { isProtectedPath } from './diff.mjs';

const GUIDANCE_FILE_MAX = 30_000;
const GUIDANCE_TOTAL_MAX = 60_000;
export const CONTEXT_FILE_MAX = 60_000;
export const CONTEXT_TOTAL_MAX = 200_000;

const DECODER = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const clip = (text, max) => (text.length > max ? `${text.slice(0, max)}\n[truncated at ${max} characters]` : text);

async function fetchText(fetch, token, repository, path, ref) {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  const response = await api(fetch, token, 'GET', `/repos/${repository}/contents/${encoded}?ref=${ref}`, { accept: 'application/vnd.github.raw+json' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`could not read ${path} at ${ref.slice(0, 7)} (status ${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.includes(0)) return { omitted: 'the file is binary (it contains NUL bytes)' };
  try { return DECODER.decode(bytes); } catch { return { omitted: 'the file is not valid UTF-8 text' }; }
}

export function guidancePaths(paths) {
  const list = [{ path: 'AGENTS.md', required: true }, { path: 'CONTEXT.md' }, { path: 'GLOSSARY.md' }, { path: 'docs/development/testing.md' }];
  if (paths.some(isProtectedPath)) list.push({ path: 'docs/operations/review-gate.md' });
  if (paths.some(path => path.startsWith('docs/adrs/'))) list.push({ path: 'docs/adrs/AGENTS.md' });
  if (paths.some(path => path.startsWith('.github/') || path.startsWith('docs/operations/'))) list.push({ path: 'docs/operations/releasing.md' });
  return list;
}

export async function loadGuidance({ fetch, token, repository, baseSha, paths }) {
  const guidance = [];
  let total = 0;
  for (const { path, required } of guidancePaths(paths)) {
    const text = await fetchText(fetch, token, repository, path, baseSha);
    if (text === null) {
      if (required) throw new Error(`required repository guidance ${path} is missing at the base commit`);
      continue;
    }
    if (text.omitted) { guidance.push({ path, omitted: text.omitted }); continue; }
    const room = Math.min(GUIDANCE_FILE_MAX, GUIDANCE_TOTAL_MAX - total);
    if (room <= 0) { guidance.push({ path, omitted: 'the guidance budget was used up' }); continue; }
    const clipped = clip(text, room);
    guidance.push({ path, text: clipped, ...(text.length > room ? { clipped: true } : {}) });
    total += clipped.length;
  }
  return guidance;
}

export async function loadFileContext({ fetch, token, repository, headSha, files }) {
  const context = [];
  let total = 0;
  for (const file of files) {
    if (file.status === 'added' || file.status === 'removed') continue;
    const text = await fetchText(fetch, token, repository, file.filename, headSha);
    if (text === null) { context.push({ path: file.filename, omitted: 'the file was not found at the head commit' }); continue; }
    if (text.omitted) { context.push({ path: file.filename, omitted: text.omitted }); continue; }
    const room = Math.min(CONTEXT_FILE_MAX, CONTEXT_TOTAL_MAX - total);
    if (room <= 0) { context.push({ path: file.filename, omitted: 'the context budget was used up' }); continue; }
    const clipped = clip(text, room);
    context.push({ path: file.filename, text: clipped, ...(text.length > room ? { clipped: true } : {}) });
    total += clipped.length;
  }
  return context;
}
