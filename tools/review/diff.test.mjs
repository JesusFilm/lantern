import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { MAX_INLINE, diffRightLines } from './feedback.mjs';
import { protectedPathsIn } from './review.mjs';
import { assessChange, diffFiles } from './diff.mjs';
import { SHA, json, DIFF, BASE, filesFromDiff, world, run, finalCheck, OTHER_DIFF, BINARY, MODE_ONLY, RENAME, EMPTY_ADDED, modelCalls, userMessage, github, section, HUNK_1, TWO_HUNKS, ONE_HUNK } from './fake-github.mjs';

test('unreviewable content: binary, omitted, mode-only and unlisted files fail closed before any model call', async () => {
  const cases = {
    'binary mixed with reviewable': { diff: DIFF + BINARY, expect: /logo\.png.*binary file/ },
    'mode only mixed with reviewable': { diff: DIFF + MODE_ONLY, expect: /run\.sh/ },
    'file list entry without a patch hidden from the diff text': { diff: DIFF, files: [...filesFromDiff(DIFF), { filename: 'hidden.bin', status: 'added', changes: 0 }], expect: /hidden\.bin.*missing from the diff/ },
    'diff text file missing from the file list': { diff: DIFF + OTHER_DIFF, files: filesFromDiff(DIFF), expect: /Other\.tsx.*not in the file list/ },
    'file list says no patch while the diff has hunks': { diff: DIFF, files: filesFromDiff(DIFF).map(({ patch, ...file }) => file), expect: /Guide\.tsx.*no patch in the file list/ },
    'zero-change file list entry without a patch while the diff has hunks': { diff: DIFF, files: filesFromDiff(DIFF).map(({ patch, ...file }) => ({ ...file, changes: 0 })), expect: /Guide\.tsx.*no patch in the file list/ },
    'file list claims a patch for a mode-only change': { diff: MODE_ONLY, files: [{ filename: 'run.sh', status: 'modified', changes: 0, patch: '@@ -0,0 +0,0 @@' }], expect: /run\.sh.*(no patch|mode change)/ },
    'binary marker only in the diff text': { diff: DIFF + BINARY, files: [...filesFromDiff(DIFF), { filename: 'logo.png', status: 'added', changes: 1, patch: '@@ -0,0 +1 @@\n+x' }], expect: /logo\.png.*binary file/ },
  };
  for (const [name, { expect, ...options }] of Object.entries(cases)) {
    const w = world(options);
    const result = await run(w);
    assert.equal(result.conclusion, 'failure', name);
    assert.equal(modelCalls(w).length, 0, name);
    assert.match(finalCheck(w).output.title, /Unreviewable changes/, name);
    assert.match(finalCheck(w).output.summary, expect, name);
    assert.match(finalCheck(w).output.summary, /Guide\.tsx|assessed/i, name);
  }
});

test('unreviewable content: a truncated or unreadable file list fails closed', async () => {
  const section = name => `diff --git a/${name} b/${name}\n--- a/${name}\n+++ b/${name}\n@@ -1 +1 @@\n-a\n+b\n`;
  const names = n => Array.from({ length: n }, (_, i) => `f${i}.ts`);
  const consistent = n => ({ diff: names(n).map(section).join('') });
  assert.equal((await run(world(consistent(99)))).conclusion, 'success');
  for (const [name, options] of Object.entries({ 'at the file cap, with a complete and consistent diff': consistent(100), 'file list error': { listStatus: 500 }, 'not an array': { files: 'nope' } })) {
    const w = world(options);
    assert.equal((await run(w)).conclusion, 'failure', name);
    assert.equal(modelCalls(w).length, 0, name);
  }
});

test('unreviewable content: pure renames and empty files are an explicit allowed policy and are disclosed to the model', async () => {
  const w = world({ diff: DIFF + RENAME + EMPTY_ADDED });
  const result = await run(w);
  assert.equal(result.conclusion, 'success');
  assert.match(userMessage(w), /files renamed without any content change[\s\S]*old-name\.ts -> new-name\.ts/);
  assert.deepEqual(assessChange(RENAME, filesFromDiff(RENAME)), { problems: [], renames: [{ from: 'old-name.ts', to: 'new-name.ts' }] });
  assert.equal(assessChange(RENAME + BINARY, filesFromDiff(RENAME + BINARY)).problems.length, 1);
  const edited = 'diff --git a/a.ts b/b.ts\nsimilarity index 80%\nrename from a.ts\nrename to b.ts\n--- a/a.ts\n+++ b/b.ts\n@@ -1 +1 @@\n-x\n+y\n';
  assert.equal(assessChange(edited, filesFromDiff(edited)).problems.length, 0);
});

