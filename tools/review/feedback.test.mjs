import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { decide, parseVerdict } from './verdict.mjs';
import { COMMENT_MARKER, MAX_INLINE, diffRightLines, escapeText } from './feedback.mjs';
import { runReview } from './review.mjs';
import { SHA, TOKEN, verdict, SHA_B, world, config, run, finalCheck, HUNK_DIFF, manyLinesDiff, finding, failing, writes, ours, github, olderComment, completionCheck, summaryOf, forB } from './fake-github.mjs';

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
  assert.match(body, /\*\*Passed\*\* for `aaaaaaa`/);
  assert.match(body, /check_run_id=900/);
  assert.match(body, /not a formal pull request approval/);
  assert.equal(w.reviews.length, 0);
  assert.match(finalCheck(w).output.summary, /Pull request feedback: summary comment (created|updated)/);
});

test('repeated runs edit the same comment in place and never duplicate inline comments for the same commit', async () => {
  const model = failing([finding(), finding({ line: 3, message: 'Second.' })]);
  const w = world({ diff: HUNK_DIFF, model });
  await run(w);
  await run(w);
  await run(w);
  assert.equal(ours(w).length, 1);
  assert.equal(writes(w).filter(c => c.method === 'POST' && c.path.endsWith('/issues/5/comments')).length, 1);
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
  assert.match(forNew.body, /Each push gets its own comment/);
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
  assert.equal(ours(w).every(c => /Reviewing/.test(c.body)), true);
  assert.match(finalCheck(w).output.summary, /not published: the pull request moved/);
});

