import { normalizeVerdictText } from './verdict.mjs';

// Diagnostics must never contain response words, string values, source or credentials.
export function describeResponse(text) {
  if (typeof text !== 'string') return { textBytes: 0, start: 'missing', structure: '' };
  const trimmed = text.trim();
  const start = trimmed.startsWith('{') ? 'object' : trimmed.startsWith('[') ? 'array' : trimmed.startsWith('```') ? 'fence' : trimmed.startsWith('<think>') ? 'think' : 'other';
  const normalized = normalizeVerdictText(text);
  let structure = '';
  let i = 0;
  while (i < normalized.length && structure.length < 240) {
    const char = normalized[i++];
    if (/\s/.test(char)) continue;
    if (char === '"') {
      let closed = false;
      while (i < normalized.length) {
        const next = normalized[i++];
        if (next === '\\') i++;
        else if (next === '"') { closed = true; break; }
      }
      structure += closed ? '"…"' : '"…[unclosed]';
    } else if ('{}[]:,'.includes(char)) structure += char;
    else {
      while (i < normalized.length && !/[\s"{}\[\]:,]/.test(normalized[i])) i++;
      structure += '<value>';
    }
  }
  return { textBytes: Buffer.byteLength(text), start, structure: structure.slice(0, 240), structureClipped: i < normalized.length };
}
