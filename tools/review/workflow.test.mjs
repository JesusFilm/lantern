import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const workflow = readFileSync(new URL('../../.github/workflows/independent-review.yml', import.meta.url), 'utf8');
const expression = key => {
  const line = workflow.split('\n').find(l => new RegExp(`^\\s+${key}:`).test(l));
  return line.replace(/^\s+\w+:\s*/, '').replace(/^\$\{\{\s*/, '').replace(/\s*\}\}$/, '');
};

// Evaluates the small GitHub expression subset the workflow uses (== != && || ! parentheses, strings, null, false, format, context paths).
function evaluate(source, context) {
  const tokens = source.match(/'[^']*'|==|!=|&&|\|\||[()!,]|[A-Za-z_][\w.]*/g);
  assert.equal(tokens.join(''), source.replace(/\s+/g, ''), `unsupported syntax in: ${source}`);
  let at = 0;
  const peek = () => tokens[at];
  const take = () => tokens[at++];
  const lookup = path => path.split('.').reduce((value, key) => (value == null ? null : (value[key] ?? null)), context);
  const falsy = value => value === false || value === null || value === '' || value === 0;
  const equal = (a, b) => a === b;
  function primary() {
    const token = take();
    if (token === '(') { const value = or(); assert.equal(take(), ')'); return value; }
    if (token === '!') return falsy(primary());
    if (token.startsWith("'")) return token.slice(1, -1);
    if (token === 'null') return null;
    if (token === 'false') return false;
    if (token === 'true') return true;
    if (peek() === '(' && token === 'format') {
      take();
      const args = [or()];
      while (peek() === ',') { take(); args.push(or()); }
      assert.equal(take(), ')');
      return args[0].replace(/\{(\d)\}/g, (_, i) => String(args[Number(i) + 1]));
    }
    assert.match(token, /^github\./, `unknown token ${token}`);
    return lookup(token);
  }
  function comparison() {
    let left = primary();
    while (peek() === '==' || peek() === '!=') {
      const operator = take();
      const right = primary();
      left = operator === '==' ? equal(left, right) : !equal(left, right);
    }
    return left;
  }
  function and() { let left = comparison(); while (peek() === '&&') { take(); const right = comparison(); left = falsy(left) ? left : right; } return left; }
  function or() { let left = and(); while (peek() === '||') { take(); const right = and(); left = falsy(left) ? right : left; } return left; }
  const value = or();
  assert.equal(at, tokens.length, `trailing tokens in: ${source}`);
  return value;
}

const event = ({ action = 'opened', base = 'main', draft = false, changes, number = 7, runId = 1 }) => ({
  github: { run_id: runId, event: { action, number, pull_request: { number, draft, base: { ref: base } }, ...(changes ? { changes } : {}) } },
});
const runs = e => Boolean(evaluate(expression('if'), e));
const group = e => evaluate(expression('group'), e);
const REVIEW_GROUP = 'independent-review-7';

test('workflow events: a PR retargeted to main is reviewed, and unrelated edits neither review nor cancel a review in progress', () => {
  assert.match(workflow, /types: \[opened, synchronize, reopened, ready_for_review, edited\]/);

  for (const action of ['opened', 'synchronize', 'reopened', 'ready_for_review']) {
    assert.equal(runs(event({ action })), true, action);
    assert.equal(group(event({ action })), REVIEW_GROUP, action);
  }
  assert.equal(runs(event({ action: 'opened', base: 'dev' })), false);
  assert.equal(runs(event({ action: 'opened', draft: true })), false);

  const retarget = event({ action: 'edited', changes: { base: { ref: { from: 'dev' }, sha: { from: 'a'.repeat(40) } } } });
  assert.equal(runs(retarget), true);
  assert.equal(group(retarget), REVIEW_GROUP);
  assert.equal(runs(event({ action: 'edited', draft: true, changes: { base: { ref: { from: 'dev' } } } })), false);

  const retargetAway = event({ action: 'edited', base: 'dev', changes: { base: { ref: { from: 'main' } } } });
  assert.equal(runs(retargetAway), false);

  for (const changes of [{ title: { from: 'Old title' } }, { body: { from: 'Old body' } }, { title: { from: 'a' }, body: { from: 'b' } }]) {
    const unrelated = event({ action: 'edited', changes, runId: 41 });
    assert.equal(runs(unrelated), false, JSON.stringify(changes));
    assert.notEqual(group(unrelated), REVIEW_GROUP, 'an ignored edit must not join, and so cancel, the review group');
    assert.notEqual(group(event({ action: 'edited', changes, runId: 42 })), group(unrelated), 'ignored edits must not cancel each other either');
  }
  assert.equal(runs(event({ action: 'edited', changes: {} })), false);
});

test('workflow events: the expression evaluator rejects what it cannot evaluate, so the event test cannot pass vacuously', () => {
  assert.throws(() => evaluate("github.a ~ 'x'", event({})));
  assert.equal(evaluate("github.event.changes.base.ref.from == null", event({})), true);
  assert.equal(evaluate("github.event.action == 'edited' && 'yes' || 'no'", event({ action: 'edited' })), 'yes');
});
