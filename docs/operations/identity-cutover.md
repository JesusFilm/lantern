# Complete the JFP One identity cutover

Use this procedure for #136 and the subsequent #142 verification. JFP One is the
only hosted interactive authentication provider. Lantern continues issuing its
own sessions after successful JFP authentication. Google on JFP's login page is
an upstream choice, not another Lantern login mechanism.

## Prerequisites and identity evidence

Follow [Releasing](releasing.md): hold automatic production promotion before an
auth merge, deploy the checked revision/schema 11 through staging's normal
pipeline, and record the live SHA, deployment and schema. Ensure acceptance and
other account writes are idle during a cutover. Production administration stays
with its authorized human operator; use the separate administrative connection,
never the application runtime credential. The commands verify database, schema,
role and schema readiness before working.

An administrator works from the affected person's email; no prebuilt ID mapping
file is needed. Have that person attempt normal JFP sign-in first. Existing
JFP-bound accounts identify the new sign-in; when a collision is refused, Lantern
retains the provider-verified JFP subject/email for 24 hours in a private receipt.
The receipt creates no account, session, membership or authority. New eligible
sign-ins expire old receipts, and successful recovery consumes the selected one.

The administrator confirms the person's identity and intended original account,
then privately reviews the plan's name, department, role, membership state and
focus count. If multiple original accounts or JFP subjects match, the email
command refuses rather than choosing one. Email equality alone never triggers
linking or grants access. Where needed, an authorized JFP operator can establish
stronger continuity by comparing the original Google subject with JFP's stored
Google issuer/provider-account ID and associated verified human JFP user ID.
Missing or disputed evidence requires investigation, not a guessed repair.
Do not copy business content into plans or diagnostics.

## Plan and recover each account

Keep plans outside Git in a private directory. For the ordinary email-based flow:

```sh
npm run access:ops -- plan-auth-recovery-by-email qa.person@example.test /private/path/plan.json
# Privately review the original name, department, role, focus count and selected sign-in.
npm run access:ops -- apply-auth-recovery /private/path/plan.json
```

Planning is read-only, creates a new mode-600 file, and refuses to overwrite it.
The command discovers internal account IDs and the verified JFP identity itself.
It refuses a missing/expired verified sign-in, multiple possible identities or
a populated duplicate. Ask the person to retry JFP sign-in when the receipt has
expired. A changed original profile/membership/focus count also requires review
of a fresh plan. Do not ask a member to collect internal IDs.

For an independently verified explicit mapping, the advanced command remains
available. Example synthetic input (replace values using trusted records):

```json
{
  "accountId": "00000000-0000-0000-0000-000000000001",
  "expectedSubject": "original-google-subject",
  "authSubject": "verified-jfp-user-id",
  "email": "qa.person@example.test",
  "duplicateAccountId": "00000000-0000-0000-0000-000000000002"
}
```

`accountId` is the original Lantern account to retain; `expectedSubject` is its
current stored identity key. `authSubject` is the raw stable JFP subject, without
`jesusfilm:`. Omit `duplicateAccountId` when no duplicate exists. Do not substitute
a new user ID for the original or choose an account solely from its email.

```sh
chmod 600 /private/path/mapping.json
npm run access:ops -- plan-auth-recovery /private/path/mapping.json /private/path/explicit-plan.json
npm run access:ops -- apply-auth-recovery /private/path/explicit-plan.json
```

Application revalidates its target, expected binding, approved email, all other
same-email/claimed-subject accounts, and duplicate dependencies. A duplicate
must have no membership, owned focus, confirmation, authorship, acknowledgment
or other business reference. Future foreign-key dependencies also fail closed.
Sessions alone are allowed and are revoked for both accounts. Deleting the empty
duplicate and binding the original commit atomically. Original profile,
membership, documents, department scope and history are unchanged. Reapplying a
completed account plan is safe and does not revoke later fresh sessions.

A populated duplicate, third conflicting account, different existing JFP binding,
wrong target, changed mapping or persistence failure refuses the operation without
partial changes. Obtain a separately reviewed plan for populated duplicates;
do not broaden deletion, merge authorship, or move focuses between departments.
The older `link-auth` command remains available only for an unclaimed subject
with one unambiguous account; prefer the plan/apply commands for this cutover.

## Invalidate existing hosted sessions

After the verified account recoveries, review a separate whole-environment plan:

```sh
npm run access:ops -- plan-auth-session-cutover /private/path/sessions-plan.json
# Review the target and session count; this signs every current account out.
npm run access:ops -- apply-auth-session-cutover /private/path/sessions-plan.json
```

The plan contains a digest and count, never raw sessions or session hashes. If
sessions change between planning and applying, application refuses; inspect and
create a fresh plan at a new private path. Reapplying while no sessions exist is
safe. An old plan cannot revoke newly created sessions after cutover. Coordinate
this step with users so they save unsaved input first. The sessions table has no
provider provenance: selective removal of only Google-era sessions is not reliable.
Local-only and private acceptance fixtures remain available as test mechanisms;
run new acceptance after this step, not concurrently with it.

## Verify #136, then #142

Use approved QA identities and synthetic staging business data. On desktop and a
phone where available:

1. Open staging signed out and confirm it reaches JFP One before Lantern loads.
2. Sign in through JFP and verify the original account ID, name, department, role
   and existing focuses. Check Add user shows one entry, unavailable to add.
3. Verify another member/department cannot access those focuses.
4. Sign out; verify the old session cannot replay; sign in again to the same
   account, department and focuses.
5. Cancel or deliberately fail provider sign-in if available; confirm a stable
   retry screen and a successful retry. Record an unavailable cancellation path.
6. Record device/browser, exact release and results. Phone emulation is not a
   physical-device check. Local fixture sign-in is not real JFP verification.

QA keeps the issues open until verification passes. Follow the release procedure
for the manual production schema release and restoring automatic promotion.
Remove obsolete Google client configuration only with the environment owner;
never remove unrelated Google integrations or historical migration/import support.
