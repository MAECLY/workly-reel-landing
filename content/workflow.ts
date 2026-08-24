import { ACTIVITY_WINDOW, EVIDENCE_REVIEW } from './assets';
import type { WorkflowStage } from './types';

/**
 * The six stages of the shipped Phase 0 flow.
 *
 * Each `detail` is checkable against the desktop repository's README and its
 * `docs/`. Nothing here describes a control that does not exist.
 */
export const workflow = {
  eyebrow: 'The workflow',
  heading: 'Evidence first, then the story, then the picture.',
  standfirst:
    'Six stages, in the order the application runs them. Nothing is generated from a window until you have read what was found and sealed it.',
  stages: [
    {
      index: '01',
      id: 'stage-capture',
      name: 'Capture',
      summary: 'Choose the window, then collect read-only evidence.',
      detail:
        'Pick a Day, a Week, or a Custom Range, then collect from the Git repositories and identities you approved. GitHub joins in when the GitHub CLI is installed and authenticated, and reports itself unavailable when it is not. The application makes no network request of its own.',
      assetFile: ACTIVITY_WINDOW,
    },
    {
      index: '02',
      id: 'stage-verify',
      name: 'Verify',
      summary: 'Read what was found, decide what it may say, then seal it.',
      detail:
        'Every adapter run records an outcome, so a source that failed is displayed differently from a window that was genuinely quiet. Include, exclude, or redact each item, then seal the window into a snapshot. Sealing is one way, and every later artefact points back at it.',
      assetFile: EVIDENCE_REVIEW,
    },
    {
      index: '03',
      id: 'stage-distil',
      name: 'Distil',
      summary: 'A deterministic summariser writes the first draft.',
      detail:
        'It uses observable facts only: counts, dates, the subject lines you wrote, and a project name your naming policy permits. It will not claim faster, improved, reduced, or a percentage, because no commit establishes any of them. Phase 0 ships three lenses: Reflective, Technical Deep Dive, and Weekly Arc.',
    },
    {
      index: '04',
      id: 'stage-frame',
      name: 'Frame',
      summary: 'Rewrite it in your voice. Your version is the one that survives.',
      detail:
        'An edit is stored as an immutable fork with its own id and the generated draft as its parent. Regenerating inserts a sibling in the version graph rather than replacing your wording. A sentence you wrote with no evidence attached is stored as a reflection, not as a verified claim.',
    },
    {
      index: '05',
      id: 'stage-compose',
      name: 'Compose',
      summary: 'The card is laid out at an exact size, and measured.',
      detail:
        'One template, one canvas: Signal on Portrait 1080 by 1350. The compositor reads the design system tokens and the vendored fonts, so the same copy produces the same glyphs on every machine. Copy that does not fit is reported as overflow, never silently shrunk, truncated, or hidden.',
    },
    {
      index: '06',
      id: 'stage-export',
      name: 'Export',
      summary: 'Four files land together in a folder you chose.',
      detail:
        'The PNG, the post copy, the alt text, and a private provenance record naming the exact versions behind them. Alt text is required rather than optional. If any one of the four fails to write, the files already written are removed, because a half finished export is worse than none.',
    },
  ] as const satisfies readonly WorkflowStage[],
} as const;
