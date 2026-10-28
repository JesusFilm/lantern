# Coaching providers and rollout

The accepted goal coach uses Qwen first and OpenRouter as fallback. Review, notes
and manual focus editing work without a model. Project/repository retrieval and
email notifications remain separate work.

## Railway variables

Set these on the **Lantern web service**, independently in staging and production.
There are four secret values in total: one dedicated LiteLLM virtual key and one
OpenRouter key per environment. Do not share developer coding keys or reuse the
staging keys in production. Do not put these values in chat, Git, browser variables,
release artifacts or command arguments.

| Variable | Staging | Production |
| --- | --- | --- |
| `AI_GATEWAY_CHAT_API_KEY` | Dedicated Lantern staging virtual key | Dedicated Lantern production virtual key |
| `OPENROUTER_API_KEY` | Dedicated Lantern staging key | Dedicated Lantern production key |
| `AI_GATEWAY_CHAT_BASE_URL` | `https://gateway.example.com` | Same endpoint |
| `AI_GATEWAY_CHAT_MODEL` | `coding` | `coding` |
| `COACH_FALLBACK_MODEL` | `google/gemini-3.8-flash` | Same model |
| `COACH_ENABLED` | `1` after both keys are installed | `1` after staging verification |

The gateway URL above is illustrative; replace it with the actual endpoint in
Railway. There is no application default. The gateway authenticates requests
using the dedicated virtual key; no Tailscale connection is required. Verify
provider connectivity from staging before activation.

The gateway URL is the origin before `/v1/messages`, not a URL ending in `/v1`.
The implementation retains the Anthropic-compatible gateway protocol already used
by the working prototype. OpenRouter uses `/api/v1/chat/completions`. The fallback
model identifier is listed by [OpenRouter](https://openrouter.ai/google/gemini-3.8-flash).
Both model names are configurable without changing code. Only server code sees keys.
Provider settings must be HTTPS and must not embed credentials.

Create model-scoped LiteLLM keys for `coding`. Set separate rate/spend limits for
both environments at each provider; use an appropriate funded OpenRouter key.
Set OpenRouter's permitted models/provider data policy for the organization's
requirements before real personnel data is used. The application sends current
member coaching fields, department mission/active initiatives and the writing
Guide to either provider. It does not send review notes, other members' documents,
images, account email addresses or external project context. Provider-side logging
and retention are controlled in the provider account, not by Lantern.

Use Railway's variable editor or a secret-prompt/standard-input workflow. Stage
variable changes without an automatic deployment while setting up both keys.
The release configuration check and startup reject enabled coaching with either
key or the gateway URL missing; they do not prove provider connectivity. Existing
release tooling preserves unrelated Railway variables rather than replacing the
complete set.

## Verification before activation

1. Run the normal typecheck, production build and complete local suite. Provider
   tests use real HTTP fixture servers and exercise success, failure, timeout,
   bad output, fallback, cancellation and credential isolation without paid calls.
2. Follow [Releasing](releasing.md) for schema 9. This is an additive migration;
   apply it before replacing the app. The database confirmation guard also protects
   older instances during rollout. Do not reverse the migration or drop review data.
3. On staging, check both dedicated credentials with synthetic work. Exercise a
   normal Qwen turn, then a deliberately unavailable **staging-only** primary URL
   and verify an OpenRouter reply. Restore the primary URL and verify Qwen recovery.
   This is a connectivity/failover check, not a coaching-quality benchmark.
4. Run staging readiness and authenticated acceptance for the exact release. The
   review-request/notes journey uses no live model and cleans up its synthetic data.
5. Use the authorized human production release process after installing production
   keys. Verify readiness and check provider outcome logs during ordinary use.

Hosted connectivity, provider account limits and real-device interaction are not
established by local fixture tests. Never treat successful configuration parsing
as a successful live fallback call.

## Failure behavior and operations

Each turn allows one primary attempt and one fallback attempt, each capped at
25 seconds and 2,200 output tokens. HTTP failures (including rejected credentials
and rate limits), network errors, truncated/oversized replies and invalid structured
output trigger fallback. A failed primary cools down for 60 seconds; only one
recovery probe runs after cooldown. A disconnected/cancelled member request aborts
inference and never starts fallback. Cancellation does not guarantee the provider
has stopped billing for computation already begun.

Admission is bounded per app instance: four active turns, one per member, and
20 turns per member per minute. Provider key budgets remain the cross-instance
cost/rate boundary. Adjust that boundary before scaling out or changing traffic
assumptions. No retry loop, unbounded queue or model-controlled tool execution exists.

Logs contain provider (`primary`/`fallback`), outcome and elapsed time only. They
omit credentials, prompts, replies, user IDs and raw provider errors. Persistent
fallback outcomes indicate a primary outage; failures on both providers call for
checking key validity, quota and reachability. The UI retains input and offers
retry or manual writing. `/health` tests application/database readiness, not model
availability; do not take the whole application down because a model is offline.

Set `COACH_ENABLED=0` and redeploy to stop model calls while keeping saved focuses,
review requests and notes available. Prefer this or a compatible fix-forward over
rolling back feature code. Keep schema 9 and its confirmation guard in place even
if an older compatible application is temporarily restored. Rotate compromised
keys in the corresponding environment and restart/redeploy to load them.

## Data lifecycle

A coached save commits the entire focus and its owner-only checkpoint together,
using the source version. Normal editor saves invalidate an old checkpoint;
confirmation removes it. Unsaved browser input is not durably stored. Confirmation
locks the focus; it never asks the model to approve it.

Requests are immutable full-document snapshots, unique per focus version. Sending
changes is explicit. Notes are append-only, reference their request, and can only
be soft-deleted by their author; deleted bodies are not returned to clients. Read
markers acknowledge only the note IDs actually displayed. Ending membership blocks
access and preserves history. No automatic deletion/retention job is introduced.