test('unreviewable content: a hunk line that looks like a file header cannot hide or invent a file', () => {
  const tricky = 'diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1,2 +1,3 @@\n keep\n+++ b/secret/forged.txt\n+more\n';
  assert.deepEqual(diffFiles(tricky), ['a.txt']);
  assert.deepEqual([...diffRightLines(tricky).get('a.txt')], [1, 2, 3]);
  assert.equal(diffRightLines(tricky).has('secret/forged.txt'), false);
  assert.deepEqual(protectedPathsIn('diff --git a/.github/x.yml b/docs/x.yml\nsimilarity index 100%\nrename from .github/x.yml\nrename to docs/x.yml\n'), ['.github/x.yml']);
  const cut = 'diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1,5 +1,5 @@\n a\n';
  assert.equal(assessChange(cut, [{ filename: 'a.txt', status: 'modified', changes: 1, patch: '@@' }]).problems[0].reason, 'incomplete patch');
});

test('patch completeness: a diff cut between two complete hunks fails closed, even though what remains is well formed', async () => {
  const full = filesFromDiff(TWO_HUNKS);
  const cases = {
    'model diff omits the second hunk': { diff: ONE_HUNK, files: full },
    'file list patch is also cut but GitHub counts show the full change': { diff: ONE_HUNK, files: filesFromDiff(ONE_HUNK).map(f => ({ ...f, additions: 2, deletions: 2, changes: 4 })) },
    'same counts but different text': { diff: TWO_HUNKS.replace('+Y', '+Z'), files: full },
    'extra hunk not in the file list patch': { diff: TWO_HUNKS, files: filesFromDiff(ONE_HUNK).map(f => ({ ...f, additions: 2, deletions: 2, changes: 4 })) },
    'counts missing from the file list': { diff: TWO_HUNKS, files: full.map(({ additions, deletions, ...f }) => f) },
    'a change without a patch claims added lines': { diff: RENAME, files: [{ filename: 'new-name.ts', previous_filename: 'old-name.ts', status: 'renamed', additions: 3, deletions: 0, changes: 3 }] },
  };
  for (const [name, options] of Object.entries(cases)) {
    const w = world(options);
    const result = await run(w);
    assert.equal(result.conclusion, 'failure', name);
    assert.equal(modelCalls(w).length, 0, name);
    assert.match(finalCheck(w).output.title, /Unreviewable changes/, name);
    assert.match(finalCheck(w).output.summary, /does not match the patch|no patch in the file list/, name);
  }
  const complete = world({ diff: TWO_HUNKS });
  assert.equal((await run(complete)).conclusion, 'success');
  assert.match(userMessage(complete), /@@ -10,3 \+10,3 @@/);
});

test('patch completeness: each listed count is checked on its own, and non-numeric counts are rejected', async () => {
  const [good] = filesFromDiff(TWO_HUNKS);
  const bad = {
    'additions only': { ...good, additions: good.additions + 1, changes: good.changes + 1 },
    'deletions only': { ...good, deletions: good.deletions + 1, changes: good.changes + 1 },
    'additions up and deletions down, same total': { ...good, additions: good.additions + 1, deletions: good.deletions - 1 },
    'deletions up and additions down, same total': { ...good, additions: good.additions - 1, deletions: good.deletions + 1 },
    'changes only': { ...good, changes: good.changes + 1 },
    'additions as text': { ...good, additions: String(good.additions) },
    'deletions missing': { ...good, deletions: undefined },
  };
  for (const [name, file] of Object.entries(bad)) assert.equal(assessChange(TWO_HUNKS, [file]).problems.length, 1, name);
  assert.deepEqual(assessChange(TWO_HUNKS, [good]).problems, []);
  const noPatch = { filename: 'new-name.ts', previous_filename: 'old-name.ts', status: 'renamed', additions: 0, deletions: 0, changes: 0 };
  assert.deepEqual(assessChange(RENAME, [noPatch]).problems, []);
  for (const [name, extra] of Object.entries({ additions: { additions: 2 }, deletions: { deletions: 2 }, changes: { changes: 2 } })) {
    assert.equal(assessChange(RENAME, [{ ...noPatch, ...extra }]).problems.length, 1, name);
  }
});

