# Change review

Use current CI, independent engineering inspection and the owner's delegated authority when deciding whether to merge. A green check establishes only the behavior covered by that check; see [testing](../development/testing.md) and [releasing](releasing.md).

The dedicated Qwen GitHub reviewer is retired. Its workflow, harness and CI job have been removed. Historical **Independent review** checks and comments are experimental evidence, not approval for a current revision. The retirement decision and trial evidence are recorded in [ADR 0013](../adrs/0013-retire-dedicated-reviewer.md).

## Protected changes

Changes to `.github/**`, `tools/release/**` or this guide require independent inspection by a separate reviewer at the exact final head SHA and the owner's explicit authorization before merge. Agent-instruction changes also require the owner's decision. Record the reviewer, SHA, findings, checks and owner authorization in the delivery audit or PR. Repeat inspection after any further commit.

Required checks and repository protections still apply. Verify their current configuration in GitHub. Changing the review mechanism does not grant an agent additional merge, credential, repository-administration or production authority. An agent whose delegated merge authority depended on the retired reviewer must hold autonomous merges until the owner agrees a replacement verification process; it can continue authorized investigation, implementation, testing and draft PRs.

## Administrative retirement

Removing code does not remove credentials or an App installation. After the removal is merged, confirm there are no queued or running reviewer jobs and no other consumers, then obtain the owner's approval for these security changes:

- Remove the `ai-review` environment's `AI_REVIEW_APP_PRIVATE_KEY` and `AI_REVIEW_GATEWAY_API_KEY` secrets and `AI_REVIEW_APP_ID`, `AI_REVIEW_GATEWAY_BASE_URL` and `AI_REVIEW_MODEL` variables; remove the environment when no consumer remains.
- Remove the **Lantern Independent Review** App's installation/access to this repository and revoke its dedicated signing key. Verify its full installation and key inventory before deleting the App registration (`lantern-independent-review`, App ID `5571876`).
- Identify the gateway virtual key behind `AI_REVIEW_GATEWAY_API_KEY`, check its consumers and revoke only that dedicated key after approval.

The product goal coach has separate credentials and providers; see [coaching operations](coaching.md). Preserve those keys, LanternBot's contributor credential, the general Qwen service, gateway/model routes and unrelated schedules. Retain trial PRs and historical review evidence until their closure or removal is separately agreed.
