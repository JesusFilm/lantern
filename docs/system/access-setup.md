# Current access implementation and setup

This describes delivered ticket 06, before the next trial admission changes. [M06/01](../../.scratch/team-trial/issues/01-approved-access.md) will add exact database-approved Google emails; that gate is not implemented yet. [M06/05](../../.scratch/team-trial/issues/05-railway-environments.md) owns hosted configuration and [M06/06](../../.scratch/team-trial/issues/06-stage-verification.md) owns live acceptance. Do not invite trial users until those checks are complete.

Ticket 06 adds Google work-account registration, persistent browser sessions and server-authorized department membership. Actual domains, account identities, client credentials and hosting configuration must be supplied by the operator; none are seeded. The automated tests use synthetic identities in a temporary database schema. No HTTP test-identity route is included. The explicit LOCAL_ACCESS walkthrough uses one local account, requires a loopback bind and is prohibited in production; it is not a hosted QA authentication path.

## First setup

Use Node 22.12 or newer, PostgreSQL, and the normal `.env` setup in the README. The server and operations command apply the additive schema on startup. The application's database role needs schema/table creation permission for this beta. Back up an existing database before applying releases.

1. In Google Cloud, configure a Web application OAuth client and consent screen for the intended work-account audience. Set its authorized redirect URI to the exact public origin followed by `/auth/google/callback`.
2. Set `APP_ORIGIN`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the server's private environment. `APP_ORIGIN` has no trailing slash or path. Hosted origins require HTTPS; local development allows HTTP on `127.0.0.1` or `localhost`. Keep proxy traffic on the same public origin and forward cookies. The app does not derive callback URLs or authorization from forwarded headers. Missing both credentials leaves a configuration message; partially supplied credentials stop startup.
3. Configure the complete approved **Google hosted-domain** allowlist (the verified `hd` claim, not merely the email suffix):

   ```sh
   npm run access:ops -- domains "$APPROVED_DOMAIN"
   ```

   Supply additional domains as separate arguments. The command replaces the list atomically. Removing a domain ends its users' app access on the next request, including existing sessions. It refuses to exclude an active career lead's domain.
4. Start the app with `npm run dev`, or `npm run build` followed by `npm start`. Have the intended career lead sign in once. They initially see the waiting screen, creating their ordinary account without approval.
5. Create the department and assign that registered account:

   ```sh
   npm run access:ops -- setup "$DEPARTMENT_NAME" "$REGISTERED_LEAD_EMAIL"
   ```

   Use the operator-confirmed engineering name and career-lead email. This operation requires exactly one eligible registered account matching that email. Identity is subsequently tied to Google's stable subject identifier, not the mutable email address. Running setup again with the same values is harmless. A second department, changing the lead or restoring a deleted department is refused.
6. The lead clicks **Check access** or refreshes. Other eligible people sign in and contact their career lead directly. The lead uses **Department users → Add user**, searches or browses, selects the registered person, and adds them. No free-text invitation, join request or approval queue exists.

The Google implementation follows [Google's OpenID Connect server flow](https://developers.google.com/identity/openid-connect/openid-connect) and [backend token validation guidance](https://developers.google.com/identity/sign-in/web/backend-auth). It uses authorization code + PKCE, a browser-bound single-use state, nonce, and the official library's signature/audience/issuer/expiry checks. An approved hosted domain and verified email are required. Tokens from Google are not retained. Seven-day opaque session cookies are HttpOnly/SameSite=Lax and additionally Secure with the `__Host-` prefix on HTTPS; the database stores only their hashes. Mutating browser API requests require the configured Origin.

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

Tests exercise real PostgreSQL and HTTP, plus Chromium using synthetic identities at the external provider boundary. A separate adapter test validates locally signed tokens through the real Google verification library, including rejection of signature, issuer, audience, expiry, nonce and work-account failures. Browser coverage includes registration/waiting, searchable assignment, unavailable states, session persistence, removal and sign-out. Synthetic other-department membership exists only in the isolated test schema, which is removed afterward. Screenshots in `captures/access-members*.png` contain only synthetic people. Run tests against a local/test database whose role can create temporary schemas.

Before accepting live Google integration, a human must:

- Supply/confirm the real approved domains, career-lead account, Google Web OAuth credentials and callback/hosting origin outside Git.
- Sign in with an eligible Google work account through the actual Google consent/account chooser; confirm an ineligible/personal account is refused and cancel/retry works.
- With separate lead/member browser sessions, check the waiting text, search and select the registered member, then confirm department access after **Check access** and after reopening.
- Review desktop/mobile wording and selection usability. As operator, remove a disposable test member, confirm an already-open member session cannot fetch department data and refreshes to waiting, then confirm sign-out. Removal is intentionally not reversible in beta; choose a disposable account.

Jaco subsequently authorized tickets 07–08 and automated/preparation work for 09, deferring live Google and practical human verification to final review. The [current application verification record](guide-verification.md) replaces the old guide-only checklist. M01 is closed against the revised local baseline; live access checks remain unperformed in M06. The original standalone guide preview was consolidated into the retained prototype viewer.