test('patch completeness: no-newline markers and renamed files with edits still match their listed patch', async () => {
  const noNewline = section('a.txt', '@@ -1 +1 @@\n-a\n\\ No newline at end of file\n+b\n\\ No newline at end of file\n');
  assert.deepEqual(assessChange(noNewline, filesFromDiff(noNewline)).problems, []);
  const edited = 'diff --git a/a.ts b/b.ts\nsimilarity index 80%\nrename from a.ts\nrename to b.ts\n--- a/a.ts\n+++ b/b.ts\n' + HUNK_1;
  assert.deepEqual(assessChange(edited, filesFromDiff(edited)).problems, []);
  assert.equal(assessChange(edited.replace('+B', '+C'), filesFromDiff(edited)).problems.length, 1);
});

test('mode changes: a 100% rename that also changes the file mode is not a pure rename and is not approved', async () => {
  const renameMode = 'diff --git a/run.sh b/bin/run.sh\nold mode 100644\nnew mode 100755\nsimilarity index 100%\nrename from run.sh\nrename to bin/run.sh\n';
  assert.deepEqual(assessChange(RENAME, filesFromDiff(RENAME)).renames, [{ from: 'old-name.ts', to: 'new-name.ts' }]);
  const assessed = assessChange(renameMode, filesFromDiff(renameMode));
  assert.deepEqual(assessed.renames, []);
  assert.match(assessed.problems[0].reason, /file mode change \(100644 -> 100755\)/);
  const withHunks = 'diff --git a/run.sh b/run.sh\nold mode 100644\nnew mode 100755\nindex 1..2\n--- a/run.sh\n+++ b/run.sh\n' + HUNK_1;
  const cases = { 'rename with mode change': renameMode, 'edit with mode change': withHunks, 'mode change next to a reviewable file': DIFF + renameMode };
  for (const [name, diff] of Object.entries(cases)) {
    const w = world({ diff });
    assert.equal((await run(w)).conclusion, 'failure', name);
    assert.equal(modelCalls(w).length, 0, name);
    assert.match(finalCheck(w).output.summary, /file mode change \(100644 -> 100755\) is not assessed/, name);
  }
  const created = 'diff --git a/tool.sh b/tool.sh\nnew file mode 100755\nindex 0000000..1111111\n--- /dev/null\n+++ b/tool.sh\n@@ -0,0 +1 @@\n+echo\n';
  const w = world({ diff: created, files: filesFromDiff(created) });
  assert.equal((await run(w)).conclusion, 'success');
  assert.match(userMessage(w), /new file mode 100755/);
});

const real = JSON.parse(readFileSync(new URL('./fixtures/compare-79484b4.json', import.meta.url), 'utf8'));
const BIDI = /[\u202a-\u202e\u2066-\u2069]/g;
const withFiles = edit => real.files.map(file => (file.filename === 'tools/review/feedback.mjs' ? { ...file, patch: edit(file.patch) } : file));
const problemsFor = (diff, files) => assessChange(diff, files).problems;

test('patch fidelity: the real GitHub compare (diff media type and JSON patches) is accepted, including the file with Unicode control characters', () => {
  assert.equal(real.files.length, 3);
  assert.ok((real.diff.match(BIDI) ?? []).length >= 4, 'the captured diff carries the bidirectional control characters');
  assert.deepEqual(problemsFor(real.diff, real.files), []);
});

test('patch fidelity: the raw GitHub representation must match exactly, so a changed or removed invisible character fails closed', () => {
  assert.deepEqual(problemsFor(real.diff, withFiles(patch => `${patch}\n`)), [], 'a trailing newline is the only tolerated difference');
  const hidden = {
    'control characters dropped from the JSON patch': patch => patch.replace(BIDI, ''),
    'control characters replaced by U+FFFD': patch => patch.replace(BIDI, '\ufffd'),
    'one control character replaced by another': patch => patch.replace('\u202e', '\u202d'),
    'a zero-width character inserted': patch => patch.replace('+import', '+\u200b\ufeffimport'),
    'CRLF line endings': patch => patch.replace(/\n/g, '\r\n'),
  };
  for (const [name, edit] of Object.entries(hidden)) {
    const problems = problemsFor(real.diff, withFiles(edit));
    assert.equal(problems.length, 1, name);
    assert.match(problems[0].reason, /patch line \d+ differs in text/, name);
  }
  assert.equal(problemsFor(real.diff.replace(BIDI, ''), real.files).length, 1, 'control characters dropped from the diff text instead');
});

