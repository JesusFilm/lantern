import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { decide, parseVerdict } from './verdict.mjs';
import { COMMENT_MARKER, MAX_INLINE, diffRightLines, escapeText } from './feedback.mjs';
import { runReview } from './review.mjs';
import { SHA, TOKEN, verdict, SHA_B, world, config, run, finalCheck, HUNK_DIFF, manyLinesDiff, finding, failing, writes, ours, github, olderComment, completionCheck, summaryOf, forB } from './fake-github.mjs';
import { describeResult } from './review.mjs';

test('model-derived text is escaped: no mentions, HTML, images, links, autolinks, issue refs or marker forgery', async () => {
  const hostile = '@octocat @org/team <img src=x onerror=alert(1)> ![p](https://evil.example/p.png) [click](https://evil.example) https://evil.example www.evil.example #12 <!-- lantern-independent-review --> `code` *bold*\nnew line';
  const out = escapeText(hostile);
  for (const bad of [/@\w/, /</, />/, /\]\(/, /!\[/, /:\/\//, /www\./i, /(^|[^&])#\d/, /\n/]) assert.doesNotMatch(out, bad);
  assert.ok(!out.includes(COMMENT_MARKER));
  assert.ok(escapeText('x'.repeat(5000), 100).length <= 100);

  const w = world({ diff: HUNK_DIFF, model: failing([finding({ message: hostile }), finding({ line: 3, file: 'client/Guide.tsx', message: '@octocat see https://evil.example' })]).replace('Needs work.', '<script>@octocat</script>') });
  await run(w);
  const surfaces = [...w.comments.map(c => c.body), ...w.reviews.map(r => r.body), ...w.reviewComments.map(c => c.body), finalCheck(w).output.summary, finalCheck(w).output.text];
  for (const surface of surfaces) {
    assert.doesNotMatch(surface, /@\w/);
    assert.doesNotMatch(surface, /<script|<img/);
    assert.doesNotMatch(surface.replace(/\]\(https:\/\/github\.com\/o\/r\/pull\/5\/checks\?check_run_id=900\)/g, ''), /\]\(/);
    assert.doesNotMatch(surface, /!\[|\]\(https:\/\/evil/);
  }
});

test('diffRightLines lists only commentable right-side lines', () => {
  const lines = diffRightLines(HUNK_DIFF + manyLinesDiff(3));
  assert.deepEqual([...lines.get('client/Guide.tsx')], [1, 2, 3, 4]);
  assert.deepEqual([...lines.get('new.ts')], [1, 2, 3]);
  assert.equal(diffRightLines('').size, 0);
});

test('a passing review leaves one SHA-bound summary comment that links the check and is not an approval', async () => {
  const w = world({ diff: HUNK_DIFF });
  await run(w);
  assert.equal(ours(w).length, 1);
  const body = ours(w)[0].body;
  assert.ok(body.includes(`<!-- head:${SHA} -->`));
  assert.ok(body.includes('<!-- run:900 -->'));
  assert.match(body, /check run 900/);
  assert.match(body, /\*\*Passed\*\* for `aaaaaaa`/);
  assert.match(body, /check_run_id=900/);
  assert.match(body, /not a formal pull request approval/);
  assert.equal(w.reviews.length, 0);
  assert.match(finalCheck(w).output.summary, /Pull request feedback: summary comment (created|updated)/);
});

test('a retried run edits its own comment; reruns for the same commit each get their own comment and never duplicate inline comments', async () => {
  const model = failing([finding(), finding({ line: 3, message: 'Second.' })]);
  const retried = world({ diff: HUNK_DIFF, model });
  await run(retried);
  await run(retried);
  assert.equal(ours(retried).length, 1);
  assert.equal(github(retried, /^PATCH \/repos\/o\/r\/issues\/comments\/\d+$/).length, 1);

  const w = world({ diff: HUNK_DIFF, model, checkIds: [901, 902, 903] });
  await run(w);
  await run(w);
  await run(w);
  assert.deepEqual(ours(w).map(c => /<!-- run:(\d+) -->/.exec(c.body)[1]), ['901', '902', '903']);
  assert.equal(github(w, /^PATCH \/repos\/o\/r\/issues\/comments\/\d+$/).length, 0);
  assert.equal(w.reviews.length, 1);
  assert.equal(w.reviewComments.length, 2);
  assert.match(finalCheck(w).output.summary, /inline findings already posted/);
});

test('a new commit gets its own comment and fresh findings; the older SHA\'s comment is never rewritten', async () => {
  const NEW = 'c'.repeat(40);
  const w = world({ diff: HUNK_DIFF, model: failing([finding()]) });
  await run(w);
  assert.ok(ours(w)[0].body.includes(`head:${SHA}`));
  const before = ours(w)[0].body;
  const w2 = world({ diff: HUNK_DIFF, model: failing([finding()]), headSha: NEW, seed: w.comments });
  await runReview({ ...config, expectedSha: NEW, fetch: w2.fetch });
  assert.equal(ours(w2).length, 2);
  const forNew = ours(w2).find(c => c.body.includes(`head:${NEW}`));
  const forOld = ours(w2).find(c => c.body.includes(`head:${SHA}`));
  assert.match(forNew.body, /Requires changes\*\* for \`ccccccc\`/);
  assert.equal(forOld.body, before);
  assert.match(forNew.body, /Every run, including a rerun for the same commit, writes its own comment/);
  assert.equal(w2.reviews[0].commit_id, NEW);
});

test('a run for a superseded head publishes nothing to the pull request', async () => {
  const stale = world({ headSha: 'b'.repeat(40), diff: HUNK_DIFF });
  await run(stale);
  assert.equal(writes(stale).length, 0);

  const NEW = 'b'.repeat(40);
  const w = world({ diff: HUNK_DIFF, model: failing([finding()]), moveHeadAfterModel: NEW });
  const result = await run(w);
  assert.equal(result.conclusion, 'failure');
  assert.equal(finalCheck(w).conclusion, 'failure');
  assert.equal(w.checks[0].head_sha, SHA);
  assert.equal(w.reviews.length, 0);
  assert.equal(ours(w).length, 0);
  assert.match(finalCheck(w).output.summary, /not published: the pull request moved/);
});

test('inline review is COMMENT-only, capped at 10, limited to blocker/major findings on commentable lines', async () => {
  const findings = [
    ...Array.from({ length: 15 }, (_, i) => finding({ file: 'new.ts', line: i + 1, message: `Defect ${i + 1}.` })),
    finding({ file: 'new.ts', line: 99, message: 'Not in diff.' }),
    finding({ file: 'elsewhere.ts', line: 1, message: 'Other file.' }),
    finding({ severity: 'blocker', file: undefined, line: undefined, message: 'General.' }),
  ];
  const w = world({ diff: manyLinesDiff(15), model: failing(findings) });
  await run(w);
  assert.equal(w.reviews.length, 1);
  const [review] = w.reviews;
  assert.equal(review.event, 'COMMENT');
  assert.equal(review.commit_id, SHA);
  assert.equal(MAX_INLINE, 10);
  assert.equal(review.comments.length, 10);
  assert.ok(review.comments.every(c => c.side === 'RIGHT' && c.path === 'new.ts' && c.line >= 1 && c.line <= 15 && /\*\*major\*\*/.test(c.body)));
  assert.match(ours(w)[0].body, /Not in diff/);
  assert.match(ours(w)[0].body, /General/);
  assert.equal(finalCheck(w).conclusion, 'failure');
});

test('minor findings never become inline comments', async () => {
  const w = world({ diff: HUNK_DIFF, model: failing([finding({ severity: 'minor', line: 2 }), finding({ line: 3 })]) });
  await run(w);
  assert.deepEqual(w.reviews[0].comments.map(c => c.line), [3]);
});

test('the harness can only comment: every review is COMMENT, even for request_changes, and no merge or approval call exists', async () => {
  for (const model of [verdict(), failing([finding()]), failing([])]) {
    const w = world({ diff: HUNK_DIFF, model });
    await run(w);
    assert.ok(w.reviews.every(r => r.event === 'COMMENT'));
    const allowed = [
      /^GET \/repos\/o\/r\/(installation|pulls\/5|issues\/5\/comments|pulls\/5\/comments)$/,
      /^GET \/repos\/o\/r\/compare\/[0-9a-f]{40}\.\.\.[0-9a-f]{40}$/,
      /^GET \/repos\/o\/r\/contents\/[A-Za-z0-9_.\/-]+$/,
      /^POST \/app\/installations\/77\/access_tokens$/,
      /^POST \/repos\/o\/r\/(check-runs|issues\/5\/comments|pulls\/5\/reviews)$/,
      /^PATCH \/repos\/o\/r\/(check-runs\/900|issues\/comments\/\d+)$/,
    ];
    for (const c of w.calls.filter(c => c.host === 'api.github.com')) assert.ok(allowed.some(p => p.test(`${c.method} ${c.path}`)), `${c.method} ${c.path}`);
  }
  for (const file of ['review.mjs', 'feedback.mjs', 'github.mjs', 'main.mjs', 'diff.mjs', 'context.mjs']) {
    const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /APPROVE|REQUEST_CHANGES|\/merge|\/dismissals|\/submissions/, file);
  }
});

test('a comment on someone else\'s forged marker is never edited; ours is created separately', async () => {
  const forged = { id: 7, user: { login: 'mallory' }, body: `${COMMENT_MARKER}\n<!-- head:${SHA} -->\n<!-- run:900 -->\nPassed` };
  const w = world({ diff: HUNK_DIFF, seed: [forged] });
  await run(w);
  assert.ok(forged.body.endsWith('Passed'));
  assert.equal(github(w, /^PATCH \/repos\/o\/r\/issues\/comments/).length, 0);
  assert.equal(w.comments.length, 2);
  assert.equal(ours(w).length, 1);
});

test('publication failures are visible in the check and never change the verdict or leak secrets', async () => {
  const cases = {
    'comment create fails': { failOn: 'POST /repos/o/r/issues/5/comments', expect: /could not be published \(summary comment: status 500\)/ },
    'comment list fails': { failOn: 'GET /repos/o/r/issues/5/comments', expect: /could not be published/ },
    'review post fails': { failOn: 'POST /repos/o/r/pulls/5/reviews', expect: /inline comments could not be published \(status 500\)/, model: failing([finding()]) },
    'inline list fails': { failOn: 'GET /repos/o/r/pulls/5/comments', expect: /inline comments could not be published/, model: failing([finding()]) },
  };
  for (const [name, { expect, model = verdict(), failOn }] of Object.entries(cases)) {
    const w = world({ diff: HUNK_DIFF, model, failOn });
    const result = await run(w);
    assert.equal(result.conclusion, decide(parseVerdict(model)).conclusion, name);
    assert.equal(finalCheck(w).conclusion, result.conclusion, name);
    assert.match(finalCheck(w).output.summary, expect, name);
    assert.ok(!JSON.stringify(finalCheck(w)).includes(TOKEN), name);
  }
});

test('annotations: messages are escaped and bounded, limited to commentable lines, titled and capped at 50', async () => {
  const hostile = '@octocat <img src=x> https://evil.example [x](https://evil.example) ' + 'y'.repeat(5000);
  const w = world({ diff: HUNK_DIFF, model: failing([finding({ message: hostile }), finding({ line: 99, message: 'Not commentable.' }), finding({ file: 'elsewhere.ts', line: 1, message: 'Wrong file.' })]) });
  await run(w);
  const { annotations } = completionCheck(w).output;
  assert.equal(annotations.length, 1);
  const [a] = annotations;
  assert.deepEqual([a.path, a.start_line, a.end_line, a.annotation_level], ['client/Guide.tsx', 2, 2, 'warning']);
  assert.match(a.title, /^Independent review: major$/);
  assert.doesNotMatch(a.message, /@\w|<img|:\/\/|\]\(/);
  assert.ok(a.message.length < 1300, String(a.message.length));
  const manyMinor = world({ diff: manyLinesDiff(60), model: verdict({ findings: Array.from({ length: 60 }, (_, i) => ({ severity: 'minor', file: 'new.ts', line: i + 1, message: `Nit ${i + 1}.` })) }) });
  await run(manyMinor);
  assert.equal(completionCheck(manyMinor).output.annotations.length, 50);
});

test('annotations: if GitHub rejects the annotations the check still completes with the same verdict and a visible note', async () => {
  const w = world({ diff: HUNK_DIFF, model: failing([finding()]), failFirst: 'PATCH /repos/o/r/check-runs/900' });
  const result = await run(w);
  const patches = github(w, /^PATCH \/repos\/o\/r\/check-runs\/900$/).map(c => c.body);
  assert.equal(patches.length, 3);
  assert.equal(patches[0].output.annotations.length, 1);
  assert.equal(patches[1].output.annotations, undefined);
  assert.equal(patches[1].conclusion, 'failure');
  assert.equal(patches[2].conclusion, 'failure');
  assert.equal(result.conclusion, 'failure');
  assert.match(patches[1].output.summary, /Annotations could not be attached \(status 500\)/);
});

test('stale writes: a run whose head already moved never writes the summary comment or inline comments', async () => {
  const w = world({ diff: HUNK_DIFF, model: failing([finding()]), heads: [SHA, SHA_B], seed: [olderComment('c'.repeat(40), 'Earlier')] });
  await run(w);
  assert.equal(writes(w).length, 0);
  assert.match(w.comments[0].body, /Earlier/);
  assert.equal(w.reviews.length, 0);
});

test('stale writes: a head that moves between the guard and a write leaves only text labelled with its own SHA and run, and no cross-SHA edit', async () => {
  const w = world({ diff: HUNK_DIFF, traps: [{ on: 'POST /repos/o/r/issues/5/comments', before: api => { api.state.head = SHA_B; } }] });
  await run(w);
  assert.equal(ours(w).length, 1);
  assert.ok(ours(w)[0].body.includes(`head:${SHA}`));
  assert.match(ours(w)[0].body, /\*\*Passed\*\* for \`aaaaaaa\`/);
  assert.match(ours(w)[0].body, /check run 900/);
  assert.doesNotMatch(summaryOf(w), /Superseded|bbbbbbb/);
});

test('stale writes: no inline comments are posted if the head moved after the summary was written', async () => {
  const w = world({ diff: HUNK_DIFF, model: failing([finding()]), traps: [{ on: 'POST /repos/o/r/issues/5/comments', after: api => { api.state.head = SHA_B; } }] });
  const result = await run(w);
  assert.equal(result.conclusion, 'failure');
  assert.equal(w.reviews.length, 0);
  assert.match(ours(w)[0].body, /Requires changes\*\* for \`aaaaaaa\`/);
  assert.match(finalCheck(w).output.summary, /inline comments not posted: the pull request moved/);
});

test('final decision: a Passed summary is never published unless the head was verified first', async () => {
  const moved = world({ diff: HUNK_DIFF, heads: [SHA, SHA_B] });
  assert.equal((await run(moved)).conclusion, 'failure');
  assert.doesNotMatch(summaryOf(moved), /Passed/);
  assert.equal(writes(moved).some(c => /Passed/.test(JSON.stringify(c.body))), false);

  const unreadable = world({ diff: HUNK_DIFF, traps: [{ on: 'GET /repos/o/r/pulls/5', nth: 2, before: api => { api.state.pullFails = true; }, after: api => { api.state.pullFails = false; } }] });
  assert.equal((await run(unreadable)).conclusion, 'failure');
  assert.doesNotMatch(summaryOf(unreadable), /Passed/);
  assert.match(finalCheck(unreadable).output.summary, /could not be confirmed/);
  assert.equal(writes(unreadable).some(c => /Passed/.test(JSON.stringify(c.body))), false);
});

test('completion order: the check is completed before any comment says Passed or Requires changes', async () => {
  for (const [name, model, text] of [['passing', verdict(), /Passed/], ['failing', failing([finding()]), /Requires changes/]]) {
    const w = world({ diff: HUNK_DIFF, model });
    await run(w);
    const order = w.calls.filter(c => c.host === 'api.github.com').map(c => ({ at: `${c.method} ${c.path}`, body: JSON.stringify(c.body ?? '') }));
    const completed = order.findIndex(c => c.at === 'PATCH /repos/o/r/check-runs/900' && /"status":"completed"/.test(c.body));
    const verdictWrite = order.findIndex(c => /\/issues\/(5\/comments|comments\/\d+)$/.test(c.at) && text.test(c.body));
    assert.ok(completed >= 0 && verdictWrite > completed, `${name}: completed at ${completed}, verdict comment at ${verdictWrite}`);
    assert.match(finalCheck(w).output.summary, /Pull request feedback: summary comment (created|updated)/, name);
  }
});

test('completion failure: if GitHub rejects the completion no comment says Passed, a Not completed notice is the only comment, and the job fails', async () => {
  const w = world({ diff: HUNK_DIFF, failOn: 'PATCH /repos/o/r/check-runs/900' });
  await assert.rejects(run(w), /Could not complete check run \(status 500\)/);
  assert.equal(ours(w).length, 1);
  assert.doesNotMatch(summaryOf(w), /Passed|Requires changes|Reviewing/);
  assert.match(summaryOf(w), /\*\*Not completed\*\* for \`aaaaaaa\`/);
  assert.match(summaryOf(w), /no verdict is recorded/);
  assert.match(summaryOf(w), /<!-- run:900 -->/);
  assert.equal(w.checks.some(c => c.status === 'completed' && !c.patch), false);
  assert.equal(writes(w).some(c => /Passed/.test(JSON.stringify(c.body))), false);

  const other = olderComment('c'.repeat(40), 'Passed');
  const untouched = other.body;
  const elsewhere = world({ diff: HUNK_DIFF, failOn: 'PATCH /repos/o/r/check-runs/900', seed: [other] });
  await assert.rejects(run(elsewhere), /Could not complete/);
  assert.equal(other.body, untouched);

  const failing_ = world({ diff: HUNK_DIFF, model: failing([finding()]), failOn: 'PATCH /repos/o/r/check-runs/900' });
  await assert.rejects(run(failing_), /Could not complete/);
  assert.doesNotMatch(summaryOf(failing_), /Bug here|Requires changes/);
  assert.equal(failing_.reviews.length, 0);
});

test('completion failure: a failure after the annotation retry is the same honest outcome, and an annotation-only rejection still completes first', async () => {
  const w = world({ diff: HUNK_DIFF, model: failing([finding()]), traps: [{ on: 'PATCH /repos/o/r/check-runs/900', nth: 2, before: api => { api.state.failCheckPatch = true; } }], failFirst: 'PATCH /repos/o/r/check-runs/900' });
  await assert.rejects(run(w), /Could not complete check run \(status 502\)/);
  assert.match(summaryOf(w), /Not completed/);
  assert.doesNotMatch(summaryOf(w), /Requires changes|Passed/);

  const ok = world({ diff: HUNK_DIFF, model: failing([finding()]), failFirst: 'PATCH /repos/o/r/check-runs/900' });
  assert.equal((await run(ok)).conclusion, 'failure');
  assert.match(summaryOf(ok), /Requires changes/);
});

test('completion failure: if the Not completed notice cannot be written, or the comments cannot be read, the job still fails with the check unfinished', async () => {
  const down = world({ diff: HUNK_DIFF, failOn: 'PATCH /repos/o/r/check-runs/900', traps: [{ on: 'PATCH /repos/o/r/check-runs/900', before: api => { api.state.failComments = true; } }] });
  await assert.rejects(run(down), /Could not complete check run/);
  assert.equal(ours(down).length, 0);
  assert.ok(!JSON.stringify(down.checks).includes(TOKEN));

  const unreadable = world({ diff: HUNK_DIFF, failOn: 'GET /repos/o/r/issues/5/comments', traps: [{ on: 'POST /repos/o/r/check-runs', after: api => { api.state.failCheckPatch = true; } }] });
  await assert.rejects(run(unreadable), /Could not complete check run \(status 502\)/);
  assert.equal(ours(unreadable).length, 0);
});

const NOTE = 'summary comment created; no inline findings.';
const noteDown = (on = 'POST /repos/o/r/issues/5/comments') => ({ on, after: api => { api.state.failCheckPatch = true; } });

test('feedback note: a rejected note update is reported accurately and the verdict stands', async () => {
  const w = world({ diff: HUNK_DIFF, traps: [noteDown()] });
  const result = await run(w);
  assert.equal(result.conclusion, 'success');
  assert.deepEqual(result.feedback, { note: NOTE, recorded: false, problem: 'status 502' });
  assert.equal(completionCheck(w).conclusion, 'success');
  assert.match(summaryOf(w), /\*\*Passed\*\* for \`aaaaaaa\`/);
  assert.doesNotMatch(completionCheck(w).output.summary, /Pull request feedback/);
  const log = describeResult(result);
  assert.match(log, /^Review completed: success\. Pull request feedback: summary comment created; no inline findings\./);
  assert.match(log, /\n::warning::The check summary could not be updated .*\(status 502\)/);
});

test('feedback note: when the comment fails and the note update fails too, the log says both and the check keeps its verdict', async () => {
  const w = world({ diff: HUNK_DIFF, failOn: 'POST /repos/o/r/issues/5/comments', traps: [noteDown()] });
  const result = await run(w);
  assert.equal(result.conclusion, 'success');
  assert.equal(result.feedback.recorded, false);
  assert.match(result.feedback.note, /could not be published \(summary comment: status 500\)/);
  assert.doesNotMatch(completionCheck(w).output.summary, /Pull request feedback/);
  const log = describeResult(result);
  assert.match(log, /could not be published \(summary comment: status 500\)/);
  assert.match(log, /::warning::.*status 502/);
  assert.ok(!log.includes(TOKEN));
});

test('feedback note: a network error is reported, a transient failure is retried once, and success carries the note into the check', async () => {
  const thrown = times => ({ on: 'PATCH /repos/o/r/check-runs/900', nth: 2, times, before: () => { throw new Error('socket closed'); } });
  const down = world({ diff: HUNK_DIFF, traps: [thrown(2)] });
  const result = await run(down);
  assert.deepEqual(result.feedback, { note: NOTE, recorded: false, problem: 'a network error' });
  assert.match(describeResult(result), /::warning::.*a network error/);
  assert.equal(completionCheck(down).conclusion, 'success');

  const flaky = world({ diff: HUNK_DIFF, traps: [thrown(1)] });
  const retried = await run(flaky);
  assert.deepEqual(retried.feedback, { note: NOTE, recorded: true });
  assert.doesNotMatch(describeResult(retried), /::warning::/);
  assert.match(flaky.checks.filter(c => c.patch).at(-1).output.summary, /Pull request feedback: summary comment created; no inline findings\./);
});

test('feedback note: a skipped run has nothing to report and a recorded note produces no warning', async () => {
  assert.equal(describeResult({ skipped: true }), 'Skipped: pull request head moved or pull request closed.');
  const w = world({ diff: HUNK_DIFF });
  const result = await run(w);
  assert.equal(result.feedback.recorded, true);
  assert.equal(describeResult(result), `Review completed: success. Pull request feedback: ${NOTE}`);
});

const patchedIds = w => w.calls.filter(c => c.method === 'PATCH' && /issues\/comments\/\d+$/.test(c.path)).map(c => Number(c.path.split('/').at(-1)));

test('comment race: an older run never overwrites a newer SHA\'s verdict, even if that verdict appears after the run listed the comments', async () => {
  const newer = forB('Passed');
  const before = newer.body;
  const w = world({ diff: HUNK_DIFF, model: failing([finding()]), traps: [{ on: 'POST /repos/o/r/issues/5/comments', before: api => { api.state.head = SHA_B; api.comments.push(newer); } }] });
  await run(w);
  assert.equal(newer.body, before);
  assert.equal(patchedIds(w).includes(5000), false);
  const mine = ours(w).find(c => c.body.includes(`head:${SHA}`));
  assert.match(mine.body, /for \`aaaaaaa\`/);
});

test('comment race: a restored earlier head and a stale run for it write only their own run\'s comment', async () => {
  const stored = olderComment(SHA, 'Requires changes', 800);
  const newer = forB('Passed');
  const keep = [stored.body, newer.body];
  const w = world({ diff: HUNK_DIFF, seed: [stored, newer] });
  await run(w);
  assert.deepEqual(patchedIds(w), []);
  assert.deepEqual([stored.body, newer.body], keep);
  assert.equal(ours(w).filter(c => c.body.includes('<!-- run:900 -->')).length, 1);

});

test('comment race: comments for older SHAs and other authors are never touched, and every run labels its comment with its own SHA', async () => {
  const old1 = olderComment('c'.repeat(40), 'Passed');
  const old2 = { ...olderComment('e'.repeat(40), 'Reviewing'), id: 8 };
  const foreign = { id: 9, user: { login: 'someone' }, body: olderComment('f'.repeat(40), 'Passed').body };
  const w = world({ diff: HUNK_DIFF, seed: [old1, old2, foreign] });
  const snapshot = [old1.body, old2.body, foreign.body];
  await run(w);
  assert.deepEqual([old1.body, old2.body, foreign.body], snapshot);
  assert.deepEqual(patchedIds(w).filter(id => [7, 8, 9].includes(id)), []);
  assert.equal(ours(w).filter(c => c.body.includes(`head:${SHA}`)).length, 1);
});

test('comment race: duplicate comments for the same run are kept consistent, and another run\'s comment for the same SHA is left alone', async () => {
  const dup = olderComment(SHA, 'Passed', 900);
  const dup2 = { ...olderComment(SHA, 'Passed', 900), id: 8 };
  const sibling = { ...olderComment(SHA, 'Requires changes', 899), id: 9 };
  const before = sibling.body;
  const w = world({ diff: HUNK_DIFF, model: failing([finding()]), seed: [dup, dup2, sibling] });
  await run(w);
  assert.match(dup.body, /Requires changes/);
  assert.equal(dup2.body, dup.body);
  assert.equal(sibling.body, before);
});

test('same-SHA runs: an older run that finishes after a newer run for the same commit cannot change the newer run\'s comment or check', async () => {
  const shared = [];
  const newer = world({ diff: HUNK_DIFF, model: failing([finding()]), shared, checkIds: [902] });
  const older = world({ diff: HUNK_DIFF, model: verdict(), shared, checkIds: [901] });
  assert.equal((await run(newer)).conclusion, 'failure');
  const newerComment = shared.find(c => c.body.includes('<!-- run:902 -->'));
  const snapshot = newerComment.body;
  assert.equal((await run(older)).conclusion, 'success');
  assert.equal(newerComment.body, snapshot);
  assert.match(snapshot, /Requires changes/);
  assert.equal(shared.length, 2);
  const olderComment_ = shared.find(c => c.body.includes('<!-- run:901 -->'));
  assert.match(olderComment_.body, /\*\*Passed\*\*.*check run 901/s);
  assert.equal(github(older, /^PATCH \/repos\/o\/r\/issues\/comments\/\d+$/).length, 0);
  assert.equal(newer.checks.find(c => c.patch).conclusion, 'failure');
  assert.equal(older.checks.find(c => c.patch).conclusion, 'success');
  assert.equal(older.checks.find(c => c.patch).run, 901);
});

test('same-SHA runs: a run in flight has written no comment, so a cancelled run leaves nothing stale; one that cannot complete leaves only its own Not completed notice', async () => {
  let during;
  const inFlight = world({ diff: HUNK_DIFF, traps: [{ on: 'POST /v1/messages', before: api => { during = api.comments.length; } }] });
  await run(inFlight);
  assert.equal(during, 0);
  assert.equal(ours(inFlight).length, 1);

  const shared = [];
  await run(world({ diff: HUNK_DIFF, shared, checkIds: [902] }));
  const snapshot = shared[0].body;
  await assert.rejects(run(world({ diff: HUNK_DIFF, shared, checkIds: [900], failOn: 'PATCH /repos/o/r/check-runs/900' })), /Could not complete/);
  assert.equal(shared[0].body, snapshot);
  assert.match(snapshot, /Passed.*check run 902/s);
  assert.equal(shared.length, 2);
  assert.match(shared[1].body, /<!-- run:900 -->/);
  assert.match(shared[1].body, /\*\*Not completed\*\*/);
  assert.doesNotMatch(shared[1].body, /Passed|Requires changes/);
});

test('same-SHA runs: the comment of a newer run that appears after the older run listed the comments is still never edited', async () => {
  const shared = [];
  const racing = world({ diff: HUNK_DIFF, model: verdict(), shared, checkIds: [901], traps: [{ on: 'GET /repos/o/r/issues/5/comments', after: () => { shared.push({ ...olderComment(SHA, 'Requires changes', 902), id: 3000 }); } }] });
  await run(racing);
  const newerComment = shared.find(c => c.id === 3000);
  assert.equal(github(racing, /^PATCH \/repos\/o\/r\/issues\/comments\/\d+$/).length, 0);
  assert.match(newerComment.body, /Requires changes/);
  assert.equal(shared.filter(c => c.body.includes('<!-- run:901 -->')).length, 1);
});
