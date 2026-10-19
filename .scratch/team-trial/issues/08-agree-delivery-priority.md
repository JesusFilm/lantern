Kind: ticket
ID: team-trial/08
Title: Agree hosted-trial priority, admission policy and release gates
Milestone: M06
Type: grilling
Labels: wayfinder:grilling
Status: resolved
Blocked by: None
Assignee: Codex
Slice: Hosted team trial planning

---
## Superseding release decision — 19 October 2026

Jaco approved CI plus manual staging acceptance and a human-run release for the
trial. Automatic delivery, session-secret maintenance, automated evidence artifacts
and promotion-gate drills are deferred under 15. The earlier automated-delivery
decision below is historical; identity and product scope are unchanged.

## Question

What is the priority and dependency-linked route from the existing application to stage and a limited production trial, including personal QA accounts, Google setup and enforced release checks?

## Context

The runtime and access tickets were unblocked, but local Google setup and CI enforcement were not explicit. The existing hosted-domain requirement rejected the personal Google account Jaco intends to use as a stage member. Later milestones have no ready implementation queue.

## Comments

Jaco agreed to all three proposed decisions on 15 October 2026: refine the existing hosted-trial plan; allow explicitly approved personal Google accounts locally and in stage while preserving production work-domain restrictions; and automatically deploy checked main revisions to stage, followed by stage verification and manual promotion of the exact verified revision.

## Answer

The destination is one prioritised, dependency-linked hosted-trial plan, including environment setup and release gates. Refine the existing map; defer later product milestones until trial feedback. Prioritise hosted runtime and CI, then approved access (independently buildable), then environment setup as soon as both foundations pass. Lead browsing and confirmation follow their feature dependencies and may proceed alongside setup. Full stage acceptance precedes production promotion.

Explicitly approved personal Google accounts are eligible in local development and stage. Production retains the approved work-domain requirement. All accounts still require verified Google identity, environment-local exact-email approval and server-assigned membership/roles. Jaco uses his lead account and a distinct personal member account in stage; repeat with QA and include at least two members for isolation verification. Real Google configuration and acceptance must cover local, stage and production.

Required typecheck, real-PostgreSQL HTTP/browser tests and production build run on PRs and the actual merged main revision. Only successful same-revision checks trigger automatic stage deployment, followed by migration/readiness and stage smoke/E2E checks. Production never deploys on merge. An explicit manual action promotes the exact revision backed by passing CI, stage checks and practical acceptance. A changed revision requires new verification.

This resolves the live discussion, not implementation. [Specification](../spec.md), [prioritised implementation queue](../breakdown.md) and [roadmap](../../../docs/ROADMAP.md) now carry the resulting acceptance and dependencies. GitHub Actions is the concrete workflow choice for the repository; current provider configuration must be verified during implementation/setup.
