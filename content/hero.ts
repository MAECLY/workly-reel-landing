import { EVIDENCE_REVIEW } from './assets';
import { sectionIds, site } from './site';
import type { PageAction } from './types';

export const hero = {
  eyebrow: 'Developer proof of work',
  headline: 'Turn the work you did into proof worth sharing.',
  supporting:
    'Review the evidence from your day or week, shape the story in your own voice, and export a LinkedIn-ready visual without giving up control of your code or edits.',
  statusLabel: site.phaseLabel,
  statusDetail:
    'One vertical slice, run and tested on one machine. Everything it cannot do yet is listed further down this page.',
  primaryAction: {
    label: 'Run the proof of concept',
    targetId: sectionIds.run,
  } satisfies PageAction,
  secondaryAction: {
    label: 'See the workflow',
    targetId: sectionIds.workflow,
  } satisfies PageAction,
  trustLine:
    'Deterministic offline output works without an account. Local and cloud AI routes stay explicit.',
  assetFile: EVIDENCE_REVIEW,
  /** Read beside the screenshot, so the differentiator is stated in words too. */
  assetPoint: {
    title: 'A missing source is not a quiet day',
    body: 'When a source cannot be read, WorklyReel reports its activity as unknown and says so before you write anything. It never quietly reports zero.',
  },
} as const;
