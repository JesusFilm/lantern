# Remove legacy domain restrictions from an existing production database

This change replaces domain admission with exact normalized email approval in every environment. `approved_emails` remains authoritative; membership and career-lead authority remain separate. Google still verifies identity and email ownership. No account, approval, membership, session or position-focus record is intentionally removed.

The historical storage is `users.hosted_domain` and the `allowed_domains` table. Migration 6 drops both, including their values, and the old three-argument `enroll_member` function. The current application neither reads Google's `hd` claim nor stores it. References in old migrations, the legacy schema importer and migration tests describe historical input only.

## Required release order

The release workflow migrates before replacing the serving application. **Do not promote the deletion release directly over the original domain-dependent app.** First deploy the compatibility release from PR #22 (schema 5), wait for successful readiness, then deploy the deletion release from PR #23 (schema 6). Both must have successful main staging delivery artifacts. Empty new installations can use schema 6 directly.

Perform these steps on your Mac with your existing GitHub production permissions. The production environment must already have its own migration credentials, certificate and Railway deployment settings as described in [Delivery](../../README.md#delivery). No production credentials or data should be copied to the VM. The normal production workflow runs the migration and cleanup; no additional DELETE script, Railway shell command or database bootstrap is needed.

1. Preserve a normal production database backup through your existing Railway backup procedure before the destructive release. Keep any backup containing historical domain values private under your retention policy; dropping live storage does not erase existing backups. Do not reset or bootstrap the existing database.
2. In a current repository checkout, get the compatibility release SHA and dispatch it:

   ```bash
   git fetch origin
   compatibility_sha=$(gh pr view 22 --repo JesusFilm/lantern --json mergeCommit --jq '.mergeCommit.oid')
   gh workflow run promote.yml --repo JesusFilm/lantern --ref main -f sha="$compatibility_sha"
   gh run list --repo JesusFilm/lantern --workflow promote.yml --limit 5
   ```

3. Open the newly dispatched **Deploy production** run. Verify it targets the compatibility SHA; complete any configured environment approval. Wait for its successful completion (`gh run watch RUN_ID --repo JesusFilm/lantern --exit-status`). Download its `production-evidence-<compatibility_sha>` artifact and confirm `sha`, `readiness: passed`, `schemaVersion: 5` and deployment ID. Independently check your production origin's `/health` response headers: `X-Lantern-Revision` must equal that SHA and `X-Lantern-Schema` must be `5`.
4. Only after step 3, dispatch the schema-6 deletion release's full main SHA from merged PR #23:

   ```bash
   removal_sha=$(gh pr view 23 --repo JesusFilm/lantern --json mergeCommit --jq '.mergeCommit.oid')
   gh workflow run promote.yml --repo JesusFilm/lantern --ref main -f sha="$removal_sha"
   gh run list --repo JesusFilm/lantern --workflow promote.yml --limit 5
   ```

5. Wait for that run's success. Its `production-evidence-<removal_sha>` artifact must report the selected SHA, `readiness: passed`, `schemaVersion: 6` and deployment ID. Check `/health` independently for that revision and schema `6`. Health checks the migration ledger and the absence of both legacy storage objects and the old function. The workflow's own main SHA may differ from the selected app SHA; use the artifact and health headers.
6. With approved accounts you control, verify Google sign-in for a personal account and, if available, a work account from a different domain. Confirm an unapproved address is denied, a registered account without membership sees no department data, and normal member/lead workflows still work. Removing exact-email approval must deny the existing session on its next request. These authenticated checks require normal Google sign-in; release readiness does not perform them.

For optional direct structural confirmation, run [verify-domain-removal.sql](../../tools/database/verify-domain-removal.sql) using your private production administrative connection. It prints only structural status, not account data. All four results must be true. Do not run the migration SQL separately from the SHA-pinned release workflow.

## Failure and recovery

A migration error blocks deployment and rolls back migration 6's changes, including its ledger entry. An unexpected dependent object is an error; the migration deliberately does not use `CASCADE`. Inspect the dependency before retrying.

If migration succeeds but app delivery or smoke fails, schema 5's already-running compatibility app can continue serving against schema 6. Repair the delivery problem and retry the schema-6 release; migrations are idempotent. Do not promote a pre-compatibility app or rerun schema-5 migration tooling after deletion: its legacy grants require objects that no longer exist. Do not recreate domain storage as an access workaround. Any backup restoration is a separate owner-operated incident recovery decision affecting the entire database.
