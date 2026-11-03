# Experimental AI members: operations and consumer API

Implemented for local/draft-PR verification; not deployed by this job. The
[agreed contract](../specs/experimental-ai-members.md) is excluded from human QA
and generated manuals. Use synthetic pilot data and keep human QA identities
ineligible. Production remains disabled throughout the pilot.

## Configuration and later staging rollout

`AI_MEMBER_MANAGER_EMAILS` is server-only, comma/newline-separated exact email
addresses, trimmed and lowercased. Missing/empty disables management and consumers.
Wildcard or malformed entries reject startup with a safe configuration error;
addresses are never included in that error or sent as a list to the browser.
Synthetic example: `owner@example.test,another-owner@example.test`. This grants
no admission or membership: each owner must already be an approved Google user
with active membership. Local synthetic access is ineligible.

The owner reports the variable already exists in both Railway environments:
staging contains the private pilot address; production is empty. Preserve these
values. This report has not been verified against Railway or the running service.
Environment changes apply after the deployed configuration reaches the process.
Revoking eligibility suspends existing credentials without deleting data;
restoring eligibility resumes only still-valid credentials. Signing out does not
suspend consumers. Delete/regenerate a token for permanent credential revocation.
Already-authorized in-flight retrievals may finish; retrieved content cannot be
recalled.

After separately authorized merge/release:

1. Follow [Releasing](releasing.md) for schema 10 migration and staging app rollout
   from the same approved revision. Confirm the existing staging allowlist reaches
   the running app and production remains empty. This additive migration must
   precede app replacement; an older schema-9 app can coexist with the new tables.
   Do not remove the tables on rollback. Automatic production admission blocks
   mismatched advertised schema versions; this is a manual schema release.
2. If coaching is desired, check the existing [coaching configuration](coaching.md):
   `COACH_ENABLED=1`, both dedicated provider keys, primary base URL and current
   primary/fallback model settings. No new provider key, model service or SQL login
   is needed. Disabled/unavailable coaching leaves manual editing available.
   Local injected fakes do not prove hosted connectivity or provider quality.
3. Sign in with the eligible pilot owner; create a synthetic member, save a focus
   and issue a named token. Store the issuance-only secret in the consumer's secret
   storage with the existing HTTPS service origin. Close the issuance interaction;
   later metadata cannot recover its secret.
4. Make a bearer GET, compare the ordered goals/version and reopen Manage to check
   the localized retrieval time and version actually served. Check no-focus and
   revoked-token errors with synthetic data. This is private operator activation,
   excluded from human QA sign-off and generated QA artifacts.
5. Use allowlist removal for reversible suspension; token deletion or regeneration
   for permanent revocation. Keep production's allowlist empty and retain schema
   and stored data when the experiment is disabled.

No hosted edit, migration, deployment, merge, production access or live paid model
call is authorized by the implementation handoff. This document is a later operator
procedure, not evidence those actions happened.

## Consumer request and exact response

The sole consumer route is `GET /api/ai-member/position-focus`, using
`Authorization: Bearer <issued-token>`. The credential selects the member. No
query parameters or request body are accepted. A synthetic, nonfunctional example:

```sh
curl --request GET 'https://lantern-stage.example.test/api/ai-member/position-focus' \
  --header 'Authorization: Bearer lam_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
```

A successful JSON response has exactly this shape (timestamps are UTC ISO 8601):

```json
{
  "member": {
    "id": "9746ad0e-c151-4ea9-ad72-c0452ee312e5",
    "name": "Synthetic release helper"
  },
  "focus": {
    "objective": "Improve the reliability of synthetic releases.",
    "goals": [
      "By 30 November, review three synthetic failures.",
      "By 31 December, publish two synthetic runbooks."
    ],
    "version": 1,
    "updatedAt": "2026-11-03T00:00:00.000Z"
  }
}
```

The typed contract is [AiMemberFocusResponse](../../shared/ai-members.ts).
No human identity, department, token metadata or provider context is included.
Success commits the retrieval timestamp and exact served focus version before
returning. It is evidence of successful server-side retrieval, not consumer
acknowledgement or delivery/use. No-focus, invalid requests and owner UI reads do
not count. Member-level evidence survives token deletion and later focus edits.
Per-token retrieval statistics are not implemented.

| HTTP status | Meaning |
| --- | --- |
| 200 | Saved focus returned and retrieval evidence committed. |
| 400 | Query parameters or body supplied. |
| 401 | Generic `{"error":"Invalid credentials."}` for invalid, revoked or suspended credentials. |
| 404 | Valid credential with no saved focus: `{"error":"Position focus is not configured.","code":"focus_not_configured"}`. |
| 405 | Any unsupported method, including HEAD; `Allow: GET`. |
| 429 | Instance request limit; `Retry-After: 60`. |
| 503 | Storage unavailable, including failure to commit retrieval evidence. |

Responses set `Cache-Control: no-store`. Bearer tokens grant no owner UI,
management or coaching authority. Browser writes retain Google-session and
Origin/CSRF protections. The limiter allows 120 requests per connection IP per
minute and 600 globally, with a capped map of at most 1024 IPs, reset each window.
It uses the socket peer rather than trusting forwarded IP headers; a shared proxy
may therefore share the IP quota. Limits are per app instance, not distributed.
GET rejects bodies; JSON management requests retain the existing 1 MiB cap.
Profiles and token names are 1–100 characters, optional purpose is at most 4000,
objective is 1–10000, and there are 1–100 ordered goals of 1–10000 characters each.
Whitespace-only required text is invalid. Coaching accepts partial form content
within the same upper bounds; output must be complete and cannot omit goal slots.
All text is plain text.

## Schema and SQL authority

Schema 10 adds `ai_members`, `ai_member_focuses` and `ai_member_tokens`.
`ai_members.owner_user_id` restricts implicit human deletion. Deleting the member
cascades its single optional focus and all credentials. Current focus replacement
retains no revision history. Profile revision, focus version and credential revision
are independent. Telemetry changes neither editor revision. An unchanged focus
save retains its version and update timestamp.

The migration role owns schema/grants. Runtime receives explicit SELECT/INSERT/
DELETE on these three tables, with UPDATE limited to mutable profile, focus,
credential-verifier and telemetry columns. Runtime cannot update any ID,
owner/member relationship, token name or creation time. The admin role receives
maintenance CRUD on the new tables and retains its existing separate purpose;
human application permissions are unchanged. No human or consumer gets SQL access.
Schema readiness, startup privilege checks and `db:verify` include the new tables.

All member operations acquire the member lock before touching children. Consumer
lookup rechecks the verifier after acquiring that lock, preventing a concurrent
rotation/deletion from reviving an old credential. Focus writes check their expected
version; rotations/deletions check credential revision. A pre-revocation snapshot
may complete, but later reads fail. Provider calls hold no database locks and
share existing human/global coach admission (one turn per human, four global,
20 turns per human/minute, with bounded admission memory).

Tokens contain 256 cryptographically random bits (`lam_` plus base64url), stored
only as unique SHA-256 verifiers and six-character nonsecret suffixes. Raw values
exist only transiently at issuance/rotation and in that browser interaction; no
browser storage is used. Copy is explicit. Lost secrets require regeneration.
Application/provider logs omit secrets and coaching content.

Synthetic acceptance cleanup explicitly rejects unexpected AI-member roots before
deleting human fixtures. QA reset similarly refuses experimental relationships;
it does not erase private experiment data as part of supported-product reset.
