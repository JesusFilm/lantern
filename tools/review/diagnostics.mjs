// Diagnostics must never contain response words, string values, source or credentials.
export function describeResponse(text) {
  if (typeof text !== 'string') return { textBytes: 0, start: 'missing', structure: '' };
  const trimmed = text.trim();
  const start = trimmed.startsWith('{') ? 'object' : trimmed.startsWith('[') ? 'array' : trimmed.startsWith('```') ? 'fence' : trimmed.startsWith('<think>') ? 'think' : 'other';
  let structure = '';
  let i = 0;
  while (i < text.length && structure.length < 240) {
    const char = text[i++];
    if (/\s/.test(char)) continue;
    if (char === '"') {
      let closed = false;
      while (i < text.length) {
        const next = text[i++];
        if (next === '\\') i++;
        else if (next === '"') { closed = true; break; }
      }
      structure += closed ? '"…"' : '"…[unclosed]';
    } else if ('{}[]:,'.includes(char)) structure += char;
    else {
      while (i < text.length && !/[\s"{}\[\]:,]/.test(text[i])) i++;
      structure += '<value>';
    }
  }
  return { textBytes: Buffer.byteLength(text), start, structure: structure.slice(0, 240), structureClipped: i < text.length };
}
