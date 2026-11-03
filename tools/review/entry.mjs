// Only a validated manual event may omit the expected head SHA. runReview then
// resolves the current eligible pull request through the authenticated App API.
export function reviewTarget({ eventName, ref, event }) {
  if (eventName === 'workflow_dispatch') {
    if (ref !== 'refs/heads/main') throw new Error('Manual review must run on main');
    const input = event?.inputs?.pr_number;
    const prNumber = Number(input);
    if (typeof input !== 'string' || !/^[1-9][0-9]*$/.test(input) || input !== String(prNumber) || !Number.isSafeInteger(prNumber)) {
      throw new Error('Invalid PR number');
    }
    return { prNumber, expectedSha: undefined };
  }
  if (eventName !== 'pull_request_target') throw new Error('Unsupported review event');
  const prNumber = event?.pull_request?.number;
  if (!Number.isSafeInteger(prNumber) || prNumber <= 0) throw new Error('Invalid PR number');
  const expectedSha = event?.pull_request?.head?.sha;
  if (typeof expectedSha !== 'string' || expectedSha.length !== 40 || !/^[a-f0-9]{40}$/i.test(expectedSha)) throw new Error('Invalid head SHA');
  return { prNumber, expectedSha };
}
