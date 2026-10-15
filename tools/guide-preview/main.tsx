import { createRoot } from 'react-dom/client';
import { Guide } from '../../client/Guide.js';
import { guideContent } from '../../server/guide-content.js';
import '../../client/style.css';

// A separate static entry: never imported by the production app. No credentials, API or database.
const content = structuredClone(guideContent);
// Synthetic context variants support browser acceptance of absent/supplied context.
const context = new URLSearchParams(location.search).get('context');
if (context === 'none') content.context = {};
if (context === 'department-only') content.context = { departmentContribution: 'Fictional preview context: help engineers share useful capabilities.' };
if (context === 'both') content.context.departmentContribution = 'Fictional preview context: help engineers share useful capabilities.';

createRoot(document.getElementById('root')!).render(<main>
  <header><a className="brand" href="./">Lantern</a><span className="eyebrow">Engineering</span></header>
  <p className="preview-banner"><strong>Guide preview</strong> · Exploring as a fictional engineering member. No Google setup needed. Draft your focus separately; nothing you enter or read here is saved as a position focus.</p>
  <Guide content={content} />
</main>);
