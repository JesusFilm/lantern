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
The person supporting members' development who can read their focuses and confirm an agreed baseline after review. The supported setup has one active career lead per department; this is an application role, not a database administrator.

**Approved account**:
A verified Jesus Film account whose exact normalized email is approved in the environment’s database. All environments admit approved personal and work accounts without a domain restriction. Approval permits eligible sign-in; membership and career-lead authority are separate grants. Jesus Film sign-in creates the account; approval alone creates neither an account nor a membership.

**Department**:
The team boundary within which membership and position focuses belong. An account has at most one department membership. Setup currently supports one department; transfer and rejoining workflows are unsupported. Ending membership preserves its history and department-scoped focuses.

**Beneficiary**:
A person or group whose needs a member's contribution serves, including colleagues within the team.
_Avoid_: User when it could be confused with an application account.

## API access

See [API and MCP](docs/api/README.md) for the direction and the [operation inventory](docs/api/inventory.md) for current status.

**API-first**:
The direction that each data operation is built once and, in time, becomes reachable through the public API as well as the interface, so Lantern can be managed headlessly. Operations gain API or MCP paths gradually, as needs arise.

**Internal route**:
An unversioned `/api/...` route that serves only Lantern's browser app through the signed-in session.

**Public API**:
Lantern's versioned `/api/v1` routes for callers other than its browser app. Each route accepts a specific credential.
_Avoid_: Calling internal routes the API.

**JFP One access token**:
A planned credential that JFP One issues to an app or agent acting for a signed-in person, valid only for Lantern's API and the scopes the person approved. It proves identity and consent; Lantern decides the person's authority.

**MCP access**:
Planned access to selected operations through Lantern's MCP server. Each connection acts for one signed-in person through a JFP One access token, within that person's Lantern authority and agent access.

**Agent access**:
A planned per-person setting, granted and revoked by an owner, for which actions a person's agents and apps may take with a JFP One access token. It defaults to none and never exceeds the person's own Lantern authority; administration can be granted only to owners.

**Team API token**:
Lantern's integration credential for an unattended server, such as the office TV: a named, expiring and revocable bearer token for reading one department’s team updates and cached profile pictures. It belongs to its creator and original department, depends on active approved membership, and grants no editing or account-management authority.

## Position focuses

**Position focus**:
A titled, dated document describing a member's intended contributions through objectives and SMART goals, with optional personal-development and leadership objectives.

**Draft position focus**:
A focus still open to its member's edits and discussion with the career lead. It may be incomplete.

**Confirmed position focus**:
A focus confirmed as the agreed, locked baseline. Confirmation records agreement, not achievement. See the [review and confirmation rules](docs/rules/review-and-confirmation.md).
_Avoid_: Submitted, approved by management, or complete when those imply additional workflow stages.

**Locked-in position focus**:
The historical term for a confirmed position focus. Later review work preserves this baseline rather than silently rewriting it.

**Review request**:
A focus owner’s explicit request to review one immutable saved version of their focus. See the [review and confirmation rules](docs/rules/review-and-confirmation.md).

**Coaching checkpoint**:
Private answers and writing retained from the earlier coaching experience. The current UI has no Earlier working notes interface and creates no new checkpoints. Career leads cannot read another member's notes; manual saves retain them, and confirmation removes them.

**Review note**:
An authored message attached to a requested version. Notes can be added or soft-deleted by their author, never edited. A note is not confirmation.

**Focus progress**:
A member's current status and editable note about an objective or SMART goal in a confirmed focus. It is separate from the agreed focus and from review notes; a career lead may read it.

**Review phase**:
A stage in the focus cycle. The [cycle rules](docs/rules/review-and-confirmation.md) describe the stages and renewal.

**Mid-cycle change**:
A possible change to agreed objectives or goals before the cycle ends. The [mid-cycle decision](docs/rules/review-and-confirmation.md#rc-d1-changing-a-confirmed-focus-mid-cycle) is deferred.

**Objective**:
An intended contribution or outcome that gives direction to a member's work or development.

**Contribution objective**:
An objective for the member’s contribution in their position. At least one Contribution objective with at least one SMART goal is required to request review or confirm; empty, partial and development-only drafts remain saveable. `normal` is the internal storage name, never a user-facing label. Earlier planning called this a critical mission objective.

**Personal-development objective**:
An optional objective for the member's own growth through learning, practice and feedback. It may extend beyond immediate work tasks, but happens in work time and should support career development. Personal does not mean private: the career lead sees and agrees it with the rest of the focus. See [RC-16](docs/rules/review-and-confirmation.md#rc-16-development-objectives-are-shared-and-agreed-with-the-whole-focus).

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

## Weekly planning

**Weekly goal**:
A member's short-term aim for a Monday–Sunday week. Weekly goals are separate from the SMART goals in a position focus. Saving a changed weekly plan retains its earlier versions. A weekly goal keeps its identity when edited and can carry optional links to a position focus or external work.

**Linked work**:
Optional context attached to a weekly goal: a saved position focus, project, repository, issue or other named web link. Saving a link does not change completion state or grant access to its target.

**Daily update**:
A dated record of progress, changed expectations or requests for help within a planned week. It refers to the plan version current when saved. Corrections retain internal revisions, while the UI shows one latest update per date. The author edits their own week; the flagged My team view lets active department members read their active teammates’ dated snapshots.

## Guidance and context

**Guide**:
Optional instruction supporting objective and SMART-goal writing and the Position Focus procedure, separate from focus authoring. The Procedures topic contains The year and Agree a focus; the agreed two-cycle rhythm does not itself enable scheduling, automatic carryover or amendment operations.

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
