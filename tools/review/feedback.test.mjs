import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { decide, parseVerdict } from './verdict.mjs';
import { APP_LOGIN, CHECK_TEXT_MAX, COMMENT_MARKER, MAX_INLINE, diffRightLines, escapeText } from './feedback.mjs';
import { LIST_MAX_PAGES, listAll } from './github.mjs';
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
  const before = ours(w)[0].body;
  const w2 = world({ diff: HUNK_DIFF, model: failing([finding()]), headSha: NEW, seed: w.comments });
  await runReview({ ...config, expectedSha: NEW, fetch: w2.fetch });
  assert.equal(ours(w2).length, 2);
  const forNew = ours(w2).find(c => c.body.includes(`head:${NEW}`));
  const forOld = ours(w2).find(c => c.body.includes(`head:${SHA}`));
  assert.match(forNew.body, /Requires changes\*\* for \`ccccccc\`/);
  assert.equal(forOld.body, before);
  assert.equal(w2.reviews[0].commit_id, NEW);
});

test('a run whose head moved during the review publishes nothing to the pull request', async () => {
  const w = world({ diff: HUNK_DIFF, model: failing([finding()]), moveHeadAfterModel: SHA_B });
  const result = await run(w);
  assert.equal(result.conclusion, 'failure');
  assert.equal(finalCheck(w).conclusion, 'failure');
  assert.equal(w.reviews.length, 0);
  assert.equal(ours(w).length, 0);
  assert.match(finalCheck(w).output.summary, /not published: the pull request moved/);
});

test('inline review is COMMENT-only, capped at 10, limited to blocker/major findings on commentable lines', async () => {
  const findings = [
    finding({ severity: 'minor', file: 'new.ts', line: 1, message: 'Nit.' }),
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

test('concurrent runs of one commit that both post inline findings end with one copy of each; a failed cleanup is reported', async () => {
  const model = failing([finding(), finding({ line: 3, message: 'Second.' })]);
  const w = world({ diff: HUNK_DIFF, model, checkIds: [901, 902] });
  const results = await Promise.all([run(w), run(w)]);
  assert.equal(w.reviews.length, 2);
  assert.deepEqual(w.reviewComments.map(c => c.pull_request_review_id), [1000, 1000]);
  const notes = results.map(r => r.feedback.note);
  assert.equal(notes.filter(n => /2 duplicates of a concurrent run removed/.test(n)).length, 1);
  assert.equal(notes.filter(n => /2 inline comments posted\.$/.test(n)).length, 1);

  const stuck = world({ diff: HUNK_DIFF, model, checkIds: [901, 902], traps: [{ on: 'POST /repos/o/r/pulls/5/reviews', after: api => { api.state.failDelete = true; } }] });
  const both = await Promise.all([run(stuck), run(stuck)]);
  assert.equal(stuck.reviewComments.length, 4);
  assert.equal(both.filter(r => /could not be checked or removed \(status 500\)/.test(r.feedback.note)).length, 1);
  assert.deepEqual(both.map(r => r.conclusion), ['failure', 'failure']);

  const gone = world({ diff: HUNK_DIFF, model, checkIds: [901, 902], traps: [{ on: 'DELETE /repos/o/r/pulls/comments', before: api => { api.reviewComments.splice(0); } }] });
  const raced = (await Promise.all([run(gone), run(gone)])).map(r => r.feedback.note);
  assert.equal(raced.filter(n => /duplicates of a concurrent run removed/.test(n)).length, 1);
  assert.doesNotMatch(raced.join(), /could not be checked/);
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
  assert.equal(completionCheck(manyMinor).output.annotations[0].annotation_level, 'notice');
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

test('stale writes: a run whose head moved, before or after its summary, writes nothing further, and a move at the write leaves only its own labelled comment', async () => {
  const before = world({ diff: HUNK_DIFF, model: failing([finding()]), heads: [SHA, SHA_B], seed: [olderComment('c'.repeat(40), 'Earlier')] });
  await run(before);
  assert.equal(writes(before).length, 0);
  assert.match(before.comments[0].body, /Earlier/);

  const after = world({ diff: HUNK_DIFF, model: failing([finding()]), traps: [{ on: 'POST /repos/o/r/issues/5/comments', after: api => { api.state.head = SHA_B; } }] });
  assert.equal((await run(after)).conclusion, 'failure');
  assert.equal(after.reviews.length, 0);
  assert.match(ours(after)[0].body, /Requires changes\*\* for \`aaaaaaa\`/);
  assert.match(finalCheck(after).output.summary, /inline comments not posted: the pull request moved/);

  const during = world({ diff: HUNK_DIFF, traps: [{ on: 'POST /repos/o/r/issues/5/comments', before: api => { api.state.head = SHA_B; } }] });
  await run(during);
  assert.equal(ours(during).length, 1);
  assert.match(ours(during)[0].body, /head:a+ -->[\s\S]*\*\*Passed\*\* for \`aaaaaaa\`[\s\S]*check run 900/);
  assert.doesNotMatch(summaryOf(during), /bbbbbbb/);
});

test('final decision: a Passed summary is never published unless the head was verified first, and the check is completed before any verdict comment', async () => {
  const moved = world({ diff: HUNK_DIFF, heads: [SHA, SHA_B] });
  assert.equal((await run(moved)).conclusion, 'failure');
  const unreadable = world({ diff: HUNK_DIFF, traps: [{ on: 'GET /repos/o/r/pulls/5', nth: 2, before: api => { api.state.pullFails = true; }, after: api => { api.state.pullFails = false; } }] });
  assert.equal((await run(unreadable)).conclusion, 'failure');
  assert.match(finalCheck(unreadable).output.summary, /could not be confirmed/);
  for (const w of [moved, unreadable]) {
    assert.doesNotMatch(summaryOf(w), /Passed/);
    assert.equal(writes(w).some(c => /Passed/.test(JSON.stringify(c.body))), false);
  }

  for (const [model, text] of [[verdict(), /Passed/], [failing([finding()]), /Requires changes/]]) {
    const w = world({ diff: HUNK_DIFF, model });
    await run(w);
    const order = w.calls.filter(c => c.host === 'api.github.com').map(c => ({ at: `${c.method} ${c.path}`, body: JSON.stringify(c.body ?? '') }));
    const completed = order.findIndex(c => c.at === 'PATCH /repos/o/r/check-runs/900' && /"status":"completed"/.test(c.body));
    const verdictWrite = order.findIndex(c => /\/issues\/(5\/comments|comments\/\d+)$/.test(c.at) && text.test(c.body));
    assert.ok(completed >= 0 && verdictWrite > completed, `completed at ${completed}, verdict comment at ${verdictWrite}`);
    assert.match(finalCheck(w).output.summary, /Pull request feedback: summary comment (created|updated)/);
  }
});

test('completion failure: a rejected completion leaves only a Not completed notice for this run, never a verdict, and the job fails', async () => {
  const other = olderComment('c'.repeat(40), 'Passed');
  const untouched = other.body;
  const w = world({ diff: HUNK_DIFF, model: failing([finding()]), failOn: 'PATCH /repos/o/r/check-runs/900', failStatus: 422, seed: [other] });
  await assert.rejects(run(w), /Could not complete check run \(status 422\)/);
  assert.equal(other.body, untouched);
  assert.equal(ours(w).length, 2);
  assert.doesNotMatch(summaryOf(w).replace(untouched, ''), /Passed|Requires changes|Bug here/);
  assert.match(summaryOf(w), /<!-- run:900 -->[\s\S]*\*\*Not completed\*\* for \`aaaaaaa\`[\s\S]*no verdict is recorded/);
  assert.equal(w.checks.some(c => c.status === 'completed' && !c.patch), false);
  assert.equal(writes(w).some(c => /Passed|Bug here/.test(JSON.stringify(c.body))), false);
  assert.equal(w.reviews.length, 0);

  const retry = world({ diff: HUNK_DIFF, model: failing([finding()]), traps: [{ on: 'PATCH /repos/o/r/check-runs/900', nth: 2, before: api => { api.state.failCheckPatch = true; } }], failFirst: 'PATCH /repos/o/r/check-runs/900' });
  await assert.rejects(run(retry), /Could not complete check run \(status 502; the outcome could not be confirmed\)/);
  assert.match(summaryOf(retry), /Outcome unconfirmed/);
  assert.doesNotMatch(summaryOf(retry), /Requires changes|Passed|Not completed|no verdict is recorded/);
});

test('completion failure: a network error on the final update is reconciled against the check, never reported as unrecorded without evidence', async () => {
  const lost = () => ({ on: 'PATCH /repos/o/r/check-runs/900', after: () => { throw new Error('socket closed'); } });
  const accepted = world({ diff: HUNK_DIFF, traps: [lost()] });
  assert.equal((await run(accepted)).conclusion, 'success');
  assert.match(summaryOf(accepted), /\*\*Passed\*\*/);
  assert.doesNotMatch(summaryOf(accepted), /Not completed|unconfirmed/);

  const delayed = world({ diff: HUNK_DIFF, traps: [{ on: 'PATCH /repos/o/r/check-runs/900', before: () => { throw new Error('socket closed'); } }] });
  await assert.rejects(run(delayed), /Could not complete check run \(a network error; the outcome could not be confirmed\)/);
  assert.equal(completionCheck(delayed), undefined, 'the check reads as open right after the failure');
  assert.match(summaryOf(delayed), /\*\*Outcome unconfirmed\*\*/);
  assert.doesNotMatch(summaryOf(delayed), /Not completed|no verdict is recorded/);
  await delayed.fetch('https://api.github.com/repos/o/r/check-runs/900', { method: 'PATCH', body: JSON.stringify({ status: 'completed', conclusion: 'success', output: { title: 'late', summary: 'late' } }) });
  assert.equal(completionCheck(delayed).conclusion, 'success', 'the request that seemed lost completes the check later');
  assert.doesNotMatch(summaryOf(delayed), /no verdict is recorded/);

  const unknown = world({ diff: HUNK_DIFF, failOn: 'GET /repos/o/r/check-runs/900', traps: [lost()] });
  await assert.rejects(run(unknown), /a network error; the outcome could not be confirmed/);
  assert.match(summaryOf(unknown), /\*\*Outcome unconfirmed\*\*[\s\S]*may or may not have recorded a verdict/);
  assert.doesNotMatch(summaryOf(unknown), /no verdict is recorded|Passed|Not completed/);
  assert.equal(completionCheck(unknown).conclusion, 'success');

  const other = world({ diff: HUNK_DIFF, traps: [{ on: 'PATCH /repos/o/r/check-runs/900', after: api => { api.checks.at(-1).conclusion = 'failure'; throw new Error('socket closed'); } }] });
  await assert.rejects(run(other), /could not be confirmed/);
  assert.match(summaryOf(other), /Outcome unconfirmed/);
});

test('completion failure: if the Not completed notice cannot be written, or the comments cannot be read, the job still fails with the check unfinished', async () => {
  const down = world({ diff: HUNK_DIFF, failOn: 'PATCH /repos/o/r/check-runs/900', traps: [{ on: 'PATCH /repos/o/r/check-runs/900', before: api => { api.state.failComments = true; } }] });
  await assert.rejects(run(down), /Could not complete check run/);
  assert.equal(ours(down).length, 0);
  assert.ok(!JSON.stringify(down.checks).includes(TOKEN));

  const unreadable = world({ diff: HUNK_DIFF, failOn: 'GET /repos/o/r/issues/5/comments', traps: [{ on: 'POST /repos/o/r/check-runs', after: api => { api.state.failCheckPatch = true; } }] });
  await assert.rejects(run(unreadable), /Could not complete check run \(status 502/);
  assert.equal(ours(unreadable).length, 0);
});

const NOTE = 'summary comment created; no inline findings.';
const noteDown = (on = 'POST /repos/o/r/issues/5/comments') => ({ on, after: api => { api.state.failCheckPatch = true; } });

test('feedback note: a rejected note update is reported in the log and the verdict stands, also when the comment itself failed', async () => {
  const w = world({ diff: HUNK_DIFF, traps: [noteDown()] });
  const result = await run(w);
  assert.deepEqual(result.feedback, { note: NOTE, recorded: false, problem: 'status 502' });
  assert.equal(completionCheck(w).conclusion, 'success');
  assert.doesNotMatch(completionCheck(w).output.summary, /Pull request feedback/);
  assert.match(describeResult(result), /^Review completed: success\. Pull request feedback: summary comment created; no inline findings\.\n::warning::The check summary could not be updated .*\(status 502\)/);

  const both = world({ diff: HUNK_DIFF, failOn: 'POST /repos/o/r/issues/5/comments', traps: [noteDown()] });
  const bothResult = await run(both);
  assert.equal(bothResult.conclusion, 'success');
  assert.match(bothResult.feedback.note, /could not be published \(summary comment: status 500\)/);
  assert.match(describeResult(bothResult), /could not be published[\s\S]*::warning::.*status 502/);
  assert.ok(!describeResult(bothResult).includes(TOKEN));
});

test('feedback note: a network error is reported, a transient failure is retried once, a recorded note raises no warning, and a skipped run has nothing to report', async () => {
  const thrown = times => ({ on: 'PATCH /repos/o/r/check-runs/900', nth: 2, times, before: () => { throw new Error('socket closed'); } });
  const down = world({ diff: HUNK_DIFF, traps: [thrown(2)] });
  const result = await run(down);
  assert.deepEqual(result.feedback, { note: NOTE, recorded: false, problem: 'a network error' });
  assert.match(describeResult(result), /::warning::.*a network error/);
  assert.equal(completionCheck(down).conclusion, 'success');

  const flaky = world({ diff: HUNK_DIFF, traps: [thrown(1)] });
  const retried = await run(flaky);
  assert.deepEqual(retried.feedback, { note: NOTE, recorded: true });
  assert.equal(describeResult(retried), `Review completed: success. Pull request feedback: ${NOTE}`);
  assert.match(flaky.checks.filter(c => c.patch).at(-1).output.summary, /Pull request feedback: summary comment created; no inline findings\./);
  assert.equal(describeResult({ skipped: true }), 'Skipped: pull request head moved or pull request closed.');
});

const patchedIds = w => w.calls.filter(c => c.method === 'PATCH' && /issues\/comments\/\d+$/.test(c.path)).map(c => Number(c.path.split('/').at(-1)));

test('comment races: another SHA\'s, run\'s or author\'s comment, a forged marker, or a newer verdict that appears after the listing is never edited', async () => {
  const at = (id, comment) => ({ ...comment, id });
  const seeded = [
    at(6, olderComment('c'.repeat(40), 'Passed')),
    at(7, { user: { login: 'someone' }, body: olderComment('f'.repeat(40), 'Passed').body }),
    at(8, { user: { login: 'mallory' }, body: olderComment(SHA, 'Passed', 900).body }),
    at(9, olderComment(SHA, 'Requires changes', 899)),
  ];
  const newer = forB('Passed');
  const snapshot = [...seeded, newer].map(c => c.body);
  const w = world({ diff: HUNK_DIFF, model: failing([finding()]), seed: seeded, traps: [{ on: 'POST /repos/o/r/issues/5/comments', before: api => { api.state.head = SHA_B; api.comments.push(newer); } }] });
  await run(w);
  assert.deepEqual([...seeded, newer].map(c => c.body), snapshot);
  assert.deepEqual(patchedIds(w), []);
  assert.equal(w.comments.length, 6);
  assert.equal(ours(w).filter(c => c.body.includes('<!-- run:900 -->') && c.body.includes(`head:${SHA}`)).length, 1);
});

test('comment races: duplicates of one run are kept consistent, and a newer same-SHA run that appears after the listing is left alone', async () => {
  const dup = olderComment(SHA, 'Passed', 900);
  const dup2 = { ...olderComment(SHA, 'Passed', 900), id: 8 };
  const w = world({ diff: HUNK_DIFF, model: failing([finding()]), seed: [dup, dup2] });
  await run(w);
  assert.match(dup.body, /Requires changes/);
  assert.equal(dup2.body, dup.body);

  const shared = [];
  const racing = world({ diff: HUNK_DIFF, shared, checkIds: [901], traps: [{ on: 'GET /repos/o/r/issues/5/comments', after: () => { shared.push({ ...olderComment(SHA, 'Requires changes', 902), id: 3000 }); } }] });
  await run(racing);
  assert.equal(github(racing, /^PATCH \/repos\/o\/r\/issues\/comments\/\d+$/).length, 0);
  assert.match(shared.find(c => c.id === 3000).body, /Requires changes/);
  assert.equal(shared.filter(c => c.body.includes('<!-- run:901 -->')).length, 1);
});

test('same-SHA runs: an older run finishing after a newer one changes neither its comment nor its check; a run in flight has no comment; one that cannot complete leaves only its own notice', async () => {
  const shared = [];
  const newer = world({ diff: HUNK_DIFF, model: failing([finding()]), shared, checkIds: [902] });
  const older = world({ diff: HUNK_DIFF, model: verdict(), shared, checkIds: [901] });
  assert.equal((await run(newer)).conclusion, 'failure');
  const newerComment = shared.find(c => c.body.includes('<!-- run:902 -->'));
  const snapshot = newerComment.body;
  assert.equal((await run(older)).conclusion, 'success');
  assert.equal(newerComment.body, snapshot);
  assert.match(snapshot, /Requires changes/);
  assert.match(shared.find(c => c.body.includes('<!-- run:901 -->')).body, /\*\*Passed\*\*.*check run 901/s);
  assert.equal(github(older, /^PATCH \/repos\/o\/r\/issues\/comments\/\d+$/).length, 0);
  assert.equal(newer.checks.find(c => c.patch).conclusion, 'failure');
  assert.equal(older.checks.find(c => c.patch).conclusion, 'success');
  assert.equal(older.checks.find(c => c.patch).run, 901);

  let during;
  await run(world({ diff: HUNK_DIFF, traps: [{ on: 'POST /v1/messages', before: api => { during = api.comments.length; } }] }));
  assert.equal(during, 0);

  const stuck = [];
  await run(world({ diff: HUNK_DIFF, shared: stuck, checkIds: [902] }));
  const kept = stuck[0].body;
  await assert.rejects(run(world({ diff: HUNK_DIFF, shared: stuck, checkIds: [900], failOn: 'PATCH /repos/o/r/check-runs/900', failStatus: 404 })), /Could not complete/);
  assert.equal(stuck[0].body, kept);
  assert.equal(stuck.length, 2);
  assert.match(stuck[1].body, /<!-- run:900 -->[\s\S]*\*\*Not completed\*\*/);
  assert.doesNotMatch(stuck[1].body, /Passed|Requires changes/);
});

const stubPages = (total, seen = []) => async url => {
  const page = Number(new URL(url).searchParams.get('page'));
  seen.push(page);
  return new Response(JSON.stringify(Array.from({ length: Math.max(0, Math.min(100, total - (page - 1) * 100)) }, (_, i) => ({ id: (page - 1) * 100 + i }))));
};

test('listing: pages past the first 1,000 items are read, and a listing that may hide more is reported as truncated, never as complete', async () => {
  assert.equal(LIST_MAX_PAGES, 30);
  for (const [total, truncated] of [[0, false], [1, false], [99, false], [100, false], [250, false], [299, false], [300, true], [301, true], [1500, true]]) {
    const seen = [];
    const result = await listAll(stubPages(total, seen), 't', '/x', 3);
    assert.equal(result.truncated, truncated, String(total));
    assert.equal(result.items.length, Math.min(total, 300), String(total));
    assert.ok(seen.length <= 3, String(total));
  }
  const fullDefault = await listAll(stubPages(2999), 't', '/x');
  assert.deepEqual([fullDefault.items.length, fullDefault.truncated, fullDefault.items.at(-1).id], [2999, false, 2998]);
  assert.equal((await listAll(stubPages(3000), 't', '/x')).truncated, true);
  await assert.rejects(listAll(async () => new Response('{}', { status: 502 }), 't', '/x'), /status 502/);
});

const others = (count, base) => Array.from({ length: count }, (_, i) => ({ id: base + i, user: { login: 'someone' }, pull_request_review_id: 1, body: 'unrelated' }));

test('listing limits: an already posted finding is found beyond 1,000 comments; at 3,000 review comments the findings are still posted and the unchecked duplicates are said so', async () => {
  const model = failing([finding()]);
  const first = world({ diff: HUNK_DIFF, model });
  await run(first);
  const posted = first.reviewComments[0];
  const deleted = w => w.calls.filter(c => c.method === 'DELETE');

  const deep = world({ diff: HUNK_DIFF, model });
  deep.reviewComments.push(...others(2_500, 10_000), { ...posted, id: 99_999 }, ...others(498, 20_000));
  assert.equal(deep.reviewComments.length, 2_999);
  const found = await run(deep);
  assert.equal(deep.reviews.length, 0);
  assert.match(found.feedback.note, /inline findings already posted/);
  assert.equal(finalCheck(deep).conclusion, 'failure');

  const full = world({ diff: HUNK_DIFF, model });
  full.reviewComments.push(...others(3_000, 10_000));
  const result = await run(full);
  assert.equal(full.reviews.length, 1);
  assert.equal(full.reviewComments.length, 3_001);
  assert.match(result.feedback.note, /1 inline comment posted; more than 3000 review comments exist, so duplicates could not be checked/);
  assert.equal(deleted(full).length, 0);
  assert.equal(finalCheck(full).conclusion, 'failure');
  assert.match(finalCheck(full).output.summary, /duplicates could not be checked/);

  const beyond = world({ diff: HUNK_DIFF, model });
  beyond.reviewComments.push(...others(2_998, 10_000));
  const ok = await run(beyond);
  assert.doesNotMatch(ok.feedback.note, /could not be checked/);

  const tipping = world({ diff: HUNK_DIFF, model });
  tipping.reviewComments.push(...others(2_999, 10_000));
  const tipped = await run(tipping);
  assert.equal(tipping.reviews.length, 1);
  assert.match(tipped.feedback.note, /1 inline comment posted; duplicates from a concurrent run could not be checked or removed \(more than 3000 review comments exist\)/);
  assert.equal(deleted(tipping).length, 0);
});

test('listing limits: with more than 3,000 comments the summary comment cannot be located safely, so none is written, and the verdict is unchanged', async () => {
  const crowded = world({ diff: HUNK_DIFF, seed: others(3_000, 20_000).map(c => ({ id: c.id, user: c.user, body: c.body })) });
  const result = await run(crowded);
  assert.equal(result.conclusion, 'success');
  assert.equal(finalCheck(crowded).conclusion, 'success');
  assert.equal(crowded.calls.filter(c => c.method === 'POST' && /issues\/5\/comments$/.test(c.path)).length, 0);
  assert.match(finalCheck(crowded).output.summary, /could not be published \(summary comment: the pull request has more than 3000 comments/);

  const fits = world({ diff: HUNK_DIFF, seed: others(2_999, 20_000).map(c => ({ id: c.id, user: c.user, body: c.body })) });
  await run(fits);
  assert.equal(ours(fits).length, 1);
});

const longFindings = (count, size) => Array.from({ length: count }, (_, i) => finding({ severity: 'minor', file: undefined, line: undefined, message: `F${String(i).padStart(2, '0')} ${'x'.repeat(size)}` }));

test('long findings: when every finding fits in the check the summary points to it; when not, both surfaces say exactly what is missing and nothing points to details that are not there', async () => {
  assert.equal(CHECK_TEXT_MAX, 60_000);

  const fits = world({ diff: HUNK_DIFF, model: failing(longFindings(30, 1_800)) });
  await run(fits);
  const fitsCheck = finalCheck(fits).output;
  assert.ok(fitsCheck.text.length <= CHECK_TEXT_MAX);
  assert.ok(fitsCheck.text.includes('F29 '));
  assert.doesNotMatch(fitsCheck.summary, /Only the first/);
  const fitsBody = ours(fits)[0].body;
  assert.ok(fitsBody.length < 65_536);
  assert.match(fitsBody, /### Findings \(30\)/);
  assert.match(fitsBody, /- and 14 more in the check/);
  assert.doesNotMatch(fitsBody, /not shown anywhere/);

  const w = world({ diff: HUNK_DIFF, model: failing(longFindings(40, 1_800)) });
  await run(w);
  const check = finalCheck(w).output;
  assert.ok(check.text.length <= CHECK_TEXT_MAX);
  const inCheck = (check.text.match(/^- \*\*minor\*\*: F\d\d /gm) ?? []).length;
  assert.ok(inCheck > 0 && inCheck < 40);
  assert.ok(check.text.includes(`F${String(inCheck - 1).padStart(2, '0')} `));
  assert.ok(!check.text.includes(`F${String(inCheck).padStart(2, '0')} `));
  assert.ok(check.summary.includes(`Only the first ${inCheck} of 40 findings fit in the check's size limit; the other ${40 - inCheck} are not shown.`));
  assert.match(check.text, new RegExp(`${40 - inCheck} more findings are not shown`));
  const body = ours(w)[0].body;
  assert.ok(body.length < 65_536);
  const listed = (body.match(/^- \*\*minor\*\*: F\d\d /gm) ?? []).length;
  assert.ok(listed > 0 && listed < inCheck);
  assert.ok(body.includes(`the check lists only the first ${inCheck} of 40 because of its size limit, so ${40 - inCheck} are not shown anywhere`));
  assert.ok(body.includes(`and ${40 - listed} more not listed here`));
  assert.doesNotMatch(body, /more in the check/);
  assert.equal(finalCheck(w).conclusion, 'failure');
});

test('long findings: messages longer than the per-message cap and as many findings as the gateway response allows still leave a bounded, truthful check and comment', async () => {
  const w = world({ diff: HUNK_DIFF, model: failing(longFindings(55, 2_100)) });
  await run(w);
  const check = finalCheck(w).output;
  assert.ok(check.text.length <= CHECK_TEXT_MAX && check.summary.length <= 60_000);
  assert.match(check.summary, /Only the first \d+ of 55 findings fit/);
  const body = ours(w)[0].body;
  assert.ok(body.length < 65_536);
  assert.match(body, /### Findings \(55\)/);
  assert.match(body, /are not shown anywhere/);
});
