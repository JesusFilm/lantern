# Lantern — starting product requirements

Status: discovery draft. The user authorized a local TypeScript/React/PostgreSQL foundation and database health check on 13 October 2026. Product workflows remain candidates for later prototypes and specification.

## Problem

Engineers are working, but their understanding of their role may be unclear: where work comes from, what they are working towards, who they serve, and how it connects to their development. Conversations uncover that understanding; a coherent record makes it possible to revisit and act on it.

## Users

- Engineers describe their role, clarify goals, contribute observations, and revisit their development record.
- The career lead guides conversations, understands each person's position focus, and follows their development.
- The engineering manager, delivery lead, and other specifically selected recipients receive read-only summaries of relevant insights.

## Intended benefit

A shared, evolving understanding of each person's role and development gives engineers clearer direction and helps the career lead provide informed support and communicate progress. The software supports human conversations and judgement; it does not supply leadership experience or decide people's development for them.

## Starting workflow

1. Small catch-ups capture what each engineer believes their job is, where work originates, intended outcomes, users, and uncertainties.
2. The career lead requests a position focus. Clear instructions, examples, and supporting training material help engineers submit it and return to view it.
3. Ongoing discussions revisit or edit the position focus throughout the year. Dated snapshots preserve its evolution. Conversation records may include manual observations, engineer contributions, transcripts, and recorded audio where available; the exact capture mechanism is undecided.
4. The career lead collates insights about development, goals, and growth and selects read-only summaries to share with specific recipients through email or Slack. Whether these contain text, files, or access-controlled links is undecided.

## Working scope

The user prefers a team-managed system with career-lead oversight. Personal private-note management is outside the current product direction. “Team-managed” does not yet settle whether engineers can view one another's records; exact permissions and visibility remain open.

Multiple logins, central feedback requests and responses, dashboards, and future hosting are candidate capabilities. A decision supported by an insight must be identified before choosing reporting or AI features.

## Authorized foundation

- Local Git repository; no GitHub repository or remote yet. An official organization upstream may follow later.
- TypeScript, React, and a server connecting to PostgreSQL.
- GET `/health` performs a fresh `SELECT 1` through the web server. Successful query: HTTP 200. Database failure: HTTP 503 with a generic response.
- A plain React page shows the health result. No styling or product screens yet.
- Local isolated PostgreSQL; no personnel records, private tracker migration, invitations, feedback collection, or deployment in this increment.

## Evidence of success to validate

- A catch-up can lead to a position focus and a concrete next step.
- Engineers can revisit their submissions and understand who can see their information.
- The career lead can use dated records to discuss change and prepare an appropriate summary.
- The workflow's administrative burden is workable.

## Next discovery decisions

Position-focus content and agreement lifecycle; exact access and summary-sharing rules; editing and snapshot rules; recording/transcript expectations; feedback attribution; retention, deletion and recovery; hosting and operations ownership; the first useful reporting decisions; and MVP boundaries with acceptance examples.
