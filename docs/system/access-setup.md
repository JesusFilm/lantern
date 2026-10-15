# Current access implementation and setup

Every Google sign-in requires an exact normalized email in this environment's `approved_emails` table. Approval permits sign-in only; active membership and career-lead authority remain separate. Local and stage admit approved personal Google accounts without a hosted-domain claim. Production requires an approved Google hosted domain as well, and denies personal accounts even when their email is approved. Claimed work domains must be approved in every environment.

`LANTERN_ENV` accepts `local`, `stage` or `production`. Omission selects restrictive production admission; any other value fails startup validation. Stage and production both use `NODE_ENV=production`. `LOCAL_ACCESS` remains a separate loopback-only walkthrough bypass, forbidden under `NODE_ENV=production`. Never use it for hosted QA.

Real identities, Google clients and hosting configuration belong to [environment setup](../../.scratch/team-trial/issues/05-railway-environments.md) and [live acceptance](../../.scratch/team-trial/issues/06-stage-verification.md). None are seeded here. Tests inject synthetic identities at the external provider boundary and use temporary PostgreSQL schemas.

## First setup

Use Node 22.12 or newer, PostgreSQL, and the normal `.env` setup in the README. The server and operations command apply the additive schema on startup. The application's database role needs schema/table creation permission for this beta. Back up an existing database before applying releases.

1. In Google Cloud, configure a Web application OAuth client and consent screen for the intended environment and account audience. Set its authorized redirect URI to the exact public origin followed by `/auth/google/callback`.
2. Set `LANTERN_ENV`, `APP_ORIGIN`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the server's private environment. `APP_ORIGIN` has no trailing slash or path. Hosted origins require HTTPS; local development allows HTTP on `127.0.0.1` or `localhost`. Keep proxy traffic on the same public origin and forward cookies. The app does not derive callback URLs or authorization from forwarded headers. Missing both credentials leaves a configuration message; partially supplied credentials stop startup.
3. Configure the complete approved **Google hosted-domain** allowlist (the verified `hd` claim, not merely the email suffix):

   ```sh
   npm run access:ops -- domains "$APPROVED_DOMAIN"
   ```

   Supply additional domains as separate arguments. The command replaces the list atomically. Removing a domain ends its users' app access on the next request, including existing sessions. It refuses to exclude an active career lead's domain.
4. Approve the lead's exact email **before** their first sign-in:

   ```sh
   npm run access:ops -- approve-email "$LEAD_EMAIL"
   npm run access:ops -- list-approved-emails
   ```

   Approval trims surrounding whitespace and lowercases the address; it does not remove dots, plus tags or match domains/wildcards. Add is idempotent. Lists are sorted. All email values are SQL parameters. Each environment has its own independent approval data; an empty list denies all Google sign-ins.
5. Start the app with `npm run dev`, or `npm run build` followed by `npm start`. Have the intended career lead sign in once. They initially see the waiting screen, creating an ordinary account without membership or lead authority.
6. Create the department and assign that registered account:

   ```sh
   npm run access:ops -- setup "$DEPARTMENT_NAME" "$REGISTERED_LEAD_EMAIL"
   ```

   Use the operator-confirmed engineering name and career-lead email. This operation requires exactly one eligible registered account matching that email. Identity is subsequently tied to Google's stable subject identifier, not the mutable email address. Running setup again with the same values is harmless. A second department, changing the lead or restoring a deleted department is refused.
7. Approve each member email with `approve-email` before sign-in. The lead clicks **Check access** or refreshes. Other eligible people sign in and contact their career lead directly. The lead uses **Department users → Add user**, searches or browses, selects the registered person, and adds them. No free-text invitation, join request or approval queue exists.

