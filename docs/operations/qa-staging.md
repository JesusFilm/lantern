# Reset QA data in staging

The manually dispatched **Restore QA staging data** workflow creates a dedicated
`Lantern QA` department and resets only its designated participants' focus data.
It is separate from the temporary CI acceptance departments. Participants sign in
using their approved Jesus Film accounts; no test-login endpoint is provided.

A repository administrator must first configure the stage environment secrets
`QA_SHARON_EMAIL`, `QA_SUSHMA_EMAIL`, and `QA_ESTHER_EMAIL` with the
corresponding approved Jesus Film addresses. Do not commit email addresses or print
them in Actions logs. The workflow uses the existing stage migration connection,
CA and target settings. It checks the repository, main branch, dispatch event,
stage Railway project/environment IDs, the pinned staging endpoint
(`ballast.proxy.rlwy.net:56588`) and configured CA. Before resetting, it also checks
that the connected database, schema and non-elevated migration login match stage.
A staging TCP proxy rotation requires updating this pin and the release setup's
production exclusion together; changing workflow variables alone cannot retarget it.
The stage environment's access controls apply.

At least two QA participants must sign in once before the first run. Open
Actions → Restore QA staging data → Run workflow, select a registered person as
career lead, and run from main. Later runs can select **keep** or nominate a
registered person. Once the third participant has signed in, rerun to add them
as a member. The workflow does not create users or approve email addresses.

Each reset deletes the QA department's focuses and their associated review
records, then creates examples: a draft for each person and a review request
with a lead note and a confirmed example for each member. QA's Jesus Film users and
sessions remain intact. The reset also restores the shared mission statement and
the four default initiatives, including their descriptions and appearances, in
the QA department. It replaces QA changes to the mission and matching defaults;
matching initiative IDs, additional initiatives and the mission image are retained.
Other departments are not changed.

For safety it refuses ambiguous or unapproved identities, an existing career
lead from another department, a conflicting QA department, unexpected memberships,
foreign focus ownership, or outside confirmation/note/read references. A
reset locks focus roots, review requests and notes before checking their children,
so concurrent references are checked before cascading deletion. A failure rolls
the transaction back and emits a generic message without personal data. A
current member with no focuses in another department can move into QA; existing
focuses outside QA block the move and need separate review. Resolve mismatches
through an authorized staging operator; don't broaden the deletion scope or use
production credentials.
