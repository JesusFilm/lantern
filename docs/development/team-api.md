# Team API for a separate TV app

This is Lantern's first public API. For how it relates to API-first access and
MCP, see [API and MCP](../api/README.md).

Create a token in **Account → Team API access**. The full token is shown once.
Tokens last 90 days and can be revoked there. Each token reads the issuing
member’s department only. Account approval and active membership are checked
on every request; ending membership, changing department, expiry or revocation
stops access. No role, owner or department may be supplied by a client.

Keep the token in the TV app’s server environment, for example
`LANTERN_TEAM_API_TOKEN`. Its backend should call Lantern and serve the resulting
data and images to its own browser. Browser sessions are not API tokens; no
cross-origin cookie sharing or CORS configuration is needed for this arrangement.
The token grants no editing, account or token-management access.

Production origin: `https://ds-lantern.jesusfilm.org`.
Use HTTPS for hosted deployments. The TV controller stores its token privately and
proxies the API; the TV needs access only to its local controller.

## Read team updates

`GET /api/v1/team-updates?date=YYYY-MM-DD`

```js
const response = await fetch(
  `${process.env.LANTERN_URL}/api/v1/team-updates?date=2026-11-19`,
  { headers: { Authorization: `Bearer ${process.env.LANTERN_TEAM_API_TOKEN}` } },
);
if (!response.ok) throw new Error(`Lantern returned ${response.status}`);
const team = await response.json();
```

The date is a calendar date, not a timestamp. For “today”, calculate it in the
TV’s intended timezone, currently Pacific/Auckland. The response is the
[`TeamDay`](../../shared/weekly.ts) contract:

```json
{
  "date": "2026-11-19",
  "firstDate": "2026-11-02",
  "members": [{
    "id": "member-uuid",
    "name": "Example Person",
    "githubUsername": "example",
    "goals": [{"id": "goal-id", "text": "Ship the search fix", "links": []}],
    "update": {
      "id": "update-uuid", "date": "2026-11-19",
      "body": "Search recovery is ready for review.", "planVersion": 1,
      "goalStatuses": [{"goalId": "goal-id", "status": "on-track"}],
      "createdAt": "2026-11-18T22:00:00.000Z"
    }
  }]
}
```

Only active teammates appear. An update can be `null`; goals then come from the
current weekly plan. Saved updates use their saved goal-plan version. Statuses
are `on-track`, `at-risk`, `blocked`, and `done`. Goals can also include Markdown
`description`, `completed`, and supporting links; see the shared types.
`firstDate` is the earliest update date, or `null` when there are no updates.
Polling once every 90 seconds matches the current TV prototype.

## Read a profile picture

`GET /api/v1/github-avatars/:githubUsername`

Send the same Authorization header. A successful response is `image/webp`.
Only linked GitHub handles in the token’s active department are allowed.
Pictures are cached on Lantern’s disk, so the client needs access only to
Lantern. Lantern needs internet once for an uncached picture.

Proxy this response through the TV app backend: a normal browser `<img>` cannot
attach the Authorization header. Use initials when the handle is absent or the
picture is unavailable.

## Responses and token management

All responses use `Cache-Control: no-store` (images use `private, no-store`).
Errors return `{ "error": "…" }`:

- `400`: invalid date, username or unsupported query fields.
- `401`: missing, invalid, expired or revoked token, or lost account/membership access.
- `403`: department access no longer matches during the request.
- `404`: disabled feature, unknown route or picture outside the team.
- `502`: profile picture is unavailable; keep the initials fallback.
- `503`: temporary storage/service failure; retain the last successful display.

Token management uses the normal authenticated web session and Origin checks,
not a bearer token:

- `GET /api/team-api-tokens` → `{ tokens: [{ id, name, createdAt, expiresAt }] }`
- `POST /api/team-api-tokens` with `{ "name": "Office TV" }` → metadata plus the one-time `token`.
- `DELETE /api/team-api-tokens/:id` → `204`.

Names are 1–80 characters; each member can have up to ten active tokens. Token
metadata is private to its creator. In explicitly configured local-access mode, the configured synthetic local
account can issue and use tokens without an email approval, matching local
browser access. This exception is unavailable in production.

Tokens are stored as SHA-256 digests, never
as recoverable plaintext. The `team-api` flag must be enabled for
the issuing account; it defaults to hidden in production. Migration 17 adds
the token table and restricted runtime grants; retain it when rolling back the app.
