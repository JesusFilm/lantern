# Weekly planning and reflection

Lantern could help members choose weekly work in relation to their position focus and shared initiatives, while giving an engineering manager visibility across roughly 15 people using different project systems. Research on AI-assisted engineering supports examining shared intent, verification and coordination alongside individual activity. Weekly planning and reflection, with brief updates when work changes, remains a hypothesis to test. The cadence and agent behavior below are proposals, not agreed product requirements.

## Research on engineering teams using AI

Evidence considered through 21 October 2026 includes engineering field experiments, organizational case research, qualitative studies and broad surveys. These answer different questions. Randomized tool access can estimate some effects of a coding assistant; an interview study can reveal how work changes without estimating a causal productivity effect. Neither establishes the best management reporting cadence. Publication year also differs from tool generation and data-collection year.

### Industrial developers and changing human interaction

Salomon and colleagues' 2026 study followed 30 industrial developers for 5–12 working days, collecting 627 experience-sampling and 207 end-of-day responses, with 22 interviews. A further 131 professionals answered a follow-up survey. Participants described shifting routine technical questions toward AI while retaining human interaction for context, clarification, alternative perspectives, mentorship and connection. These are reported experiences, not randomized effects or whole-team communication measurements. The inference for Lantern is to make contextual questions and opportunities to reason together visible, even when independent task progress looks healthy. [Research publication record](https://kairos.jetbrains.com/research/publications/genai-human-interactions) and [author manuscript](https://www.cs.ubc.ca/~rtholmes/papers/tse_2026_salomon.pdf).

### Persistent teamwork needs in a software organization

Xiao and colleagues interviewed 15 practitioners in a project-based software organization in 2023, then re-interviewed ten in 2025. Personal assistants had become common, but anticipated systems integrating team context and coordination had not entered their work. Participants described needs including persistent context, synthesis across tools and retained corrections. One organization, interview accounts and attrition limit generalization; the study did not evaluate a deployed team assistant. Cite the September 2026 revision, titled Beyond the Personal Assistant, rather than treating its earlier AI Hasn't Fixed Teamwork title as the current framing. [Version history](https://arxiv.org/abs/2509.10956) and [revised paper](https://arxiv.org/html/2509.10956v2).

### AI assistance in Austrian Post development meetings

