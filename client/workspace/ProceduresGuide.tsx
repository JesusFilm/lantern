import type { Ref } from 'react';
import { ArrowRight, LockKeyhole, MessageCircle, Pencil } from 'lucide-react';
import './procedures-guide.css';

export const procedureSections = ['The year', 'Agree a focus', 'Make a change'] as const;
export type ProcedureSection = typeof procedureSections[number];

const milestones = [
  ['JAN', 'Set your focus'],
  ['MAR', 'Check in'],
  ['JUN', 'Review & renew'],
  ['JUL', 'Set your focus'],
  ['SEP', 'Check in'],
  ['DEC', 'Review & renew'],
] as const;

function YearCircle({ headingRef }: { headingRef: Ref<HTMLHeadingElement> }) {
  return <section className="procedure-year">
    <h2 className="procedure-reader-heading" ref={headingRef} tabIndex={-1}>The year</h2>
    <div className="procedure-circle">
      <svg viewBox="0 0 600 480" role="img" aria-label="Position Focus annual cycle">
        <desc>Clockwise: set a focus in January, check in at the end of March, review and renew at the end of June. Set the next focus in July, check in at the end of September, review and renew at the end of December.</desc>
        <path d="M 300 55 A 185 185 0 0 1 300 425" fill="none" stroke="#d9eeee" strokeWidth="54" />
        <path d="M 300 425 A 185 185 0 0 1 300 55" fill="none" stroke="#e9e5f5" strokeWidth="54" />
        <path d="M 315 55 A 185 185 0 0 1 485 230 M 480 222 l 5 10 5 -10" fill="none" stroke="#609d9f" strokeWidth="1.5" />
        <path d="M 285 425 A 185 185 0 0 1 115 250 M 110 258 l 5 -10 5 10" fill="none" stroke="#9a8bba" strokeWidth="1.5" />
        <text x="427" y="128">Q1</text><text x="427" y="362">Q2</text>
        <text x="173" y="362">Q3</text><text x="173" y="128">Q4</text>
      </svg>
      <ol className="procedure-milestones" aria-label="Annual milestones">
        {milestones.map(([month, action], i) => <li className={`procedure-month-${i}`} key={month}>
          <span>{month}</span><strong>{action}</strong>
        </li>)}
      </ol>
    </div>
    <div className="procedure-year-key"><span><i aria-hidden="true" />Focus 01 · Jan–Jun</span><span><i aria-hidden="true" />Focus 02 · Jul–Dec</span></div>
    <p>Create a new focus for each half-year. Renewal preserves the previous cycle’s agreed focus and history.</p>
  </section>;
}

function AgreementFlow({ amendment, headingRef }: { amendment: boolean; headingRef: Ref<HTMLHeadingElement> }) {
  if (amendment) return <section className="procedure-flow-panel">
    <p className="procedure-timing">Change policy · Not decided</p>
    <h2 ref={headingRef} tabIndex={-1}>Confirmed focuses stay locked.</h2>
    <p>Confirmed focuses can’t be edited or unlocked, even by a career lead.</p>
    <p>The policy for changing a confirmed focus is still undecided, including whether to amend it or create a new focus.</p>
  </section>;
  const stages = [
    { icon: Pencil, title: 'Draft', who: 'Member' },
    { icon: MessageCircle, title: 'Request review', who: 'Member' },
    { icon: MessageCircle, title: 'Discuss & agree', who: 'Together' },
    { icon: LockKeyhole, title: 'Confirm', who: 'Career lead' },
  ];
  return <section className="procedure-flow-panel">
    <p className="procedure-timing">January & July</p>
    <h2 ref={headingRef} tabIndex={-1}>Start each half together.</h2>
    <ol className="procedure-flow" aria-label="Agree a focus">
      {stages.map((stage, i) => <li key={stage.title}>
        <span className="procedure-flow-icon"><stage.icon size={28} aria-hidden="true" /></span>
        {i < stages.length - 1 && <ArrowRight className="procedure-flow-arrow" size={19} aria-hidden="true" />}
        <strong>{stage.title}</strong><span className="procedure-role">{stage.who}</span>
      </li>)}
    </ol>
      <p>Request review of the latest saved version before confirmation, including for a career lead’s own focus. Send any later saved changes for review again. After an offline agreement, still request review and confirm in Lantern, immediately or later.</p>
      <p>For your own focus as career lead, review it again or discuss it with your senior or manager. You can confirm it yourself without another reviewer or a note.</p>
  </section>;
}

export function ProceduresGuide({ section, headingRef }: { section: ProcedureSection; headingRef: Ref<HTMLHeadingElement> }) {
  return section === 'The year'
    ? <YearCircle headingRef={headingRef} />
    : <AgreementFlow amendment={section === 'Make a change'} headingRef={headingRef} />;
}
