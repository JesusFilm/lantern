import { useEffect, useRef, useState } from 'react';
import type { GuideContent, GuideSection } from '../shared/guide.js';
import './guide.css';

type View = 'home' | 'objectives' | 'smart' | 'example';
function SectionContent({ section }: { section: GuideSection }) {
  return <>
    {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
    {section.bullets && <ul className="guide-points">{section.bullets.map((point) => <li key={point}>{point}</li>)}</ul>}
    {section.example && <aside className="worked-example"><p className="eyebrow">{section.example.label}</p><p>{section.example.text}</p></aside>}
    {section.prompt && <aside className="reflection"><strong>Pause & consider</strong><p>{section.prompt}</p></aside>}
  </>;
}
export function Guide({ content }: { content: GuideContent }) {
  const [view, setView] = useState<View>('home');
  const [step, setStep] = useState(0);
  const [contextOpen, setContextOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const walkthrough = view === 'objectives' || view === 'smart' ? content[view] : undefined;
  const current = walkthrough?.steps[step];
  const hasContext = !!(content.context.mission || content.context.departmentContribution);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: 'start' });
  }, [view, step]);
  function open(next: View) { setView(next); setStep(0); }
  return <div className="guide">
    {view !== 'home' && <nav className="resource-nav" aria-label="Guide resources">
      <button onClick={() => open('home')}>← Guide overview</button>
      <div>{(['objectives', 'smart', 'example'] as const).map((target) => <button key={target} aria-current={view === target ? 'page' : undefined} onClick={() => open(target)}>
        {target === 'objectives' ? 'Objectives' : target === 'smart' ? 'SMART goals' : 'Engineering example'}
      </button>)}</div>
    </nav>}
    {hasContext && <div className="mission-context">
      <button className="context-toggle" aria-expanded={contextOpen} aria-controls="mission-context" onClick={() => setContextOpen(!contextOpen)}>
        <span>Our shared context</span><span>{contextOpen ? 'Hide −' : 'Explore +'}</span>
      </button>
      <div id="mission-context" hidden={!contextOpen}>
        {content.context.mission && <div><h2>Organizational mission</h2><p>{content.context.mission}</p></div>}
        {content.context.departmentContribution && <div><h2>Department contribution</h2><p>{content.context.departmentContribution}</p></div>}
      </div>
    </div>}
    {view === 'home' ? <>
      <section className="guide-intro">
        <p className="eyebrow">Your position focus</p>
        <h1 ref={heading} tabIndex={-1}>Find the purpose.<br />Give your work direction.</h1>
        <p className="intro-copy">Connect the people you serve with the contribution you can make. Prepare a focus you and your career lead can shape, agree and revisit.</p>
        <div className="focus-path" aria-label="From purpose to agreement"><span>01 · Understand</span><span>02 · Define</span><span>03 · Agree together</span></div>
      </section>
      <div className="resource-heading"><h2>Guidance, when you need it</h2><span className="help-mark" role="img" title="Optional supporting resources" aria-label="Optional help">?</span></div>
      <p>Choose a short walkthrough or explore a complete example. Start wherever it helps.</p>
      <div className="resource-cards">
        <button onClick={() => open('objectives')} className="resource-card"><span className="eyebrow">01 / Connect your contribution</span><strong>Critical mission objectives</strong><span>{content.objectives.description}</span><span className="card-action">Open objective walkthrough →</span></button>
        <button onClick={() => open('smart')} className="resource-card"><span className="eyebrow">02 / Make progress observable</span><strong>SMART goals</strong><span>{content.smart.description}</span><span className="card-action">Open SMART walkthrough →</span></button>
        <button onClick={() => open('example')} className="resource-card example-card"><span className="eyebrow">03 / See it in practice</span><strong>Engineering example</strong><span>A video devotional, a clearer next step and a focus that connects the work to its purpose.</span><span className="card-action">Read the full example →</span></button>
      </div>
      <section className="guide-note"><h2>Bring a draft, not every answer</h2><p>Prepare a mission-aligned objective, SMART goals, and gaps with next steps. Explain users, needs and intended outcomes wherever known. Personal and leadership development are optional.</p><p>Use a separate document for your draft. This guide does not save or lock in a position focus.</p></section>
      <div className="timing-note"><strong>When should we review?</strong><p>Your career lead defines your department’s process and timing. If it has not been supplied, ask your career lead. There is no default schedule.</p></div>
    </> : view === 'example' ? <article className="full-example">
      <p className="eyebrow">Engineering / Worked example</p><h1 ref={heading} tabIndex={-1}>{content.example.title}</h1>
      <p className="intro-copy">{content.example.introduction}</p>
      <nav className="example-contents" aria-label="Example contents">{content.example.sections.map((section) => <a key={section.id} href={`#example-${section.id}`}>{section.title}</a>)}</nav>
      {content.example.sections.map((section) => <section key={section.id} id={`example-${section.id}`}><h2>{section.title}</h2><SectionContent section={section} /></section>)}
      <button onClick={() => open('home')}>Return to guide overview</button>
    </article> : walkthrough && current && <section className="walkthrough" aria-label={walkthrough.title}>
      <div className="step-meta"><p className="eyebrow">{walkthrough.title}</p><span role="status">Step {step + 1} of {walkthrough.steps.length}</span></div>
      <div className="step-progress" aria-hidden="true">{walkthrough.steps.map((item, index) => <span key={item.id} className={index <= step ? 'reached' : ''} />)}</div>
      <div className="step-content" key={current.id}><h1 ref={heading} tabIndex={-1}>{current.title}</h1><SectionContent section={current} /></div>
      <div className="step-controls"><button disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
        {step < walkthrough.steps.length - 1 ? <button className="primary" onClick={() => setStep(step + 1)}>Next →</button>
          : <button className="primary" onClick={() => open('home')}>Finish walkthrough</button>}</div>
    </section>}
  </div>;
}
