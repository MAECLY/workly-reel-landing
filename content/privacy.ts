import type { ScopeItem } from './types';

/**
 * Privacy posture and the honest boundary of Phase 0.
 *
 * The "not shipped" list is not a teaser. Each line names something a reader
 * might reasonably assume is present, and says plainly that it is not.
 */
export const privacy = {
  eyebrow: 'Privacy and current scope',
  heading: 'It reads metadata, on your machine, and stops there.',
  standfirst:
    'The deterministic path needs no account, no API key, no downloaded model, no GPU, and no network. Local Git is enough on its own, and the offline end-to-end proof in the repository runs without any of them.',

  boundaryHeading: 'What crosses the evidence boundary',
  boundaryBody: 'Commit subject lines, timestamps, and three counts. That is the whole list.',

  neverHeading: 'What never leaves the machine',
  never: [
    {
      label: 'Raw diffs and patches',
      detail: 'The adapters read metadata. A diff is never collected, stored, or summarised.',
    },
    {
      label: 'File contents and file paths',
      detail:
        'No source file is read for its contents, and paths are removed before anything is stored.',
    },
    {
      label: 'Raw tool output',
      detail:
        'Standard error from a subprocess is redacted at the process boundary, so no caller can reach an unredacted string.',
    },
    {
      label: 'Credentials and secrets',
      detail:
        'The application stores none and reads none. Token-shaped values are stripped before a string reaches a log, a database row, or the interface.',
    },
  ] as const satisfies readonly ScopeItem[],

  namingHeading: 'How a project may be named',
  namingBody:
    'A repository is named in anything publishable only through an explicit naming policy, and the resolution fails closed. A blank label under a protective policy falls back to an opaque identifier, never to the folder name on disk.',
  namingPolicies: [
    {
      label: 'Anonymized',
      detail: 'A stable alias appears instead of the real name. This is the default.',
    },
    { label: 'Public', detail: 'The real name may appear. You have to choose it.' },
    { label: 'Private', detail: 'No name appears anywhere, including logs and previews.' },
    {
      label: 'Blocked',
      detail: 'The item is withheld from the narrative and from artwork entirely.',
    },
  ] as const satisfies readonly ScopeItem[],

  notShippedHeading: 'Not shipped in Phase 0',
  notShippedNote:
    'None of the following exists in the repository today. It is backlog, and this page will not describe it as anything else.',
  notShipped: [
    { label: 'No local AI', detail: 'There is no text or image model runtime of any kind.' },
    {
      label: 'No cloud AI',
      detail: 'There is no provider abstraction and no external inference call.',
    },
    { label: 'No model manager', detail: 'Nothing downloads, verifies, or catalogues a model.' },
    {
      label: 'No additional templates or formats',
      detail: 'One template family on one canvas, exported as PNG.',
    },
    { label: 'No scheduler', detail: 'Nothing runs on a timer or in the background.' },
    {
      label: 'No updater',
      detail: 'Updater artefacts are switched off and no update endpoint is configured.',
    },
    {
      label: 'No telemetry',
      detail: 'Nothing is measured, collected, or sent about how the application is used.',
    },
    {
      label: 'No direct publishing to LinkedIn',
      detail: 'The application writes files to a folder. You review them and post them yourself.',
    },
  ] as const satisfies readonly ScopeItem[],

  platformHeading: 'Where it has actually been run',
  platformBody:
    'One machine, running macOS on Apple silicon, on 2026-08-24. Every other environment is unverified: not built, not run, not tested. The build it produces is neither signed nor notarised, which is expected for a proof of concept.',
} as const;
