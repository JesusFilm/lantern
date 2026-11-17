# Lantern

Language for the member position-focus workflow. This glossary distinguishes the agreed product model from delivered capability; see the [PRD](docs/PRD.md) for delivery status.

## People and access

**Owner**:
A person entrusted to oversee Lantern in an environment. The current configured
owner can inspect feature-flag states. The planned administration API extends this
to a list of owners who can set up departments; owner authority alone does not
grant access to position focuses. An owner may separately be a career lead.

**Member**:
An approved participant with active membership of the team who prepares and manages their own position focuses.

**Career lead**:
The person supporting members' development who can read their focuses and confirm an agreed baseline after discussion. The supported setup has one active career lead per department; this is an application role, not a database administrator.

**Approved account**:
A verified Jesus Film account whose exact normalized email is approved in the environment’s database. All environments admit approved personal and work accounts without a domain restriction. Approval permits eligible sign-in; membership and career-lead authority are separate grants. Jesus Film sign-in creates the account; approval alone creates neither an account nor a membership.

**Department**:
The team boundary within which membership and position focuses belong. An account has at most one department membership. Setup currently supports one department; transfer and rejoining workflows are unsupported. Ending membership preserves its history and department-scoped focuses.

**Beneficiary**:
A person or group whose needs a member's contribution serves, including colleagues within the team.
_Avoid_: User when it could be confused with an application account.

## Position focuses

**Position focus**:
A titled, dated document describing a member's intended contributions through objectives and SMART goals, with optional personal-development and leadership objectives.

**Draft position focus**:
A focus still open to its member's edits and discussion with the career lead. It may be incomplete.

**Confirmed position focus**:
A focus the career lead has confirmed after review and agreement of its current requested saved version, establishing a baseline whose content and review discussion are locked. A career lead may request review of their own focus and self-confirm it; discussion with a senior or manager is optional, with no mandatory second reviewer, note or wait. Offline agreement still requires the request and confirmation steps in Lantern. Previously confirmed focuses remain valid without retrospective requests. Confirmation means agreement, not that the goals have been achieved.
_Avoid_: Submitted, approved by management, or complete when those imply additional workflow stages.

**Locked-in position focus**:
The historical term for a confirmed position focus. Later review work preserves this baseline rather than silently rewriting it.

**Review request**:
A focus owner’s explicit request to review one immutable saved version of their focus. It is required before confirmation, including for a career lead’s own focus, and does not itself lock or confirm anything. A lead’s own request appears in their Review requests list for self-review. A later save does not replace the snapshot; the owner must send the latest changes before confirmation. A request note is optional.

**Coaching checkpoint**:
Private answers and writing retained from the earlier coaching experience. The current authoring UI retains these without exposing an Earlier working notes interface and creates no new checkpoints. Career leads cannot read another member's notes; manual saves retain them, and confirmation removes them.

**Review note**:
An authored message attached to a requested version. Notes can be added or soft-deleted by their author, never edited. A note is not confirmation.

**Focus progress**:
A member's current status and editable note about an objective or SMART goal in a confirmed focus. It is separate from the agreed focus and from review notes; a career lead may read it.

**Review phase**:
A stage within each of two full cycles per year: preparation, review request and confirmation; a mid-cycle progress check-in; and an end-cycle review. End-cycle renewal deliberately creates a new position focus with carryovers and/or new objectives and goals, preserving the previous baseline. It does not amend the previous cycle’s focus. Scheduling, automatic carryover and cycle tooling are not provided.

**Mid-cycle change**:
A possible change to agreed objectives or goals before the cycle ends. Amendment versus a new focus and accidental-lock recovery remain undecided in [#169](https://github.com/JesusFilm/lantern/issues/169), to revisit only after all members’ first submissions during December 2026–January 2027. Confirmed content cannot currently be edited or unlocked, including by career leads; unlocking is not an approved future feature.

**Objective**:
An intended contribution or outcome that gives direction to a member's work or development.

**Contribution objective**:
An objective for the member’s contribution in their position. At least one Contribution objective with at least one SMART goal is required to request review or confirm; empty, partial and development-only drafts remain saveable. `normal` is the internal storage name, never a user-facing label. Earlier planning called this a critical mission objective.

**Personal-development objective**:
An optional objective for a capability or behavior the member wants to grow, paired with goals for applying it.

**Leadership objective**:
An optional objective for developing leadership through a practical assignment, paired with goals for its outcomes.

**Discovery objective**:
An objective explicitly focused on finding out an unknown need or useful direction. It states the uncertainty honestly and does not imply that research, access or another person’s participation has already been agreed.

**Member role type**:
A planned description of a member’s profession or work, such as engineer, QA, evangelist, lector or trainer. It provides coaching context and grants no permissions. Account configuration is tracked in [#102](https://github.com/JesusFilm/lantern/issues/102); currently members describe their work to the coach.

**SMART goal**:
A specific, measurable, achievable, relevant and time-bound goal supporting an objective. These qualities do not require five separate written fields or universal numerical targets.

**Contribution**:
Work towards useful outcomes, including product work, shared capabilities and activities supporting team connection.

## Guidance and context

**Guide**:
Optional instruction supporting objective and SMART-goal writing and the Position Focus procedure, separate from focus authoring. The Procedures topic contains The year, Agree a focus, and Make a change; the agreed two-cycle rhythm does not itself enable scheduling, automatic carryover or amendment operations.

**Example position focus**:
A concise generic illustration of one objective and two goals. Its targets do not impose requirements on a member's own focus.

**Organizational mission**:
“We partner with the Body of Christ through heart language media, so everyone, everywhere can encounter Jesus.”
The career lead configures the wording shown to their department in Lantern. The
configured mission remains visible on Position Focuses, outside the objective
editor. Configuration is department-scoped; it does not confer
organization-wide administrative permissions. Its optional **mission artwork** is a
department-scoped image chosen by the career lead; it provides visual context and
does not replace the mission statement. An empty mission hides both text and artwork.

**Strategic initiative**:
A named team priority configured by the career lead. An objective can support
several active initiatives. Archiving removes an initiative from new choices
without deleting existing objective references.
Its optional **initiative identity** is a color and SVG icon that help people
recognize it across the list, guide and objective choices. Its optional **initiative description**
is a short explanation of its purpose, shown as current guidance in the Guide.
Descriptions are not saved into objective history. Identity does not replace the
name or indicate status. Saved objectives retain the identity recorded when saved.

**Other (initiative alignment)**:
An explicit statement that none of the listed initiatives applies to an objective.
It is a valid choice without a required explanation, and cannot accompany named
initiatives. An empty selection instead means that alignment has not been chosen yet.

**Department contribution**:
The team's intended contribution to the organizational mission. It is context for conversations, not a required app field or customization feature.