test('patch fidelity: the same real data with anything visible changed, cut or reshaped still fails closed', () => {
  const feedbackDiff = real.diff;
  const mutate = (name, diff, files, expect) => {
    const problems = problemsFor(diff, files);
    assert.ok(problems.length > 0, `${name} was accepted`);
    assert.match(problems.map(p => p.reason).join('\n'), expect, name);
  };
  mutate('a visible character changed in the JSON patch', feedbackDiff, withFiles(patch => patch.replace('createHash', 'createHAsh')), /differs in text/);
  mutate('a visible character replaced by an invisible one', feedbackDiff, withFiles(patch => patch.replace('createHash', 'create\u200bHsh')), /differs in text/);
  mutate('an added line turned into a context line', feedbackDiff, withFiles(patch => patch.replace(/^\+(.*)$/m, ' $1')), /counts|structure/);
  mutate('a line dropped from the JSON patch', feedbackDiff, withFiles(patch => patch.split('\n').slice(0, -1).join('\n')), /patch lines/);
  mutate('a line dropped from the diff', feedbackDiff.replace(/\+export const MAX_INLINE = 10;\n/, ''), real.files, /incomplete|counts|patch lines/);
  mutate('a hunk header changed', feedbackDiff, withFiles(patch => patch.replace('@@ -0,0 +1,167 @@', '@@ -0,0 +1,166 @@')), /structure/);
  mutate('a diff cut after its last complete line still fails against the full listing', feedbackDiff.split('\n').slice(0, -30).join('\n') + '\n', real.files, /./);

  const packageDiff = real.diff.slice(real.diff.indexOf('diff --git a/package.json'), real.diff.indexOf('diff --git a/tools/review/feedback.mjs'));
  const second = packageDiff.lastIndexOf('\n@@');
  assert.ok(second > 0, 'package.json has two hunks in the capture');
  mutate('the second hunk omitted from the diff text', real.diff.replace(packageDiff, packageDiff.slice(0, second + 1)), real.files, /incomplete|counts|patch lines/);
  mutate('the second hunk omitted from the JSON patch and its counts adjusted', real.diff, real.files.map(file => {
    if (file.filename !== 'package.json') return file;
    const patch = file.patch.slice(0, file.patch.lastIndexOf('\n@@'));
    const additions = patch.split('\n').filter(l => /^\+/.test(l)).length;
    const deletions = patch.split('\n').filter(l => /^-/.test(l)).length;
    return { ...file, patch, additions, deletions, changes: additions + deletions };
  }), /counts|patch lines/);
});

test('patch fidelity: the real compare flows through the whole harness and reaches the model with every file complete', async () => {
  const w = world({ compares: { [`${BASE}...${SHA}`]: { diff: real.diff, files: real.files } } });
  const result = await run(w);
  assert.equal(result.conclusion, 'success');
  assert.equal(modelCalls(w).length, 1);
  assert.match(finalCheck(w).output.summary, /protected paths/);

  const dropped = world({ compares: { [`${BASE}...${SHA}`]: { diff: real.diff, files: withFiles(patch => patch.replace(BIDI, '')) } } });
  assert.equal((await run(dropped)).conclusion, 'failure');
  assert.equal(modelCalls(dropped).length, 0);

  const altered = world({ compares: { [`${BASE}...${SHA}`]: { diff: real.diff, files: withFiles(patch => patch.replace('createHash', 'createHAsh')) } } });
  assert.equal((await run(altered)).conclusion, 'failure');
  assert.equal(modelCalls(altered).length, 0);
  assert.match(finalCheck(altered).output.summary, /feedback\.mjs: the diff does not match the patch GitHub lists .*patch line \d+ differs in text/);
});

test('patch fidelity: an added file whose patch differs only by a zero-width character is never reviewed, in either direction', async () => {
  const added = text => `diff --git a/server/role.ts b/server/role.ts\nnew file mode 100644\nindex 0000000..1111111\n--- /dev/null\n+++ b/server/role.ts\n@@ -0,0 +1 @@\n+${text}\n`;
  const [plain, hidden] = [added('role = "admin"'), added('role = "ad\u200bmin"')];
  for (const [diff, listed] of [[plain, hidden], [hidden, plain]]) {
    const w = world({ diff, files: filesFromDiff(listed) });
    assert.equal((await run(w)).conclusion, 'failure');
    assert.equal(modelCalls(w).length, 0);
    assert.match(finalCheck(w).output.summary, /differs in text/);
  }
  const same = world({ diff: hidden, files: filesFromDiff(hidden) });
  assert.equal((await run(same)).conclusion, 'success');
  assert.ok(userMessage(same).includes('ad\u200bmin'));
});
