# Set up Lantern owner API and MCP access

The `owner-api` flag covers one staging operation: list active department IDs
and names. Use the same JFP One account for Lantern browser sign-in and agent
consent. Production activation is tracked in [#270](https://github.com/JesusFilm/lantern/issues/270).

## Environment owner setup

1. Confirm the Lantern revision is deployed and JFP One is serving the Lantern
   registration from [Forge #3345](https://github.com/JesusFilm/forge/pull/3345).
   Staging uses `https://lantern-staging.up.railway.app/mcp` as the OAuth resource.
   For a local reproduction with real JFP One, use the registered
   `http://localhost:4391/mcp` and set `APP_ORIGIN=http://localhost:4391`.
2. With authorization to configure the environment, add `owner-api=on` to the
   webapp's `LANTERN_FEATURES`, keeping its other entries. Set
   `LANTERN_ADMIN_API_OWNER_EMAILS` privately to the exact verified email
   addresses of its owners, comma-separated. Lantern trims and lowercases each
   entry. Deployment preflight checks the list when the staging flag is enabled.
   An empty list grants nobody access. Leave
   `LANTERN_FLAG_OWNER_EMAIL` for the separate browser flag report.
3. Link both test accounts in Lantern. If an account is new, approve its exact
   email in staging using the normal `access:ops approve-email` operator
   procedure, then have the person complete one successful JFP One browser
   sign-in on staging. An account that already signed in through JFP One is
   linked. The API uses that stored link and the owner list on every call.
   Active membership and continuing browser approval are unnecessary for the
   owner read. Use only synthetic staging data.
4. For a staging settings change, follow the
   [release procedure](../operations/releasing.md#normal-automatic-release) and
   [feature flag procedure](../development/feature-flags.md#change-a-features-state)
   for fresh deployment evidence.

## Sign in with Codex on a Mac

Run Codex and open the authorization link on the Mac. Add the server to your
local Codex configuration (`~/.codex/config.toml`).

```toml
[mcp_servers.lantern-staging]
url = "https://lantern-staging.up.railway.app/mcp"
scopes = ["lantern:admin"]
```

Run `codex mcp login lantern-staging --oauth-client-registration dcr`. In the
browser, choose the linked owner account, review the consent for Lantern and
approve **Administer Lantern**. The browser returns to Codex on the Mac. Start a
fresh local Codex session, then ask it to call Lantern's `departments.list` tool.
The result contains only each active department's ID and name. See
[Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

To test denial, run `codex mcp logout lantern-staging` and use a separate browser
profile or Google session to sign in and consent with the second linked account.
Keep that account out of `LANTERN_ADMIN_API_OWNER_EMAILS`. Start a fresh Codex
session and check that Lantern refuses access without listing tools or returning
department data. Record both revisions, Mac/browser details, consent outcomes and
the result or HTTP status for both accounts. Report the returned fields and
absence of archived departments without copying IDs, names, account details,
tokens, cookies or callback URLs into the evidence. VM-over-SSH login is a
follow-up.

For a REST client, use an OAuth client authorized through JFP One for the same
resource and scope, and send its access token in the `Authorization: Bearer`
header to `GET /api/v1/departments`. See the [response contract](README.md#owner-department-list).

## Troubleshoot

| Symptom | What to check |
| --- | --- |
| `404` from MCP, REST or discovery | Confirm the deployed revision, canonical origin and that the environment owner enabled `owner-api`. A preview restricts access to accounts also in `LANTERN_PREVIEW_EMAILS`. |
| `401` with a `WWW-Authenticate` challenge | Sign in again. Verify JFP One is serving the Forge registration and that the OAuth request targets the exact Lantern MCP URL for this environment. |
| Consent never opens or JFP One refuses the request | Check the Forge deployment and dynamic client registration. Confirm Codex is running on the Mac and launching authorization in a browser there. |
| `403` for insufficient scope | Reconnect and consent to `lantern:admin`. |
| `403` for owner access after consent | Confirm the browser sign-in linked the same JFP One subject, then check the exact account email against this environment's owner list. If another account shares the normalized email, or an active recovery receipt records a competing verified subject for it, follow the [identity recovery procedure](../operations/identity-cutover.md). |