test('inline review is COMMENT-only, capped at 10, limited to blocker/major findings on commentable lines', async () => {
  const findings = [
    ...Array.from({ length: 15 }, (_, i) => finding({ file: 'new.ts', line: i + 1, message: `Defect ${i + 1}.` })),
    finding({ file: 'new.ts', line: 99, message: 'Not in diff.' }),
    finding({ file: 'elsewhere.ts', line: 1, message: 'Other file.' }),
    finding({ severity: 'minor', file: 'new.ts', line: 2, message: 'Nit.' }),
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

test('inline comments skip minor findings, lines outside the diff and files outside the diff', async () => {
  const w = world({ diff: HUNK_DIFF, model: failing([
    finding({ line: 2, message: 'Keep A.' }), finding({ severity: 'blocker', line: 3, message: 'Keep B.' }),
    finding({ line: 99, message: 'Out of diff line.' }), finding({ file: 'elsewhere.ts', line: 1, message: 'Out of diff file.' }),
    finding({ severity: 'minor', line: 2, message: 'Just a nit.' }), finding({ line: 3, file: undefined, message: 'No location.' }),
  ]) });
  await run(w);
  assert.deepEqual(w.reviews[0].comments.map(c => [c.path, c.line]), [['client/Guide.tsx', 2], ['client/Guide.tsx', 3]]);
  assert.ok(w.reviews[0].comments.every(c => /Keep/.test(c.body)));
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
  const forged = { id: 7, user: { login: 'mallory' }, body: `${COMMENT_MARKER}\n<!-- head:${SHA} -->\nPassed` };
  const w = world({ diff: HUNK_DIFF, seed: [forged] });
  await run(w);
  assert.equal(forged.body.includes('Passed'), true);
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

test('P2 annotations: messages are escaped and bounded, limited to commentable lines, titled and capped at 50', async () => {
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

test('P2 annotations: if GitHub rejects the annotations the check still completes with the same verdict and a visible note', async () => {
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

test('P2 stale writes: a run whose head already moved never writes the summary comment or inline comments', async () => {
  const w = world({ diff: HUNK_DIFF, model: failing([finding()]), heads: [SHA, SHA_B], seed: [olderComment('c'.repeat(40), 'Earlier')] });
  await run(w);
  assert.equal(writes(w).length, 0);
  assert.match(w.comments[0].body, /Earlier/);
  assert.equal(w.reviews.length, 0);
});

test('P2 stale writes: a delayed older run cannot overwrite a newer run\'s summary', async () => {
  const newer = olderComment(SHA_B, 'Passed for the newer head');
  const before = newer.body;
  const w = world({ diff: HUNK_DIFF, heads: [SHA, SHA_B], seed: [newer] });
  await run(w);
  assert.equal(newer.body, before);
  assert.equal(github(w, /^PATCH \/repos\/o\/r\/issues\/comments/).length, 0);
  assert.equal(writes(w).length, 0);
});

test('P2 stale writes: a head that moves between the guard and a write leaves only text labelled with its own SHA, and no cross-SHA edit', async () => {
  const w = world({ diff: HUNK_DIFF, traps: [{ on: 'POST /repos/o/r/issues/5/comments', before: api => { api.state.head = SHA_B; } }] });
  await run(w);
  assert.equal(ours(w).length, 1);
  assert.ok(ours(w)[0].body.includes(`head:${SHA}`));
  assert.match(ours(w)[0].body, /\*\*Reviewing\*\* \`aaaaaaa\`/);
  assert.doesNotMatch(summaryOf(w), /Superseded|bbbbbbb/);
});

test('P2 stale writes: no inline comments are posted if the head moved after the summary was written', async () => {
  const w = world({ diff: HUNK_DIFF, model: failing([finding()]), traps: [{ on: 'PATCH /repos/o/r/issues/comments/', nth: 1, after: api => { api.state.head = SHA_B; } }] });
  const result = await run(w);
  assert.equal(result.conclusion, 'failure');
  assert.equal(w.reviews.length, 0);
  assert.match(ours(w)[0].body, /Requires changes\*\* for \`aaaaaaa\`/);
  assert.match(finalCheck(w).output.summary, /inline comments not posted: the pull request moved/);
});

test('P2 final decision: a Passed summary is never published unless the head was verified first', async () => {
  const moved = world({ diff: HUNK_DIFF, heads: [SHA, SHA, SHA_B] });
  assert.equal((await run(moved)).conclusion, 'failure');
  assert.doesNotMatch(summaryOf(moved), /Passed/);
  assert.equal(writes(moved).some(c => /Passed/.test(JSON.stringify(c.body))), false);

  const unreadable = world({ diff: HUNK_DIFF, traps: [{ on: 'GET /repos/o/r/pulls/5', nth: 3, before: api => { api.state.pullFails = true; }, after: api => { api.state.pullFails = false; } }] });
  assert.equal((await run(unreadable)).conclusion, 'failure');
  assert.doesNotMatch(summaryOf(unreadable), /Passed/);
  assert.match(finalCheck(unreadable).output.summary, /could not be confirmed/);
  assert.equal(writes(unreadable).some(c => /Passed/.test(JSON.stringify(c.body))), false);
});

test('P2 completion order: the check is completed before any comment says Passed or Requires changes', async () => {
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

test('P2 completion failure: if GitHub rejects the completion no comment says Passed, the Reviewing comment is made honest, and the job fails', async () => {
  const w = world({ diff: HUNK_DIFF, failOn: 'PATCH /repos/o/r/check-runs/900' });
  await assert.rejects(run(w), /Could not complete check run \(status 500\)/);
  assert.equal(ours(w).length, 1);
  assert.doesNotMatch(summaryOf(w), /Passed|Requires changes|Reviewing/);
  assert.match(summaryOf(w), /\*\*Not completed\*\* for \`aaaaaaa\`/);
  assert.match(summaryOf(w), /no verdict is recorded/);
  assert.equal(w.checks.some(c => c.status === 'completed' && !c.patch), false);
  assert.equal(writes(w).some(c => /Passed/.test(JSON.stringify(c.body))), false);

  const other = olderComment('c'.repeat(40), 'Reviewing');
  const untouched = other.body;
  const elsewhere = world({ diff: HUNK_DIFF, failOn: 'PATCH /repos/o/r/check-runs/900', seed: [other] });
  await assert.rejects(run(elsewhere), /Could not complete/);
  assert.equal(other.body, untouched);

  const failing_ = world({ diff: HUNK_DIFF, model: failing([finding()]), failOn: 'PATCH /repos/o/r/check-runs/900' });
  await assert.rejects(run(failing_), /Could not complete/);
  assert.doesNotMatch(summaryOf(failing_), /Bug here|Requires changes/);
  assert.equal(failing_.reviews.length, 0);
});

test('P2 completion failure: a failure after the annotation retry is the same honest outcome, and an annotation-only rejection still completes first', async () => {
  const w = world({ diff: HUNK_DIFF, model: failing([finding()]), traps: [{ on: 'PATCH /repos/o/r/check-runs/900', nth: 2, before: api => { api.state.failCheckPatch = true; } }], failFirst: 'PATCH /repos/o/r/check-runs/900' });
  await assert.rejects(run(w), /Could not complete check run \(status 502\)/);
  assert.match(summaryOf(w), /Not completed/);
  assert.doesNotMatch(summaryOf(w), /Requires changes|Passed/);

  const ok = world({ diff: HUNK_DIFF, model: failing([finding()]), failFirst: 'PATCH /repos/o/r/check-runs/900' });
  assert.equal((await run(ok)).conclusion, 'failure');
  assert.match(summaryOf(ok), /Requires changes/);
});

test('P2 completion failure: if the comment itself cannot be rewritten the job still fails with the check unfinished, and an unreadable comment list is not fatal', async () => {
  const w = world({ diff: HUNK_DIFF, failOn: 'PATCH /repos/o/r/check-runs/900', traps: [{ on: 'PATCH /repos/o/r/check-runs/900', before: api => { api.state.failComments = true; } }] });
  await assert.rejects(run(w), /Could not complete check run/);
  assert.match(summaryOf(w), /Reviewing/);
  assert.ok(!JSON.stringify(w.checks).includes(TOKEN));
});

test('P2 completion failure: a failed feedback-note update after a successful completion is ignored and the verdict stands', async () => {
  const w = world({ diff: HUNK_DIFF, traps: [{ on: 'POST /repos/o/r/issues/5/comments', nth: 2, before: api => { api.state.failCheckPatch = true; } }, { on: 'PATCH /repos/o/r/issues/comments/', nth: 1, before: api => { api.state.failCheckPatch = true; } }] });
  const result = await run(w);
  assert.equal(result.conclusion, 'success');
  assert.equal(completionCheck(w).conclusion, 'success');
  assert.match(summaryOf(w), /\*\*Passed\*\* for \`aaaaaaa\`/);
  assert.doesNotMatch(completionCheck(w).output.summary, /Pull request feedback/);
});

test('P2 completion: a stable head still publishes Passed after completing the check', async () => {
  const w = world({ diff: HUNK_DIFF });
  assert.equal((await run(w)).conclusion, 'success');
  assert.match(summaryOf(w), /\*\*Passed\*\*/);
  assert.equal(completionCheck(w).conclusion, 'success');
});

const bindings = w => new Map(w.comments.map(c => [c.id, /<!-- head:([0-9a-f]{40}) -->/.exec(c.body)?.[1]]));
const patchedIds = w => w.calls.filter(c => c.method === 'PATCH' && /issues\/comments\/\d+$/.test(c.path)).map(c => Number(c.path.split('/').at(-1)));

test('P2 comment race: an older run never overwrites a newer SHA\'s verdict, even if that verdict appears after the run listed the comments', async () => {
  const newer = forB('Passed');
  const before = newer.body;
  const w = world({ diff: HUNK_DIFF, model: failing([finding()]), traps: [{ on: 'PATCH /repos/o/r/issues/comments/', nth: 1, before: api => { api.state.head = SHA_B; api.comments.push(newer); } }] });
  await run(w);
  assert.equal(newer.body, before);
  assert.equal(patchedIds(w).includes(5000), false);
  const mine = ours(w).find(c => c.body.includes(`head:${SHA}`));
  assert.match(mine.body, /for \`aaaaaaa\`/);
});

test('P2 comment race: a restored earlier head and a stale run for it can only edit the comment bound to that SHA', async () => {
  const stored = olderComment(SHA, 'Requires changes');
  const newer = forB('Passed');
  const keep = [stored.body, newer.body];
  const w = world({ diff: HUNK_DIFF, seed: [stored, newer] });
  const original = bindings(w);
  await run(w);
  for (const id of patchedIds(w)) assert.equal(original.get(id), SHA, `comment ${id} is bound to ${original.get(id)}`);
  assert.equal(newer.body, keep[1]);
  assert.match(stored.body, /\*\*Passed\*\* for \`aaaaaaa\`/);

  const racing = world({ diff: HUNK_DIFF, model: failing([finding()]), seed: [olderComment(SHA, 'Reviewing')], traps: [{ on: 'PATCH /repos/o/r/issues/comments/', nth: 1, before: api => { api.state.head = SHA_B; api.comments.push(forB('Passed')); } }] });
  const originalRacing = bindings(racing);
  await run(racing);
  for (const id of patchedIds(racing)) assert.equal(originalRacing.get(id), SHA);
  assert.equal(racing.comments.find(c => c.id === 5000).body, forB('Passed').body);
});

test('P2 comment race: comments for older SHAs and other authors are never touched, and every run labels its comment with its own SHA', async () => {
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

test('P2 comment race: duplicate comments for the same SHA are kept consistent', async () => {
  const dup = olderComment(SHA, 'Reviewing');
  const dup2 = { ...olderComment(SHA, 'Reviewing'), id: 8 };
  const w = world({ diff: HUNK_DIFF, seed: [dup, dup2] });
  await run(w);
  assert.match(dup.body, /Passed/);
  assert.equal(dup2.body, dup.body);
});
