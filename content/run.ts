import type { RunStep, ScopeItem } from './types';

/**
 * The clean-checkout sequence, copied from the desktop repository's README.
 *
 * This block is the target of the hero's primary action. There is no download
 * on this page and no installer to link to: Phase 0 produces an unsigned build
 * for the machine that runs the build command, and nothing else.
 */
export const run = {
  eyebrow: 'Run it',
  heading: 'From a clean checkout, in one documented sequence.',
  standfirst:
    'There is nothing to download here. WorklyReel is a Tauri desktop application you build and run yourself, and the repository is private during Phase 0, so cloning needs read access to it.',

  prerequisitesHeading: 'What has to be on the machine first',
  prerequisites: [
    { label: 'Rust 1.85 or newer', detail: 'Developed and tested against rustc 1.97.1.' },
    {
      label: 'Node 22.12 or newer',
      detail: 'The floor the design-system package sets. Tested on v26.7.0.',
    },
    { label: 'pnpm 11', detail: 'Tested on 11.23.0.' },
    { label: 'Git', detail: 'Any recent version. It is also the primary evidence source.' },
    { label: 'Xcode command line tools', detail: 'Required to link a Tauri application on macOS.' },
    {
      label: 'GitHub CLI, optional',
      detail: 'Without it the GitHub source reports itself unavailable and nothing else changes.',
    },
  ] as const satisfies readonly ScopeItem[],

  sshNote:
    'The install step resolves the pinned design system over SSH from a private repository, so it needs a key with read access to MAECLY/workly-reel-ui.',

  stepsHeading: 'The sequence',
  steps: [
    {
      comment: 'Clone the desktop repository and enter the application',
      command: 'git clone git@github.com:MAECLY/workly-reel.git',
    },
    { comment: '', command: 'cd workly-reel/apps/desktop' },
    { comment: 'Resolve the pinned design system over SSH', command: 'pnpm install' },
    {
      comment: 'Copy tokens, templates, and TTFs into the Tauri resources',
      command: 'pnpm sync-design',
    },
    { comment: 'Run the application', command: 'pnpm tauri dev' },
    { comment: 'Produce a .app and a .dmg for the current machine', command: 'pnpm tauri build' },
    { comment: 'Back to the workspace root', command: 'cd ../..' },
    {
      comment: 'The Rust workspace, including the offline end-to-end proof',
      command: 'cargo test --workspace',
    },
  ] as const satisfies readonly RunStep[],

  closingNote:
    'The development and build commands run sync-design themselves, so the explicit call matters only when you want the assets refreshed without starting anything. The offline proof builds a real Git repository, seals it, drafts it, forks it, composes a real PNG, and exports all four files with no account, no API key, no model, no GPU, and no network.',
} as const;
