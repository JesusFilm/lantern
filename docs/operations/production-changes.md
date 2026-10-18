# Production changes

No production operation is scheduled or recorded as executed by this local
privilege-separation change. Local synthetic tests are not production evidence.

Before each routine production administrative operation, Jaco reviews the script
and a sanitized **planned** entry, even without a PR. Preparation is not execution
authorization. Agents never access production. Retain this sanitized history for
the repository's lifetime, including archival; correct entries transparently.

Use the [operator assistance procedure](production-operator-assistance.md) to prepare and guide execution. Copy these fields for a specific authorized handoff:

- Status: planned / applied / failed
- Sanitized reason and intended environment
- Exact script version or digest and planned executor (Jaco)
- Expected effect and affected-row counts; target checks and abort conditions
- Verification and recovery plan, including backups where relevant
- Execution date and outcome (only from Jaco's sanitized report)
- Reported verification and any recovery action
- Reported console closure and removal of temporary credentials/grants
- Reported access review and any required revocation/rotation

Exclude identities, emails, person-linked IDs, conversation content, credentials,
and sensitive SQL values. Keep any necessary private supplementary record outside
Git and agent context. Do not request sensitive production output as evidence.
This is a procedural record, not an authenticated or tamper-proof audit service.

Routine work waits if a planned entry cannot be prepared. Only Jaco can invoke the
policy's emergency deferred-recording exception for active exposure, imminent data
loss or an outage that cannot reasonably wait. Complete the sanitized record,
verification and access cleanup afterward; the exception never grants agents
production access. Do not submit an organizational Changelog automatically.
