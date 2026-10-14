import { readFile, readdir, realpath } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryPath = fileURLToPath(new URL('../../', import.meta.url));

export interface Ticket {
  kind: 'milestone' | 'ticket';
  key: string;
  id: string;
  title: string;
  status: string;
  slice: string;
  summary: string;
  metadata: Record<string, string>;
  source: string;
  bodyHtml: string;
}
export interface TicketCollection { tickets: Ticket[] }

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;',
  })[character] ?? character);
}

function inline(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function markdown(value: string) {
  const output: string[] = [];
  const paragraph: string[] = [];
  let listing = false;
  let fenced: string[] | null = null;
  function flush() {
    if (paragraph.length) {
      output.push('<p>' + inline(paragraph.join(' ')) + '</p>');
      paragraph.length = 0;
    }
    if (listing) { output.push('</ul>'); listing = false; }
  }
  for (const line of value.split('\n')) {
    if (line.startsWith('```')) {
      flush();
      if (fenced === null) fenced = [];
      else {
        output.push('<pre><code>' + escapeHtml(fenced.join('\n')) + '</code></pre>');
        fenced = null;
      }
      continue;
    }
    if (fenced !== null) { fenced.push(line); continue; }
    if (!line.trim()) { flush(); continue; }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading?.[1] && heading[2]) {
      flush();
      const level = Math.min(heading[1].length + 1, 6);
      output.push('<h' + level + '>' + inline(heading[2]) + '</h' + level + '>');
      continue;
    }
    const bullet = /^-\s+(.+)$/.exec(line);
    if (bullet?.[1]) {
      if (paragraph.length) {
        output.push('<p>' + inline(paragraph.join(' ')) + '</p>');
        paragraph.length = 0;
      }
      if (!listing) { output.push('<ul>'); listing = true; }
      const text = bullet[1].replace(/^\[ \] /, '☐ ').replace(/^\[x\] /, '☑ ');
      output.push('<li>' + inline(text) + '</li>');
      continue;
    }
    if (listing) flush();
    paragraph.push(line);
  }
  flush();
  if (fenced !== null) output.push('<pre><code>' + escapeHtml(fenced.join('\n')) + '</code></pre>');
  return output.join('\n');
}

const field = /^(?:\*\*)?([A-Za-z][A-Za-z -]*):(?:\*\*)?\s*(.*?)\s*$/;
const bodyFields = new Set(['id', 'title', 'status', 'slice', 'summary', 'blocker', 'type', 'blocked by', 'labels', 'kind', 'milestone']);

export async function parseTicket(path: string, repository: string): Promise<Ticket> {
  const source = (await readFile(path, 'utf8')).replaceAll('\r\n', '\n');
  const lines = source.split('\n');
  const metadata: Record<string, string> = {};
  let bodyStart = 0;
  const start = lines[0]?.trim() === '---' ? 1 : 0;
  const end = lines.findIndex((line, index) => index >= start && line.trim() === '---');
  const header = end >= start ? lines.slice(start, end) : [];
  if (header.length && header.every((line) => !line.trim() || field.test(line))) {
    for (const line of header) {
      const match = field.exec(line);
      if (match?.[1] && match[2] !== undefined) metadata[match[1]] = match[2].trim().replace(/^["']+|["']+$/g, '');
    }
    bodyStart = end + 1;
  }
  const body: string[] = [];
  let fenced = false;
  for (const line of lines.slice(bodyStart)) {
    if (line.startsWith('```')) fenced = !fenced;
    const match = fenced ? null : field.exec(line);
    if (match?.[1] && match[2] !== undefined && bodyFields.has(match[1].toLowerCase())) metadata[match[1]] = match[2];
    else body.push(line);
  }
  const lookup = Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key.toLowerCase(), value]));
  const kind = lookup.kind || 'ticket';
  if (kind !== 'milestone' && kind !== 'ticket') throw new Error('Unknown work-item Kind in ' + path);
  if (kind === 'milestone' && (basename(path) !== 'milestone.md' || basename(resolve(path, '..')) === 'issues')) throw new Error('Milestones belong in <feature>/milestone.md, outside issues/: ' + path);
  if (basename(path) === 'milestone.md' && kind !== 'milestone') throw new Error('milestone.md requires Kind: milestone in ' + path);
  const heading = body.find((line) => line.startsWith('# '))?.slice(2);
  const stem = basename(path, '.md');
  const feature = basename(resolve(path, basename(path) === 'milestone.md' ? '..' : '../..'));
  const title = lookup.title || heading || stem;
  if (heading === title) body.splice(body.indexOf('# ' + heading), 1);
  const slice = lookup.slice || feature.replaceAll('-', ' ').replace(/^./, (character) => character.toUpperCase());
  const id = lookup.id || feature + '/' + stem.split('-')[0];
  const paragraph = body.find((line) => line.trim() && !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('```')) ?? '';
  return {
    key: relative(repository, path).split(sep).join('/'),
    kind, id, title, status: lookup.status || (kind === 'milestone' ? 'Planning' : 'needs-triage'), slice,
    summary: lookup.summary || paragraph.replace(/[*`]+/g, '').slice(0, 220),
    metadata, source, bodyHtml: markdown(body.join('\n').trim()),
  };
}

async function entries(path: string) {
  try { return await readdir(path, { withFileTypes: true }); }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function loadTickets(repository = repositoryPath): Promise<TicketCollection> {
  const scratch = resolve(repository, '.scratch');
  const features = await entries(scratch);
  if (!features.length) return { tickets: [] };
  const scratchReal = await realpath(scratch);
  const paths: string[] = [];
  for (const feature of features) {
    if (!feature.isDirectory()) continue;
    const featurePath = join(scratch, feature.name);
    const candidates = [
      ...(await entries(featurePath)).filter(entry => entry.name === 'milestone.md').map(entry => ({ entry, directory: featurePath })),
      ...(await entries(join(featurePath, 'issues'))).map(entry => ({ entry, directory: join(featurePath, 'issues') })),
    ];
    for (const {entry, directory} of candidates) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const path = join(directory, entry.name);
      const resolved = await realpath(path);
      const withinScratch = relative(scratchReal, resolved);
      if (withinScratch === '..' || withinScratch.startsWith('..' + sep)) continue;
      paths.push(path);
    }
  }
  const tickets = await Promise.all(paths.sort().map((path) => parseTicket(path, repository)));
  tickets.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'milestone' ? -1 : 1;
    if (left.kind === 'milestone') return (Number(left.metadata.Sequence) || 0) - (Number(right.metadata.Sequence) || 0) || left.key.localeCompare(right.key);
    return left.key.localeCompare(right.key);
  });
  return { tickets };
}
