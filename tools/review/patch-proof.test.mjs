import assert from 'node:assert/strict'
import test from 'node:test'
import { provePatch } from './patch-proof.mjs'

test('proves equivalent merged and split hunks independently', () => {
  const before = 'start\nold\nbridge\nstale\nend\n'
  const after = 'start\nnew\nbridge\nfresh\nend\n'
  const merged = '@@ -1,5 +1,5 @@ section\n start\n-old\n+new\n bridge\n-stale\n+fresh\n end\n'
  const split = '@@ -2 +2 @@\n-old\n+new\n@@ -4 +4 @@\n-stale\n+fresh\n'
  assert.equal(provePatch(merged, before, after), true)
  assert.equal(provePatch(split, before, after), true)
  assert.equal(provePatch(split.slice(0, -1), before, after), true)
})

test('rejects missing hunks, changed gaps or tails, and edits at shifted coordinates', () => {
  const patch = '@@ -2 +2 @@\n-old\n+new'
  assert.equal(provePatch(patch, 'start\nold\nend\n', 'start\nnew\nend\n'), true)
  for (const [before, after] of [
    ['start\nold\nend\n', 'start\nnew\nCHANGED\n'],
    ['start\nold\nend\n', 'CHANGED\nnew\nend\n'],
    ['start\nold\nbridge\nstale\n', 'start\nnew\nbridge\nfresh\n'],
    ['old\nsame\n', 'new\nsame\n'],
    ['start\nold\n', 'start\nnew\nextra\n'],
  ]) assert.equal(provePatch(patch, before, after), false)
  assert.equal(provePatch('@@ -2 +2 @@\n-x\n+y', 'x\nx\n', 'y\nx\n'), false)
  assert.equal(provePatch('@@ -2 +2 @@\n-x\n+y', 'x\nx\n', 'x\ny\n'), true)
})

test('checks every context, deletion and addition character without normalization', () => {
  const patch = '@@ -1,3 +1,3 @@\n α🙂\n-café\t \n+fresh\u200b\n tail\r\n'
  const before = 'α🙂\ncafé\t \ntail\r\n'
  const after = 'α🙂\nfresh\u200b\ntail\r\n'
  assert.equal(provePatch(patch, before, after), true)
  for (const changed of [
    patch.replace('α', 'a'), patch.replace('café', 'cafe\u0301'),
    patch.replace('\t ', ' '), patch.replace('\u200b', ''), patch.replace('\r', ''),
  ]) assert.equal(provePatch(changed, before, after), false)
})

test('rejects malformed headers, counts, ordering, overlaps and trailing garbage', () => {
  for (const patch of [
    '@@ -1,2 +1 @@\n-a\n+b', '@@ -1 +1,2 @@\n-a\n+b',
    '@@ -1 +1 @@\n-a\n+b\n+c', '@@ -0 +1 @@\n-a\n+b',
    '@@ -1 +0 @@\n-a\n+b', '@@ -9007199254740992 +1 @@\n-a\n+b',
    '@@ -1 +1 @@junk\n-a\n+b', '@@ -1,-1 +1 @@\n-a\n+b',
    '@@ -1 +1 @@\n-a\n+b\n\n', '@@ -1 +1 @@\n-a\n+b\ntrailer',
    '@@ -2 +2 @@\n-a\n+b\n@@ -1 +1 @@\n-a\n+b',
    '@@ -1 +1 @@\n-a\n+b\n@@ -1 +1 @@\n-a\n+b',
    '@@ -1,0 +1,0 @@',
  ]) assert.equal(provePatch(patch, 'a\na\n', 'b\na\n'), false, patch)
  assert.equal(provePatch('@@ -0,0 +0,0 @@', '', ''), false)
})

test('proves insertions and deletions at zero-length ranges, including new and deleted files', () => {
  for (const [patch, before, after] of [
    ['@@ -0,0 +1,2 @@\n+one\n+two', '', 'one\ntwo\n'],
    ['@@ -1,2 +0,0 @@\n-one\n-two', 'one\ntwo\n', ''],
    ['@@ -0,0 +1 @@\n+first', 'last\n', 'first\nlast\n'],
    ['@@ -1,0 +2 @@\n+last', 'first\n', 'first\nlast\n'],
    ['@@ -1 +0,0 @@\n-first', 'first\nlast\n', 'last\n'],
    ['@@ -2 +1,0 @@\n-last', 'first\nlast\n', 'first\n'],
    ['@@ -1,0 +2 @@\n+middle', 'first\nlast\n', 'first\nmiddle\nlast\n'],
    ['@@ -2 +1,0 @@\n-middle', 'first\nmiddle\nlast\n', 'first\nlast\n'],
    ['@@ -1 +1,2 @@\n-a\n+b\n+c\n@@ -3 +4 @@\n-z\n+y', 'a\ngap\nz\n', 'b\nc\ngap\ny\n'],
    ['', '', ''], ['', 'same\n', 'same\n'],
  ]) assert.equal(provePatch(patch, before, after), true, patch)
  for (const [patch, before, after] of [
    ['@@ -1,0 +1 @@\n+x', '', 'x\n'],
    ['@@ -1 +1,0 @@\n-x', 'x\n', ''],
    ['@@ -0,0 +2 @@\n+x', '', 'x\n'],
    ['', '', 'x\n'], ['', 'x\n', ''],
  ]) assert.equal(provePatch(patch, before, after), false, patch)
})

