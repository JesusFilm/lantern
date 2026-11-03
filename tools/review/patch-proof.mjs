/** Prove a single file's unified hunk body against its complete base and head. */
export function provePatch(patch, before, after) {
  if (typeof patch !== 'string' || typeof before !== 'string' || typeof after !== 'string') return false;
  if (patch === '') return before === after;
  const lines = text => text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const oldLines = lines(before);
  const newLines = lines(after);
  const records = patch.split('\n');
  if (records.at(-1) === '') records.pop();
  let oldCursor = 0;
  let newCursor = 0;
  let index = 0;
  while (index < records.length) {
    const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?: .*)?$/.exec(records[index++]);
    if (!header) return false;
    const oldStart = Number(header[1]);
    const oldCount = header[2] === undefined ? 1 : Number(header[2]);
    const newStart = Number(header[3]);
    const newCount = header[4] === undefined ? 1 : Number(header[4]);
    if (![oldStart, oldCount, newStart, newCount].every(Number.isSafeInteger)) return false;
    if (oldCount === 0 && newCount === 0) return false;
    const oldOffset = oldCount === 0 ? oldStart : oldStart - 1;
    const newOffset = newCount === 0 ? newStart : newStart - 1;
    if (oldOffset < oldCursor || newOffset < newCursor || oldOffset > oldLines.length || newOffset > newLines.length) return false;
    if (oldOffset - oldCursor !== newOffset - newCursor) return false;
    while (oldCursor < oldOffset) {
      if (oldLines[oldCursor++] !== newLines[newCursor++]) return false;
    }
    let oldUsed = 0;
    let newUsed = 0;
    while (index < records.length && !records[index].startsWith('@@')) {
      const record = records[index++];
      const kind = record[0];
      if (kind !== ' ' && kind !== '-' && kind !== '+') return false;
      const noNewline = records[index] === '\\ No newline at end of file';
      if (noNewline) index++;
      const content = record.slice(1) + (noNewline ? '' : '\n');
      if (kind !== '+') {
        if (++oldUsed > oldCount || oldLines[oldCursor++] !== content) return false;
      }
      if (kind !== '-') {
        if (++newUsed > newCount || newLines[newCursor++] !== content) return false;
      }
    }
    if (oldUsed !== oldCount || newUsed !== newCount) return false;
  }
  return oldLines.slice(oldCursor).join('') === newLines.slice(newCursor).join('');
}