The Google implementation follows [Google's OpenID Connect server flow](https://developers.google.com/identity/openid-connect/openid-connect) and [backend token validation guidance](https://developers.google.com/identity/sign-in/web/backend-auth). It uses authorization code + PKCE, a browser-bound single-use state, nonce, and the official library's signature/audience/issuer/expiry checks. A verified email is required; the server then checks exact database approval and its injected environment policy. Missing hosted-domain claims are represented explicitly, never inferred from email suffixes. Tokens from Google are not retained. Seven-day opaque session cookies are HttpOnly/SameSite=Lax and additionally Secure with the `__Host-` prefix on HTTPS; the database stores only their hashes. Mutating browser API requests require the configured Origin.

## Approval revocation and compiled operations

```sh
npm run access:ops -- remove-approved-email "$PARTICIPANT_EMAIL"
```

Removal is idempotent. Existing sessions recheck approval and environment/domain policy on every authenticated request. Revocation denies subsequent protected requests without deleting accounts, documents or membership history. Reapproval does not restore a former membership. Already displayed data clears when the browser refreshes or refocuses. Failed session persistence rolls back account changes, and provider/database failures fail closed with safe feedback.

After `npm run build`, an operator with injected environment variables can run the same commands without a `.env` file:

```sh
node dist/server/operations.js approve-email "$PARTICIPANT_EMAIL"
node dist/server/operations.js list-approved-emails
node dist/server/operations.js remove-approved-email "$PARTICIPANT_EMAIL"
```

For stage, first bootstrap the approved work lead, then separately approve the personal member account, sign in and assign it through the lead's member picker. Repeat with QA participants during later setup; use synthetic focus content. Approval never grants roles, selects a department or restores membership. Setup still requires one approved registered **work** lead and its approved domain.

## Backend member removal

Find the exact user UUID in the career lead's authenticated `/api/department` response, or read it from the database. Verify the target before running:

```sh
npm run access:ops -- remove-member "$MEMBER_USER_ID"
```

This timestamps the membership's `deleted_at`; it does not delete the user, department, membership relation or retained department data. Repeating it is harmless. Every department request resolves active membership from the database, so already-issued sessions lose department access immediately on subsequent requests. A page already displayed is not remotely erased; refreshing, refocusing or making a protected request updates access. The person remains registered and can sign out. Their former membership remains visible with “Rejoining is not yet supported.”

The operation refuses career-lead removal. There is no successor selection, second lead, transfer, restoration or removal UI. Do not bypass this safeguard with ad hoc membership SQL. Membership mutations and backend setup share a transaction lock, and unique constraints prevent duplicate membership and extra active leads. Future department-scoped records must retain their membership/department association and use the same live access check.

## Verification and remaining human checks

```sh
npx playwright install chromium
npm run db:start
npm run typecheck
npm test
npm run build
```

Tests exercise real PostgreSQL and HTTP, plus Chromium using synthetic identities at the external provider boundary. A separate adapter test validates locally signed tokens through the real Google verification library, including rejection of signature, issuer, audience, expiry, nonce and verified-email failures. Browser coverage includes registration/waiting, searchable assignment, unavailable states, session persistence, removal and sign-out. Synthetic other-department membership exists only in the isolated test schema, which is removed afterward. Screenshots in `captures/access-members*.png` contain only synthetic people. Run tests against a local/test database whose role can create temporary schemas.

Before accepting live Google integration, a human must:

- Supply/confirm the real approved domains, career-lead account, Google Web OAuth credentials and callback/hosting origin outside Git.
- Sign in with an eligible Google work account through the actual Google consent/account chooser; confirm unapproved accounts are refused, approved personal accounts work locally/in stage, and production refuses personal accounts and cancel/retry works.
- With separate lead/member browser sessions, check the waiting text, search and select the registered member, then confirm department access after **Check access** and after reopening.
- Review desktop/mobile wording and selection usability. As operator, remove a disposable test member, confirm an already-open member session cannot fetch department data and refreshes to waiting, then confirm sign-out. Removal is intentionally not reversible in beta; choose a disposable account.

Jaco subsequently authorized tickets 07–08 and automated/preparation work for 09, deferring live Google and practical human verification to final review. The [current application verification record](guide-verification.md) replaces the old guide-only checklist. M01 is closed against the revised local baseline; live access checks remain unperformed in M06. The original standalone guide preview was consolidated into the retained prototype viewer.

## Integration with hosted runtime (required before merge)

This branch starts at `ef74bcbb9172094b694132838bd1ab71dc9129bd`. Hosted runtime/CI integrates first. Merge those changes into this branch and rerun migration, compiled startup and authentication checks before merging approved access.

The small startup seam is `admissionPolicy(process.env.LANTERN_ENV)` in `server/index.ts`, injected as `AccessConfig.admissionPolicy`. Runtime configuration may resolve the same typed policy centrally. Do not derive it from `NODE_ENV` or request input. Operations validate the same environment value. The provider adapter verifies Google identity; `registerSession` checks database approval/policy before transactional account/session storage. `isAdmitted` is shared by session resolution and member assignment.

Schema additions currently live in the existing `migrate` function: create empty `approved_emails` with a normalized unique key, and drop `users.hosted_domain`'s NOT NULL constraint. They are repeatable and preserve existing rows. Carry these statements into the runtime owner's migration sequence; do not backfill approvals from existing accounts. Apply schema before deploying this code. Existing accounts lose access until explicitly approved. The migration runner and predeploy/startup split remain owned by the runtime ticket; this branch retains the existing runner behavior.

A previous application version cannot safely serve personal-account rows under its unconditional hosted-domain policy. Coordinate code rollback with that limitation; do not delete personal accounts or history to restore the old constraint.
