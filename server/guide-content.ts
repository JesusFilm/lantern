import type { GuideContent } from '../shared/guide.js';

// Curated release content, not department-editable data. Add department context only when supplied and agreed.
export const guideContent: GuideContent = {
  context: {
    mission: 'We partner with the Body of Christ through heart language media, so everyone, everywhere can encounter Jesus.',
  },
  objectives: {
    title: 'Critical mission objectives',
    description: 'Connect the people you serve, the change they need and your contribution.',
    steps: [
      {
        id: 'people', title: 'Start with the people you serve',
        paragraphs: [
          'A position focus makes your contribution clear and gives you and your career lead a useful reference for growth. Start with who benefits from your work and what they need.',
          'Describe your role’s purpose and intended outcomes, your responsibilities and current work, where that work comes from, expectations for a good result, and gaps in your understanding. These are areas to think about, not mandatory form fields.',
          'Users can be viewers, ministry partners or fellow engineers. Name what you know; make uncertainty visible rather than inventing an answer.',
        ],
        example: { label: 'Product work', text: 'A viewer finishes a video devotional but cannot find what to do next. A clearer next-step screen could help them continue engaging with the message.' },
        prompt: 'Who benefits from your current work, and what becomes possible for them if it goes well?',
      },
      {
        id: 'contribution', title: 'Connect your work to the mission',
        paragraphs: [
          'Follow the connection from organizational mission to department contribution to your individual objective. There is one organizational mission; departments and individuals contribute to it.',
          'Express the useful change you intend to make, who it serves and how your work supports that change. A critical mission objective is required, with SMART goals that help you recognise progress. There is no fixed number of objectives.',
          'Use supplied department context where it exists. If it is missing, ask for clarification; you do not need to invent or duplicate a department statement. You still need an individual objective.',
        ],
        example: { label: 'From activity to contribution', text: '“Build a screen” becomes “Help viewers of one video devotional find a meaningful next step by building and releasing a clearer next-step screen.” This supports continued engagement with heart language media.' },
        prompt: 'Finish this thought: I contribute by helping … to … through …',
      },
      {
        id: 'internal', title: 'Internal contributions count',
        paragraphs: [
          'Useful contributions also happen within engineering: shared technical capabilities, better collaboration, demos, show-and-tells and team connection. Product delivery is one possible starting point.',
          'Explain the people served and the intended outcome. Confirm that the proposed contribution fits agreed team priorities; these examples are possibilities, not assignments.',
        ],
        example: { label: 'Internal contribution · illustrative', text: 'Help fellow engineers share and apply useful approaches by facilitating a show-and-tell. Evidence could be a colleague demonstrating an approach they learned and describing where they can use it. Agree a suitable timeframe with the career lead.' },
        prompt: 'What friction could you remove for the people who help the team serve its mission?',
      },
      {
        id: 'discovery', title: 'When direction is still unclear',
        paragraphs: [
          'Discovery can be your initial mission objective: identify whom you could serve and agree a useful contribution. Use SMART goals for what you will learn or agree and by when.',
          'Leadership is responsible for supplying absent work or direction. Bring possible contributions with career-lead support; you are not responsible for inventing leadership’s priorities.',
          'Jaco coordinates follow-up with Tatai and Edmond, involving Sushma for QA. Record clear next steps. A draft can support exploratory discussion and remains draft while the mission objective is not jointly agreed.',
        ],
        example: { label: 'Discovery · illustrative', text: 'Explore where engineers need better shared capabilities. Before an agreed discussion date, talk with the relevant engineers, describe the needs and evidence, and bring a proposed contribution to the career lead and people responsible for team priorities.' },
        prompt: 'What do you need leadership to clarify, and what can you learn while that clarification is underway?',
      },
      {
        id: 'gaps', title: 'Turn gaps into next steps',
        paragraphs: [
          'An unanswered question is useful when it leads to active clarification. Record the gap, what you will do next and any efforts already made. Reach out to people who can help.',
          'For known direction, bring a mission-aligned objective, SMART goals, and explicit gaps with next steps to your initial discussion. Explain users, needs and intended outcomes wherever known.',
          'You do not need every answer before a discussion. Gaps can remain at lock-in if they have clear next steps; listing an uncertainty alone is not the same as pursuing it.',
        ],
        example: { label: 'A useful gap', text: '“We do not yet know which next step viewers expect. Next: ask Product to confirm the intended response, agree a research task and begin gathering viewer feedback before choosing the screen wording.”' },
        prompt: 'Which assumption most needs checking, and what is your next action?',
      },
      {
        id: 'agreement', title: 'Agree a focus you can revisit',
        paragraphs: [
          'Prepare and save a draft with at least one Contribution objective and one SMART goal. Everyone must request review of the latest saved version before confirmation, including a career lead working on their own focus. If you save more changes, send them for review again.',
          'Lock-in completes your position focus for the cycle. It means you have agreed a baseline, not that you have achieved the objectives. Confirmed content and review discussion stay locked, including for career leads. Mid-cycle amendment versus a new focus and accidental-lock recovery remain undecided until all first submissions are complete during December 2026–January 2027; unlocking is not an approved future feature.',
          'If you cannot agree, Jaco involves Tatai and Edmond for leadership support. They are not extra approvers; the focus remains draft until you and your career lead agree.',
          'An offline agreement still requires requesting review and then confirming in Lantern, immediately or later. A career lead can review and confirm their own requested focus, with optional discussion with their senior or manager. No second reviewer, note or waiting period is required.',
          'There are two full cycles per year: request review and confirm a focus, have a mid-cycle progress check-in, then review outcomes at the end of the cycle. Deliberately create a new focus with carryovers and/or new goals for the next cycle; preserve the previous agreement. Scheduling and automatic carryover are not provided.',
        ],
        prompt: 'Is the latest saved version requested for review, what remains uncertain, and what will you check at the mid-cycle and end-cycle conversations?',
      },
    ],
  },
  smart: {
    title: 'SMART goals',
    description: 'Turn a useful intention into evidence you can discuss and learn from.',
    steps: [
      {
        id: 'starting-point', title: 'Give an intention a useful shape',
        paragraphs: [
          'SMART goals are required for critical mission objectives. Apply the same approach to personal development and leadership development assignments when included.',
          'Consider specific, measurable, achievable, relevant and time-bound qualities. You do not have to write five separate sections; some qualities can be clear from the objective or agreed during review.',
          'We will improve one vague product goal step by step. All scenario counts, thresholds and month markers are illustrative, not required targets or a department review schedule.',
        ],
        example: { label: 'Starting goal', text: 'Improve the next-step experience.' },
        prompt: 'What would help you and your career lead recognise progress beyond simply being busy?',
      },
      {
        id: 'specific', title: 'Specific · name the change',
        paragraphs: ['Identify the people, situation and intended result. Keep the scope clear enough to act on without prescribing every implementation detail.'],
        example: { label: 'More specific', text: 'Help viewers of one video devotional find the next step by building and releasing a clearer next-step screen.' },
        prompt: 'Which experience or capability will change, and for whom?',
      },
      {
        id: 'measurable', title: 'Measurable · choose meaningful evidence',
        paragraphs: [
          'Choose evidence that tells you whether the intended result is happening. A count can help this viewer task; other goals can use demonstrated capability, feedback, a reasoned decision or documented learning.',
          'Do not force a numerical target just to make a goal look measurable. Agree what convincing evidence means for this objective.',
        ],
        example: { label: 'Add evidence · illustrative', text: 'Test 20 viewers and record who can find the next step. After improvements, retest 20 viewers, aiming for at least 16 to find it. Compare the findings and record what remains difficult.' },
        prompt: 'What would you observe or show, and why would that evidence matter?',
      },
      {
        id: 'achievable', title: 'Achievable · check the conditions',
        paragraphs: [
          'Discuss scope, capacity, dependencies and support. A goal is a commitment worth examining, not a guarantee that nothing will change.',
          'For this example, check access to viewers, Product’s agreement on the next step, and time for accessibility and reliability checks. Surface missing support as gaps with next steps.',
        ],
        example: { label: 'Check feasibility', text: 'Limit the release to one devotional, agree recruitment and review support, and release after accessibility and reliability checks. Use AI to help write code while retaining human responsibility for reviewing and testing it.' },
        prompt: 'What must be true to make this achievable, and who can help resolve the uncertain parts?',
      },
      {
        id: 'relevant', title: 'Relevant · keep the outcome in view',
        paragraphs: [
          'Explain why this goal advances the objective and the contribution to the mission. Shipping work and counting activity are useful only when connected to the intended benefit.',
          'For internal or discovery work, explain how the learning or capability helps the people you serve and supports a useful contribution. Do not claim a downstream outcome you have not observed.',
        ],
        example: { label: 'The connection', text: 'A clearer next step helps viewers continue engaging with a video devotional. That is the intended contribution to heart language media; a usability result does not by itself prove a spiritual outcome.' },
        prompt: 'If you reached the target, how would it help the people and purpose behind your objective?',
      },
      {
        id: 'time-bound', title: 'Time-bound · agree when to learn or act',
        paragraphs: [
          'Give the goal a timeframe within your position focus period that fits the work and can be agreed with your career lead. Goal dates are distinct from the department’s review cadence.',
          'This worked example uses Month 1, Month 3 and Month 6 to show sequencing. These goal milestones are illustrative, not required deadlines; the agreed rhythm is two focus cycles per year.',
        ],
        example: { label: 'The worked goal, brought together', text: 'For one video devotional, test 20 viewers by Month 1 and record who finds the next step. Build and release a clearer screen by Month 3 after accessibility and reliability checks. By Month 6, retest 20 viewers, aiming for at least 16 to find the next step, and document remaining gaps.' },
        prompt: 'What timeframe fits your goal, and which dependencies need agreement before you commit?',
      },
      {
        id: 'development', title: 'Use the same approach for growth',
        paragraphs: [
          'A personal development plan is optional and encouraged. Describe a capability or behaviour you want to grow, with SMART goals showing its professional application. A personal interest can fit when you explain how it supports your work.',
          'Leadership development assignments are a separate optional part beneath personal development. A coach gives an assignment; agree specific goals and outcomes for it. You do not need to include either development section just to complete a focus.',
          'An internal contribution could be facilitating a useful show-and-tell; a related development goal could be demonstrating better facilitation, supported by participant feedback. Evidence of learning can be meaningful without a numerical score.',
          'Include any development in the saved version requested for review before confirmation. The same locked baseline and two-cycle rhythm apply. A career lead may review and confirm their own requested focus; discussion with their senior or manager is optional.',
        ],
        example: { label: 'Growth · illustrative', text: 'By an agreed session date, facilitate a technical discussion that lets quieter colleagues contribute. Ask a colleague to observe, discuss feedback with your coach, and identify an adjustment to try next time.' },
        prompt: 'Is there a capability you want to grow through this work? Include it only if useful, and agree what evidence would show growth.',
      },
    ],
  },
  example: {
    title: 'A clearer next step for viewers',
    introduction: 'A worked engineering position focus based on the supplied video-devotional example. This is an illustrative drafting reference, not a mandatory organizational template. Counts, targets, month markers and assignments are scenario details to adapt with your career lead.',
    sections: [
      {
        id: 'purpose', title: 'Purpose, people and current work',
        paragraphs: [
          'In this scenario, an engineer works with Product on one video devotional. Viewers need to understand what they can do after watching. The intended outcome is a clearer route to a meaningful next step.',
          'The engineer takes responsibility for technical design, implementation and verification of the next-step screen, using AI to help write code. Product confirms the intended viewer response and priorities; the engineer reviews and tests the implementation with appropriate QA support.',
          'This develops the supplied working example. The Product collaboration, responsibilities and gaps described here make the scenario concrete; they are not an actual assignment or a confirmed department strategy.',
        ],
        example: { label: 'Illustrative contribution to the mission', text: 'Engineering helps make heart language media usable and reliable. This engineer contributes by helping viewers continue engaging after the devotional. The work supports the organizational mission without claiming that a usability test measures its ultimate impact.' },
      },
      {
        id: 'objective', title: 'Critical mission objective',
        paragraphs: ['Help viewers of one video devotional find a meaningful next step by building and releasing a clearer next-step screen, using AI to help write code.'],
        example: { label: 'What a good result looks like', text: 'Viewers can identify the intended next step; the screen meets the agreed accessibility and reliability checks; remaining difficulties are understood and discussed with Product.' },
      },
      {
        id: 'goals', title: 'SMART goals for the contribution',
        paragraphs: ['These goals retain the supplied example’s sequencing and targets. Agree appropriate scope, recruitment, support and dates for your own work rather than adopting these numbers automatically.'],
        bullets: [
          'By Month 1: test 20 viewers and record who can find the next step, along with observed difficulties. Use the findings to inform the screen.',
          'By Month 3: build and release the screen after accessibility and reliability checks. Agree what those checks must establish with Product and QA before release.',
          'By Month 6: retest 20 viewers; aim for at least 16 to find the next step. Compare the findings and document remaining difficulties and follow-up decisions.',
        ],
        example: { label: 'Why these goals are SMART', text: 'One screen and a defined viewer task make the scope specific. Observed task outcomes provide evidence. Recruitment, capacity and checks must make the plan achievable. The viewer benefit connects it to the objective. Relative month markers make the sequence time-bound; they do not establish review cadence.' },
      },
      {
        id: 'unknowns', title: 'Gaps and active next steps',
        paragraphs: ['These are illustrative questions to pursue, not findings from real viewer research. Record efforts as you take them and discuss what you learn.'],
        bullets: [
          'Intended response: what next step should the viewer understand? Ask Product to confirm the intended action and its purpose before finalising wording.',
          'Viewer needs: which language, device and accessibility needs should the test represent? Agree recruitment with the people who know these viewers and begin arranging sessions.',
          'Release expectations: what accessibility and reliability evidence is sufficient? Work with Product and QA to define checks and identify unresolved risks before release.',
          'Capacity and dependencies: are recruitment and review support available for the proposed month markers? Confirm support with the career lead and relevant owners; revise the proposal together if needed.',
        ],
      },
      {
        id: 'personal-development', title: 'Personal development · optional',
        paragraphs: ['Grow the capability to lead technical design and critically review AI-assisted code for this release. This optional development objective is distinct from the viewer outcome, while using the same work as a place to practise.'],
        bullets: [
          'By Month 2: compare two build options and recommend one to Product, explaining the tradeoffs and why it suits the agreed needs.',
          'By Month 6: record three AI code reviews and the fixes made. Discuss with the career lead what these show about judgement and what to improve next.',
        ],
      },
      {
        id: 'leadership-development', title: 'Leadership development assignment · optional',
        paragraphs: [
          'A separate coach-given assignment beneath personal development could be to facilitate a design discussion that helps engineers understand and contribute to the recommendation. This extends the reference for illustration; it is not a required assignment.',
          'Before an agreed design discussion date, prepare the options and questions, facilitate participation, and document the decision and unresolved concerns. Ask the coach for feedback and agree one facilitation improvement to practise next. The evidence is the discussion outcome and demonstrated capability, not an imposed numerical score.',
        ],
      },
      {
        id: 'review', title: 'Review, agreement and timing',
        paragraphs: [
          'Save this draft and request review of the latest saved version before confirmation. If you edit it, send the changes for review again. Agree the Contribution objective, SMART goals and any included development; gaps may remain with clear next steps. Offline agreement still requires the request and confirmation steps in Lantern.',
          'Lock-in completes the individual position focus for the cycle; it does not mean the screen has shipped or its goals have been achieved. Confirmed content stays locked, including for career leads. Mid-cycle amendment versus a new focus and accidental-lock recovery remain undecided until all first submissions are complete during December 2026–January 2027.',
          'If direction or agreement is missing, Jaco coordinates leadership support with Tatai and Edmond, involving Sushma for QA. The focus remains draft until the engineer and career lead agree.',
          'There are two full cycles per year, each with confirmation, a mid-cycle check-in and an end-cycle review. Then deliberately create a new focus with carryovers and/or new goals, preserving the previous baseline. The example’s Month 1, 2, 3 and 6 targets are illustrative goal milestones, not fixed review dates.',
        ],
        prompt: 'Use this example to prepare your own objective, SMART goals, gaps and next steps in a separate document. Bring it to your career lead; this guide does not save or lock in a focus.',
      },
    ],
  },
};