test('proves exact no-final-newline state on deletion, addition and context records', () => {
  const marker = '\\ No newline at end of file'
  for (const [patch, before, after] of [
    [`@@ -1 +1 @@\n-old\n${marker}\n+new\n${marker}`, 'old', 'new'],
    [`@@ -1 +1 @@\n-old\n${marker}\n+old`, 'old', 'old\n'],
    [`@@ -1 +1 @@\n-old\n+old\n${marker}`, 'old\n', 'old'],
    [`@@ -1,2 +1,2 @@\n-old\n+new\n tail\n${marker}`, 'old\ntail', 'new\ntail'],
    [`@@ -0,0 +1 @@\n+x\n${marker}`, '', 'x'],
    [`@@ -1 +0,0 @@\n-x\n${marker}`, 'x', ''],
    [`@@ -1 +1 @@\n-x\r\n${marker}\n+y\r\n${marker}`, 'x\r', 'y\r'],
  ]) assert.equal(provePatch(patch, before, after), true, patch)
})

test('rejects missing, extra, misspelled, duplicate or misplaced no-newline markers', () => {
  const marker = '\\ No newline at end of file'
  for (const [patch, before, after] of [
    ['@@ -1 +1 @@\n-old\n+new', 'old', 'new'],
    [`@@ -1 +1 @@\n-old\n${marker}\n+new\n${marker}`, 'old\n', 'new'],
    [`@@ -1 +1 @@\n-old\n+new\n${marker}`, 'old\n', 'new\n'],
    [`@@ -1 +1 @@\n${marker}\n-old\n+new`, 'old\n', 'new\n'],
    [`@@ -1 +1 @@\n-old\n${marker}\n${marker}\n+new`, 'old', 'new\n'],
    [`@@ -1 +1 @@\n-old\n+new\n${marker} `, 'old\n', 'new'],
    [`@@ -1 +1 @@\n-old\n+new\n${marker}\r`, 'old\n', 'new'],
    [`@@ -1,2 +1,2 @@\n old\n${marker}\n-tail\n+new`, 'old\ntail\n', 'old\nnew\n'],
    [`@@ -1 +1 @@\n-old\n+new\n${marker}\n${marker}`, 'old\n', 'new'],
    ['', 'same\n', 'same'],
  ]) assert.equal(provePatch(patch, before, after), false, patch)
})

test('preserves CRLF, mixed line endings, empty lines, Unicode separators and hunk-looking text', () => {
  for (const [patch, before, after] of [
    ['@@ -1,2 +1,2 @@\n same\r\n-old\r\n+new\r\n', 'same\r\nold\r\n', 'same\r\nnew\r\n'],
    ['@@ -1 +1 @@\n-old\r\n+new', 'old\r\n', 'new\n'],
    ['@@ -1 +1 @@\n-\n+\r', '\n', '\r\n'],
    ['@@ -1 +1 @@\n-α\u2028β\u2029🙂\n+雪\u0000', 'α\u2028β\u2029🙂\n', '雪\u0000\n'],
    ['@@ -1 +1 @@\n--- old\n+++ new', '-- old\n', '++ new\n'],
    ['@@ -1 +1 @@\n-@@ -1 +1 @@\n+@@ new', '@@ -1 +1 @@\n', '@@ new\n'],
  ]) assert.equal(provePatch(patch, before, after), true, patch)
  assert.equal(provePatch('@@ -1 +1 @@\n-old\n+new', 'old\r\n', 'new\r\n'), false)
  assert.equal(provePatch('@@ -1 +1 @@\n-old\r\n+new\r\n', 'old\n', 'new\n'), false)
})

test('returns a boolean for invalid arguments and rejects non-hunk patch envelopes', () => {
  for (const args of [[], [null, '', ''], ['', null, ''], ['', '', null], [42, '', ''], [new String(''), '', '']]) {
    assert.equal(provePatch(...args), false)
  }
  for (const patch of ['\n', 'garbage', '--- a/file\n+++ b/file\n@@ -1 +1 @@\n-a\n+b', 'GIT binary patch']) {
    assert.equal(provePatch(patch, 'a\n', 'b\n'), false)
  }
})
