# Lantern

Lantern helps team members prepare a position focus and agree it with their career lead. The product centers on a useful conversation supported by a clear, persistent document.

## Product behavior

- Members create and edit their own titled, dated focuses with objectives and SMART goals. Empty and partial drafts are valid. Objectives can include Personal Development and Leadership types.
- Separate guides explain objectives and SMART goals, with a worked example. Focuses open in a compact reading view and are edited through dialogs.
- Career leads browse current department members and their focuses. After discussion, the lead confirms and locks a focus. Confirmation records who confirmed it and when; the title, dates, objectives and goals become read-only for both people.
- Account display names persist. Career leads can add eligible registered users to their department. Rejoining former members is not currently supported.

## Access and data

Hosted access uses Google sign-in and server-issued sessions. Admission requires an exact approved email, with no domain restriction in any environment. Active department membership and server-assigned roles determine access. Members cannot read another member's focuses; career leads can read and confirm focuses within their department, but cannot edit another member's draft.

PostgreSQL stores account, membership and focus data. Saves detect concurrent edits. Ending membership removes access while preserving department-scoped history. Local access is explicitly configured and disabled by default.

## Delivery and scope

Staging should receive application and schema changes automatically after a PR merges to main. Production releases are manually initiated for a selected full main commit SHA, with migrations and the application deployed from that same revision. Deployment commands and configuration belong in the repository's executable release tooling and README.

Current work prioritizes reliable delivery and a usable hosted product. New product scope is chosen directly by the owner. Later review cycles, unlocking or copying confirmed focuses, notifications, dashboards, and broader administration need a separate product decision before implementation.