Cabrero-Daniel and colleagues conducted 2024 action research with three teams at Austrian Post Group IT, iterating planning/refinement and Daily Scrum assistants. Initial live warnings were distracting; shorter and less intrusive suggestions were better received. Participants valued summaries, while stale inputs and incorrect capacity calculations undermined recommendations. The small, willing sample and researcher involvement limit inference; there was no controlled delivery-outcome comparison. This is directly relevant experience with team routines, but not proof that an asynchronous daily reporting product works. [Primary paper](https://arxiv.org/html/2404.14871).

### Anthropic engineering and research staff in 2025

Published 2 December 2025, this internal study used an August survey of 132 engineers and researchers, 53 interviews, and Claude Code telemetry. Some participants reported asking colleagues fewer questions and losing opportunities for mentorship or collaboration. AI also enabled work beyond their prior specialties. The study was observational and vendor-authored, with selected, nonanonymous respondents and unusually advanced access to AI; productivity estimates were self-reported. It is relevant to the possibility that independent project work reduces informal visibility, but does not establish that AI universally reduces collaboration. [Anthropic study](https://www.anthropic.com/research/how-ai-is-transforming-work-at-anthropic/).

### Anthropic work organization in 2026

Published 16 October 2026, this study combined internal employment, usage, output, communications and calendar data with 17 interviews. It described human attention as a bottleneck and employees building monitoring tools. In one department's public Slack network, agents added interaction without replacing existing human responses. Technical individual contributors also spent more time in meetings. Adoption was not randomized, company growth complicates interpretation, and output measures are not equivalent to business value. This case supports investigating shared decisions and attention needs, rather than assuming agents eliminate coordination. [Anthropic study](https://www.anthropic.com/research/employment-at-anthropic/).

### Microsoft and Accenture field experiments

Cui and colleagues analyzed randomized access to coding assistance across 4,867 developers at Microsoft, Accenture and an unnamed Fortune 100 company. The February 2025 paper estimates about 26% more completed tasks among tool users using an instrumental-variable analysis; individual experiments were noisy. At Microsoft, assignment included both individuals and teams. These were earlier code-completion tools, with the Microsoft experiment beginning in 2022, not today's autonomous agent workflows. Pull requests and other output measures do not establish shared alignment or customer value, and the experiments did not compare management routines. [Primary paper](https://economics.mit.edu/sites/default/files/inline-files/draft_copilot_experiments.pdf).

### Google engineers and verification work

DORA's March 2026 analysis examined 1,110 open-ended responses from Google engineers collected in Q3 2025. Engineers described faster creation alongside auditing effort, hallucinations and knowledge limitations. Responses may have been primed toward code generation by preceding questions; this qualitative analysis does not estimate a net productivity effect. The same article summarizes the 2025 DORA survey's association between AI adoption and both increased delivery throughput and increased instability. These are associations rather than randomized causal estimates. This supports keeping verification and rework visible in a pilot, not counting generated artifacts as delivered outcomes. [Primary analysis and methodology](https://dora.dev/insights/balancing-ai-tensions/).

### DORA organizational evidence

The 2025 research surveyed nearly 5,000 technology professionals. Its central interpretation is that AI amplifies existing organizational capabilities and weaknesses; local gains depend on the surrounding delivery system. Survey associations and the research program's interpretation do not prove a particular check-in process works. The older negative-throughput findings in the separate Impact of Generative AI report should not be presented as the 2025 survey result. [Official 2025 report summary](https://dora.dev/research/2025/dora-report/) and [Google's publication announcement](https://blog.google/innovation-and-ai/technology/developers-tools/dora-report-2025/).

### METR experienced developer experiments and follow up

METR's July 2025 randomized study involved 16 experienced open-source developers and 246 real tasks in familiar repositories. Early-2025 AI tools increased completion time by 19%, although participants believed they had been faster. This small, specific setting does not establish a general AI slowdown. [Original study](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/).

In February 2026, METR reported a later experiment with 10 returning and 47 new developers. Its estimates pointed toward speedups but included no effect in their intervals. METR judged the estimates unreliable because participants and tasks were selected out, pay changed, and concurrent agents complicated time measurement. This is not a clean reversal or confirmation of the 2025 result. [Follow up](https://metr.org/blog/2026-02-24-uplift-update/).

METR's May 2026 survey of 349 technical workers separately distinguished self-reported value from speed. Median estimates were 1.4–2 times the value and three times the speed. Convenience recruitment and difficult counterfactual judgments constrain interpretation. Together these studies support asking what valuable result changed rather than requiring a numerical estimate of hours saved. [Survey and methods](https://metr.org/blog/2026-05-11-ai-usage-survey/).

### Learning while using AI

Shen and Tamkin's January 2026 randomized experiment involved 52 programmers learning the unfamiliar Trio library. AI assistance reduced subsequent unaided comprehension scores without a statistically significant average completion-time improvement. Interaction patterns involving active reasoning were associated with better learning; these patterns were not themselves randomized. The short exercise and immediate quiz do not demonstrate long-term skill loss or team outcomes. This supports testing an occasional reflection about what a person can now explain or debug, without assuming that such a prompt is a validated intervention. [Primary paper, revised February 2026](https://arxiv.org/html/2601.20245v2).

### Adjacent knowledge worker evidence

A six-month randomized field experiment covered 6,000 knowledge workers using AI in email, documents and meetings. Effects primarily appeared in activities individuals could change independently; meeting time did not significantly change. This is not specifically an engineering or coding-agent study, so it is supporting evidence for the distinction between individual workflow changes and changes requiring coordination. [Dillon et al., April 2025](https://www.microsoft.com/en-us/research/publication/shifting-work-patterns-with-generative-ai/).

## Implications for an AI assisted engineering review

The following are design hypotheses drawn from the evidence above and this team's stated needs. The studies do not validate this exact combination of features.

1. Capture shared intent: the outcome or question being pursued, why it matters, and what would count as a useful result. People retain authority over intentions even when agents draft the wording.
2. Keep material changes visible: revised assumptions, tradeoffs, dependencies, requests for help and decisions affecting someone else's project. A generated activity summary alone cannot establish these.
3. Distinguish stages of progress: implementation produced, verification still needed, accepted result and observed impact. Agent completion and merged code need not imply that the intended outcome has been achieved.
4. Preserve a small shared memory: original weekly intentions, subsequent changes, corrections and source links. Show when evidence was last checked and what the agent could access. Do not infer that silence means no work or that no reported blocker means no support is needed.
5. Support human connection: surface opportunities to reuse another person's work, discuss an architectural choice or share learning. Whether Lantern should actively suggest those connections is an owner decision.
6. Assist attention with reviewable summaries: let the manager see every member and open the underlying evidence. Keep explicit help requests accessible without model interpretation. Check missed issues as well as useful flags during the pilot.
7. Retain meaningful reflection: use occasional questions about choices, learning and what to change. Do not assume an agent's fluent retrospective demonstrates that the member reflected or gained understanding.

The strongest gap in the evidence is the proposed workflow itself. These sources do not establish that weekly reviews improve alignment for a 15-person agent-using engineering team, that daily questions are necessary, or that agent-selected manager attention is effective. The pilot should compare actual usefulness and burden with the team's current baseline, rather than assume a tool rollout is success.

## Team context and time budget

The manager currently has little consolidated visibility. Members use GitHub, Linear, repositories and Markdown independently. The proposed allowance is five minutes for planning, five for reflection, and one to two minutes of daily questions. Across five working days this is 15–20 minutes per member per week, or 3.75–5 team hours for 15 participants, before manager review. These are arithmetic estimates from the proposed budget, not measured costs. Planning and reflection may overlap daily updates; measure actual time during a pilot.

## Planning and reflection evidence

Specific, challenging group goals improved group performance in a meta-analysis. Individual goals framed around contribution to the group were more favorable than goals maximizing individual performance, although that comparison used relatively few studies. This supports exploring connections between weekly intentions and shared initiatives; it does not validate Lantern's exact hierarchy or a weekly schedule. [Kleingeld, van Mierlo and Arends, 2011](https://oli.cmu.edu/repository/webcontent/eed3f1190a0001dc657ec8b5f17654a2/m2_appraisal_sci_evidence/webcontent/Papers/Kleingeld_2011.pdf).

In a complex business simulation, participants with a specific challenging learning goal performed better than those with a challenging performance goal or a general instruction to do their best. For unfamiliar engineering work, a weekly intention could therefore name an uncertainty to resolve or an approach to test. That engineering application is an inference from a simulation experiment. [Seijts et al., 2004](https://leeds-faculty.colorado.edu/dahe7472/sejits%202004.pdf).

A meta-analysis of randomized interventions found that monitoring progress improved goal attainment. Effects were larger where progress was recorded and reported or shared, but those moderator comparisons do not independently establish causality. Almost all studies concerned health goals, so transfer to engineering management is indirect. The results do not establish that a daily report is better than a weekly review. [Harkin et al., 2016](https://eprints.whiterose.ac.uk/91437/8/3_PDFsam_Does%20monitoring%20goal.pdf).

A meta-analysis of randomized team reflexivity interventions found benefits for collective performance and performance behaviors, with stronger performance effects for self-report measures than objective or researcher-assessed measures. A private written reflection cannot be assumed to reproduce a team discussing and adapting its work together. [Lines et al., 2021](https://researchers.mq.edu.au/en/publications/the-effectiveness-of-team-reflexivity-interventions-a-systematic-/).

Together, these sources support testing explicit intentions, written progress and reflection. They do not establish an optimal daily or weekly cadence for a 15-person engineering team, nor validate the proposed minute budgets.

## Preserve judgment when agents assist

A survey of 319 knowledge workers found that higher confidence in generative AI was associated with less reported critical thinking. This was self-report and association, not an experiment establishing that AI causes skill loss. It supports testing whether assisted updates retain meaningful human judgment; it does not establish the effectiveness of automated management triage. [Lee et al., CHI 2025](https://www.microsoft.com/en-us/research/publication/the-impact-of-generative-ai-on-critical-thinking-self-reported-reductions-in-cognitive-effort-and-confidence-effects-from-a-survey-of-knowledge-workers/).

Human–AI interaction guidelines advise making system capabilities and limitations understandable, enabling correction and dismissal, and explaining behavior. Their validation included practitioners evaluating AI products; it did not test this reporting workflow. [Amershi et al., CHI 2019](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/) and the [guideline poster](https://www.microsoft.com/en-us/research/wp-content/uploads/2019/03/AI_Guidelines_Poster_PrintQuality.pdf).

Applied to Lantern, members could review an agent draft before sharing, personally choose intended outcomes, and explain changed priorities or learning. A manager digest could link every flag to its source and keep all members visible. Explicit requests for help should remain directly accessible regardless of the model's interpretation. Missing or stale information should remain unknown rather than imply that a person is on track. These are design inferences from the guidelines and the team's needs.

## Keep progress distinct from activity and appraisal

The SPACE framework explains why individual activity alone cannot represent developer productivity. Repository events and agent runs can supply context, but cannot establish useful outcomes on their own. The framework is not a controlled trial of weekly reporting. [Forsgren et al., 2021](https://www.microsoft.com/en-us/research/publication/the-space-of-developer-productivity-theres-more-to-it-than-you-think/).

In a field study of 51 manufacturing teams, psychological safety was associated with team learning behavior. The setting and observational design limit direct transfer to an engineering reporting tool. [Edmondson, 1999](https://dash.harvard.edu/entities/publication/13a7b031-0fdd-45ec-a7e0-2b80e2bc679f).

For a pilot, use updates to discuss support, changing plans and learning. Avoid turning weekly completion rates into an individual performance score. Keep team work plans and blockers separate from private personal-development reflections. These are proposed operating choices; visibility and access roles still require agreement.

## Proposed pilot

Test a four-week routine before committing to integrations or a permanent daily reporting requirement:

- Beginning of week: choose one to three intended outcomes, explain the relevant focus or initiative where useful, and identify uncertainty or help needed. For exploratory work, an outcome can be a question answered or a decision enabled.
- During the week: ask whether expectations, blockers or requests for help have changed. Permit a short unchanged response without a new narrative. Compare the usefulness and time cost of daily versus change-triggered updates.
- End of week: revisit the original intentions, describe what happened, explain changes and learning, and decide what to adjust next week. Preserve original intentions alongside changes so reflection has a stable reference.
- Manager review: inspect explicit requests and changed expectations frequently, and read a compact update from every member weekly. Use agent suggestions to order attention with visible source evidence.

Assess whether the manager can explain each person's intended contribution, whether requests receive useful responses, whether members can identify decisions improved by reflection, whether the digest misses important issues, and whether actual time stays within the agreed budget. Do not use submission counts alone as success evidence.
