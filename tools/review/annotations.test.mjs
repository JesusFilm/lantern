import assert from 'node:assert/strict';
import { test } from 'node:test';
import { world, run, HUNK_DIFF, finding, failing, github, ours } from './fake-github.mjs';

const PATCH = /^PATCH \/repos\/o\/r\/check-runs\/900$/;
const lineFindings = count => Array.from({ length: count }, (_, i) => finding({ severity: 'major', line: 1 + (i % 4), message: `A${String(i).padStart(2, '0')} ${'z'.repeat(2_100)}` }));

test('annotation rejection with overflow: the fallback states what each surface holds and keeps no claim that annotations or all details exist', async () => {
  const w = world({ diff: HUNK_DIFF, model: failing(lineFindings(55)), failFirst: 'PATCH /repos/o/r/check-runs/900' });
  await run(w);
  const patches = github(w, PATCH).map(c => c.body);
  assert.equal(patches.length, 3);
  assert.equal(patches[0].output.annotations.length, 50);
  assert.match(patches[0].output.summary, /Only the first 50 of 55 findings on lines in the diff are annotated/);

  const [, fallback, recorded] = patches;
  assert.equal(fallback.output.annotations, undefined);
  const listed = (fallback.output.text.match(/^- \*\*major\*\* client\/Guide\.tsx:\d: A\d\d /gm) ?? []).length;
  assert.ok(listed > 0 && listed < 55);
  for (const output of [fallback.output, recorded.output]) {
    assert.match(output.summary, /Annotations could not be attached \(status 500\), so none are published on this check\./);
    assert.ok(output.summary.includes(`The check text lists only the first ${listed} of 55 findings.`));
    assert.ok(output.summary.includes(`the other ${55 - listed} are not listed in it. No annotations are attached to this check, so those findings can appear only as inline review comments`));
    assert.doesNotMatch(output.summary, /listed in the details|are annotated|as annotations or inline|may also appear as annotations/);
  }
  assert.match(fallback.output.text, new RegExp(`${55 - listed} more findings are not listed here`));
  assert.ok(recorded.output.summary.includes('Pull request feedback:'));
  assert.ok(fallback.output.summary.length <= 60_000 && fallback.output.text.length <= 60_000);

  const body = ours(w)[0].body;
  assert.match(body, /inline review comments \(check annotations could not be attached\)/);
  assert.doesNotMatch(body, /anywhere|inline review comments or check annotations/);
});

test('annotation rejection without overflow: the fallback says all findings are in the check text and keeps no annotation claim', async () => {
  const w = world({ diff: HUNK_DIFF, model: failing([finding({ message: 'Short one.' })]), failFirst: 'PATCH /repos/o/r/check-runs/900' });
  await run(w);
  const [attempted, fallback] = github(w, PATCH).map(c => c.body);
  assert.equal(attempted.output.annotations.length, 1);
  assert.equal(fallback.output.annotations, undefined);
  assert.match(fallback.output.summary, /Annotations could not be attached \(status 500\), so none are published on this check\. The check text lists all 1 findings\./);
  assert.doesNotMatch(fallback.output.summary, /Only the first|annotated/);
  assert.ok(fallback.output.text.includes('Short one.'));
});
