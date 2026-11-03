# Deployed staging journey

The main CI stage job validates configuration, applies migrations and deploys the selected revision, then verifies readiness (below). With acceptance enabled, a private runner seeds four synthetic accounts: member, peer, career lead and an outsider in another department. It supplies ordinary 15-minute sessions, then uses the deployed browser and HTTP interfaces. This starts **after Google identity verification**; there is no public test-login endpoint.

The [browser runner](../../tools/release/acceptance-browser.mjs) records these twelve checkpoints in order:

| Checkpoint | What it actually does |
| --- | --- |
| `authenticated-identities` | Verify four distinct authenticated identities, their roles and department boundaries. |
| `department-direction` | Lead saves a mission and initiative; reload verifies persistence and the member sees the mission. |
| `mission-image` | Upload a synthetic PNG through the browser; save/reload and verify the converted WebP renders for lead and member. |
| `focus-authoring-persistence` | Create a focus, edit title, add/edit an initiative-aligned objective and SMART goal; reload and check browser plus API persistence. |
| `authorization-isolation` | Reject another person's direct focus reads/writes and cross-department lead access; allow the scoped lead view; reject member confirmation. |
| `stale-and-forged-writes` | Reject an old version, forged ownership and foreign Origin; verify the document is unchanged. |
| `review-requests-and-notes` | Member requests review of a saved focus; lead adds a note; member reads it; verify snapshot persistence, read acknowledgments and participant isolation. No live model is called. |
| `lead-confirmation-lock` | Lead confirms; both views show the locked document without editing controls and an API edit is rejected. |
| `coaching-disabled-manual` / `coaching-enabled-journey` | A second synthetic member creates, saves, reopens and submits a draft. With coaching off, verify inference returns 503 and manual authoring works. With coaching on, use the deployed providers for contribution questions, objective/action suggestions and a member-edited date; verify generated content persists and is submitted. |
| `account-and-guide` | Edit/reload the member's display name; open the guide and example. |
| `browser-errors` | Require no page JavaScript errors during the journey. |
| `session-revocation` | Sign out supplied sessions and verify replay cannot access focuses, including after a journey failure. |

The [fixture lifecycle](../../tools/release/acceptance-fixture.mjs) holds a database lock, recovers exactly marked abandoned fixtures, and removes only its verified synthetic graph. Unexpected relationships fail cleanup. Both journey and cleanup must pass; the [acceptance runner](../../tools/release/acceptance.mjs) checks live release identity again before writing evidence. Cancellation can leave fixtures for the next run to recover. The Actions summary reports journey and cleanup separately; it never substitutes for passing evidence.

See [Testing](testing.md) for local commands, readiness and coverage limits.
