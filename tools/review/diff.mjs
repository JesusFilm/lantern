const EMPTY_BLOB = 'e69de29';

function parseSection(text) {
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  const header = /^diff --git a\/(.+?) b\/(.+)$/.exec(lines[0]);
  const meta = [];
  const rightLines = new Set();
  let hasHunks = false;
  let complete = true;
  let binary = false;
  for (let i = 1; i < lines.length; i++) {
    const hunk = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(lines[i]);
    if (!hunk) {
      if (/^Binary files .* differ$/.test(lines[i]) || lines[i] === 'GIT binary patch') binary = true;
      else meta.push(lines[i]);
      continue;
    }
    hasHunks = true;
    let oldLeft = hunk[1] === undefined ? 1 : Number(hunk[1]);
    let newLeft = hunk[3] === undefined ? 1 : Number(hunk[3]);
    let newLine = Number(hunk[2]);
    while (oldLeft > 0 || newLeft > 0) {
      i++;
      if (i >= lines.length) { complete = false; break; }
      if (lines[i].startsWith('\\')) continue;
      const kind = lines[i][0] ?? ' ';
      if (kind === ' ') { oldLeft--; newLeft--; rightLines.add(newLine++); }
      else if (kind === '-') oldLeft--;
      else if (kind === '+') { newLeft--; rightLines.add(newLine++); }
      else { complete = false; i--; break; }
      if (oldLeft < 0 || newLeft < 0) { complete = false; break; }
    }
  }
  const info = meta.join('\n');
  const path = /^\+\+\+ b\/(.+)$/m.exec(info)?.[1] ?? /^rename to (.+)$/m.exec(info)?.[1] ?? header?.[2];
  const oldPath = /^--- a\/(.+)$/m.exec(info)?.[1] ?? /^rename from (.+)$/m.exec(info)?.[1] ?? header?.[1];
  const pureRename = !hasHunks && !binary && /^similarity index 100%$/m.test(info) && /^rename from /m.test(info);
  const emptyFile = !hasHunks && !binary
    && ((/^new file mode/m.test(info) && new RegExp(`^index 0+\\.\\.${EMPTY_BLOB}`, 'm').test(info))
      || (/^deleted file mode/m.test(info) && new RegExp(`^index ${EMPTY_BLOB}[0-9a-f]*\\.\\.0+`, 'm').test(info)));
  const deleted = /^deleted file mode/m.test(info);
  let reason = null;
  if (!path) reason = 'unreadable file header';
  else if (binary) reason = 'binary file';
  else if (!complete) reason = 'incomplete patch';
  else if (!hasHunks && !pureRename && !emptyFile) reason = 'no patch (mode-only change or omitted content)';
  return { path, oldPath, rightLines, hasHunks, deleted, pureRename, emptyFile, reviewable: reason === null, reason };
}

export function parseDiff(diff) {
  return diff.split(/^(?=diff --git )/m).filter(section => section.startsWith('diff --git ')).map(parseSection);
}

export const diffFiles = diff => parseDiff(diff).map(section => section.path);

export const diffRightLines = diff => new Map(parseDiff(diff).filter(section => section.path).map(section => [section.path, section.rightLines]));

export const MAX_FILES = 100;
const PROTECTED = [/^\.github\//, /^tools\/review\//, /^tools\/release\//, /^CODEOWNERS$/, /^docs\/operations\/review-gate\.md$/];
export const isProtectedPath = path => PROTECTED.some(pattern => pattern.test(path));

export function protectedPathsIn(diff) {
  const hit = new Set();
  for (const section of parseDiff(diff)) {
    for (const path of [section.path, section.oldPath]) if (path && isProtectedPath(path)) hit.add(path);
  }
  return [...hit];
}

export function assessChange(diff, files) {
  const sections = parseDiff(diff);
  const listed = new Map(files.map(file => [file.filename, file]));
  const seen = new Map();
  const problems = [];
  const renames = [];
  for (const section of sections) {
    if (!section.path) { problems.push({ path: '(unreadable file header)', reason: 'unreadable file header' }); continue; }
    seen.set(section.path, section);
    const file = listed.get(section.path);
    if (!file) problems.push({ path: section.path, reason: 'in the diff but not in the file list for this comparison' });
    else if (!section.reviewable) problems.push({ path: section.path, reason: section.reason });
    else if (!file.patch && !(section.pureRename || section.emptyFile)) problems.push({ path: section.path, reason: 'no patch in the file list' });
    else if (!file.patch && file.changes !== 0) problems.push({ path: section.path, reason: 'no patch in the file list' });
    else if (section.pureRename) renames.push({ from: section.oldPath, to: section.path });
  }
  for (const file of files) {
    if (!seen.has(file.filename)) problems.push({ path: file.filename, reason: 'in the file list but missing from the diff' });
  }
  return { problems, renames };
}
