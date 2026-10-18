# Agent-assisted production operations

Jaco authorizes and executes production commands. Agents are responsible for
preparing usable instructions and supporting him through verification and recovery.
He is not expected to write SQL, infer missing parameters, or diagnose database
errors alone. This procedure does not authorize a release or production access.

## Prepare a reviewable operation

Before asking Jaco to execute anything, the agent must:

1. Establish the intended outcome and authorized scope. Identify missing information
   using precise questions that can be answered without credentials, identities or
   conversation content. Explain any uncertainty that prevents safe preparation.
2. Produce a versioned repository script or exact runner command. Explain its effect,
   required role, target checks, inputs, expected affected-row counts, abort conditions,
   transaction boundaries and verification in plain language. Sensitive inputs use
   placeholders or private interactive input, not values embedded in Git or chat.
   Instructions must identify where Jaco enters them privately and which output stays
   private. Do not rely on him to translate a conceptual plan into SQL.
3. Rehearse the operation, failure paths and recovery with synthetic local data, or
   staging when separately authorized. Preserve relevant test evidence. Follow the current backup decision: no staging backups; production backups deferred
   until dogfooding is complete and value determined. Do not add a backup gate during
   this period. Rehearse transactional failure/forward-correction paths and state
   the limits of data recovery without backups. If backups are later authorized,
   verify their actual prerequisites rather than merely advising “take a backup.” State which
   production prerequisites still require Jaco's private inspection.
4. Prepare the sanitized planned change record required by AGENTS.md, with the script
   version/digest, intended effect, executor and recovery plan. For a release/migration,
   also follow the release-specific records and gates. A PR reviews/version-controls
   the preparation; merging it neither executes nor authorizes production work.
5. Present a short execution checklist: each command, what success looks like, what
   sanitized result to report, and where to stop. If any command or recovery step is
   still hypothetical or untested, state that explicitly and resolve it before routine
   execution. Choose a human-run wizard when it materially reduces input or sequencing
   mistakes; it must preserve these checks and never send production data to an agent.

Preparation is complete only when the operator has an executable, tested procedure
and can identify success, failure and the next safe step without inventing SQL.
Keep production inactive until the separately required activation gates are met.

## Guide human execution

Work one checkpoint at a time. Explain the next action and its expected outcome;
Jaco checks the private target and runs it himself using the designated role.
Ask only for the agreed sanitized result, such as “target matched,” affected-row
count, exit status, or an allowlisted error code. Do not request screenshots, raw
logs, query results, connection strings or personnel information from production.
Count output may be shared only when it contains no person-linked identifiers or
content; otherwise use a pass/fail report against the expected count.

Wait for Jaco's report before moving to a dependent step. Attribute production
observations to him; local rehearsal does not establish a production result.
If support continues in a later chat, preserve the script version, last confirmed
checkpoint, pending checks and sanitized state so the operator can resume safely.

## Handle an unexpected result

Stop at the documented boundary. Do not ask Jaco to improvise SQL or blindly rerun
a possibly committed operation. Determine from sanitized status whether it committed,
rolled back, or has an unknown outcome. With an unknown outcome, prepare a narrow
human-run verification before choosing a retry or recovery.

Explain the next diagnostic in plain language and prepare any required read-only
command with a sanitized result contract. Reproduce the failure synthetically where
possible. Revise and retest scripts before proposing further writes. Use the rehearsed
recovery procedure when its preconditions match; otherwise state the gap and prepare
one. Never broaden agent access to production to resolve the problem. Existing
emergency authority remains Jaco's decision under AGENTS.md, not an agent exception.

## Close the operation

Help Jaco complete post-change verification, check the intended user-visible behavior,
and review access changes. Remind him to close task-specific sessions and actually
remove temporary credentials/grants; session closure alone does not revoke access.
Update the sanitized record to applied or failed only from his report, including
verification, recovery and cleanup. Keep unknown or unfinished checks explicit.

Completion means the intended outcome and cleanup are reported verified, or the
operation is recorded as failed/stopped with its known state and recovery steps.
Generating a script or handing over a runbook alone is not completion of an authorized
production assistance task. No production operation is scheduled by this document.
