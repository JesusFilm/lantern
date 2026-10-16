# Google setup for the Lantern operator

Prepared 15 October 2026. This is an operator guide, not evidence that Google login is configured. Your work Google account can manage this setup only if its organization/project permissions allow it. No Google password, MFA code, client secret or participant email belongs in Git or chat.

## Completed Mac setup — 16 October 2026

Dedicated `Lantern local`, `Lantern stage` and `Lantern production` clients now exist in the approved existing `jesus-film-development-bedd3` project. Do not create duplicates or reuse Forge's client. [Mac evidence](google-mac-setup-evidence.md) records exact callbacks, real local work/personal logins and outstanding hosted acceptance. Existing generic project branding and External/In production audience were retained; the new-client walkthrough below is historical preparation guidance, not a claim that this shared project is in Testing.

The Mac proof runs directly at `http://127.0.0.1:4491` with a separate PostgreSQL schema and `LOCAL_ACCESS=0`; no SSH tunnel is needed. Credentials and environment bundles are retained privately outside Git on that Mac. Do not use the VM input collector path for this Mac setup. Hosted callbacks are now the allocated Railway origins recorded in the evidence; no hosted app was deployed by this authentication task.

## 1. Check project access

Open [Google Cloud Console](https://console.cloud.google.com/) in a browser profile signed into your work account. Use the project picker at the top to inspect existing projects. Reuse a suitable Lantern project if one exists; do not modify an unrelated application's consent settings.

If no suitable project exists, use the picker’s **New Project** action with the intended work organization/location, and name it `Lantern QA`. If creation is unavailable or permission is denied, ask your organization's Cloud administrator for a suitable project and permission to manage its OAuth configuration. Do not work around an organization restriction with a personal project. Share only the non-secret project ID and any sanitized permission error with the agent. No Cloud compute service, service-account key or Gmail/Drive API is needed for Lantern's existing sign-in flow.

A single dedicated project may hold the three separate OAuth clients when its audience configuration suits all of them. If production needs an Internal consent audience while local/stage need External, use a separate production project: audience configuration is project-level. Do not switch a shared QA project to Internal and thereby exclude personal QA users.

## 2. Configure the QA consent audience

In the selected project, open **Google Auth platform → Branding** ([console](https://console.cloud.google.com/auth/branding)). If prompted, choose **Get Started**. Supply `Lantern QA` as the app name and your appropriate support/contact emails privately. Review and accept Google's terms yourself if you agree.

Choose **External** audience for local/stage so the personal QA Google accounts are eligible. Keep QA in **Testing**. In **Audience → Test users**, add the approved work lead, personal member and second ordinary QA member privately. This provider audience list is separate from Lantern's database approvals and membership roles. An Internal app would exclude accounts outside the selected Workspace organization before Lantern could evaluate them.

Under **Data Access**, use only the basic identity scopes requested by `server/google.ts`: `openid`, email and profile (Google may display the latter as `userinfo.email` and `userinfo.profile`). Do not add Gmail, Drive, Calendar or broad Workspace permissions. See [Google's consent setup guide](https://developers.google.com/workspace/guides/configure-oauth-consent) and [OpenID Connect setup](https://developers.google.com/identity/openid-connect/openid-connect).

## 3. Create or reuse three Web application clients

Open **Google Auth platform → Clients** ([console](https://console.cloud.google.com/auth/clients)). Inspect existing clients first. For each environment, choose **Create client → Web application** only if a suitable separate client does not exist.

| Client name | Authorized redirect URI |
| --- | --- |
| Lantern local | `http://127.0.0.1:4491/auth/google/callback` |
| Lantern stage | The allocated stage HTTPS origin plus `/auth/google/callback` |
| Lantern production | The allocated production HTTPS origin plus `/auth/google/callback` |

The local port 4491 was unused on the VM at preparation time; recheck before starting the isolated app. The agent will configure `APP_ORIGIN=http://127.0.0.1:4491` and an isolated local database. If your browser runs on the Mac, open a dedicated SSH tunnel before testing: `ssh -N -L 4491:127.0.0.1:4491 <your-existing-VM-SSH-alias>`. Replace the placeholder with your normal VM alias. This does not use the existing walkthrough/prototype ports.

Wait for the agent to allocate the Railway domains before creating hosted redirect URIs. Do not enter example domains or wildcard callbacks. The scheme, host, port and path must exactly match. This server-side authorization-code flow does not need browser JavaScript origins; leave that field empty unless a separate reviewed integration requires it. Each client must use its own secret and environment-specific callback, without the other environments' callbacks.

Save/download each credential privately when Google offers it. Google's current [Web OAuth instructions](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred) warn that client secrets are shown only at creation. Keep downloaded JSON in a private location outside the repository; do not paste it into this chat.

Production client preparation does not activate the app or enroll trial participants. Whether its consent audience is Internal or External, Lantern production must keep `LANTERN_ENV=production`, its approved work-domain policy and its own approval store.

## 4. Transfer private inputs and test

In your own private VM terminal, run:

```sh
/home/jacobuntu/Ops/private/lantern-railway-setup/collect-inputs.sh
```

The wizard uses hidden entry for domain, department, identities, origins, client IDs and secrets. It saves a private mode-0600 file outside Git. Stop with Ctrl-C when reaching a hosted environment whose domain/client is not ready; earlier values remain saved. Re-running keeps existing values when you press Enter. Do not paste that file into chat or source it as shell code. Tell the agent only which environment inputs are ready.

The agent will configure the isolated local app, then stage after budget and gate prerequisites are ready. You will complete the actual Google sign-in/account chooser in separate profiles for the work lead and two ordinary members. The later stage-session handoff uses hidden input directly into GitHub environment secrets; it never requires posting a cookie in chat. Real cancellation/retry, denial, sign-out and approval-revocation checks still need to be recorded against the deployed SHA.
