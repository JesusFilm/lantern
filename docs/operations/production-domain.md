# Production domain cutover

Production's canonical origin is `https://ds-lantern.jesusfilm.org`.
The prior Railway hostname remains attached so existing links can redirect.
Production redirects noncanonical hosts with HTTP 308 before authentication,
static assets or request bodies are handled. Paths and query strings are retained;
HTTP methods are retained by the redirect. `/health` remains directly available on
all hosts for Railway readiness. Staging and local access do not redirect hosts.

## Coordinated rollout

1. Register the custom domain on the existing production Railway application.
   Add Railway's requested CNAME and ownership TXT records in Cloudflare,
   with proxying disabled, and wait for verified ownership and an active TLS
   certificate. Keep the old Railway domain attached.
2. Release Forge's additive `jfp_lantern_production` registration through its
   normal PR/main pipeline. Both the old and new exact callbacks must be
   registered during the transition; no scopes or client ID change.
3. Release Lantern's canonical redirect through its normal reviewed pipeline.
   Keep `APP_ORIGIN` at the existing origin until DNS, TLS and Auth are ready.
   Follow [Releasing](releasing.md), including the staging sign-in check.
4. Set the GitHub `production` environment variable `APP_ORIGIN` and the
   production Railway application's `APP_ORIGIN` to the new HTTPS origin,
   without a trailing slash. Apply the Railway setting with a deployment of
   the accepted revision, then wait for readiness. Keep the settings aligned
   before another release is admitted.
5. Verify new-origin `/health` revision, deployment and schema; verify old-host
   `/`, `/?page=week`, and `/auth/jesusfilm` return 308 to the matching new URL.
   Verify the new host does not loop and real approved-user sign-in succeeds.
   Browser cookies are host-bound: people must sign in again on the new domain.
6. Update integration callers to use the new origin directly. API clients should
   avoid forwarding credentials across hosts when following redirects. Existing
   team API tokens and saved application data remain valid.

The initial production domain inventory contains only
`lantern-production-0bd8.up.railway.app`. Keep future production aliases on the
same application to receive the canonical redirect. DNS aliases alone do not
produce HTTP redirects.

## Recovery

Before reverting `APP_ORIGIN`, verify the old Auth callback is still registered.
Restore the same previous origin in GitHub and Railway, redeploy the accepted
revision and recheck health and sign-in. Keep both domains and DNS records in
place while investigating. A 308 can be cached by clients, so some old links may
continue visiting the new domain after rollback. No database migration or data
copy is part of this domain change.
