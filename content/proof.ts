import { signalPortrait } from '@maecly/workly-reel-ui/social-templates';
import { socialCanvases } from '@maecly/workly-reel-ui/tokens';
import { SIGNAL_EXPORT, realAsset } from './assets';
import type { ProofClaim } from './types';

/**
 * The export section.
 *
 * The template facts are read from the same definition the Rust compositor
 * deserialises, so a region that moves in the design system moves in this copy
 * too. Both `/social-templates` and `/tokens` are pure data entry points and
 * are safe to read from a server component.
 */

const canvas = socialCanvases.find((entry) => entry.id === signalPortrait.canvasId);
if (canvas === undefined) {
  throw new Error(`No canvas "${signalPortrait.canvasId}" in the token document`);
}

const asset = realAsset(SIGNAL_EXPORT);

const textRegionCount = signalPortrait.regions.filter((region) => region.kind === 'text').length;

export const proof = {
  eyebrow: 'The artefact',
  heading: 'Every word on the card was drawn by the compositor.',
  standfirst:
    'This is a real export, not a mock-up of one. The bytes below the caption are the bytes the shipped compositor wrote, at the size it wrote them.',
  assetFile: SIGNAL_EXPORT,
  template: {
    id: signalPortrait.id,
    family: signalPortrait.family,
    version: signalPortrait.version,
    canvasLabel: canvas.label,
    width: canvas.width,
    height: canvas.height,
    palette: signalPortrait.defaultPalette,
    textRegionCount,
    description: signalPortrait.description,
  },
  claims: [
    {
      title: 'The compositor renders every word',
      body: `The eyebrow, the headline, the supporting lines, the proof points, the attribution, and the mark are all laid out in ${textRegionCount} measured text regions from the design system tokens and its vendored fonts. No system font is loaded, so the same copy produces the same glyphs on another machine.`,
    },
    {
      title: 'An image model never draws the headline',
      body: 'Critical copy is a compositor layer by contract. Phase 0 generates no artwork at all, and even when an artwork layer exists later it sits behind the copy rather than producing it. Text that cannot fit its region is reported as overflow rather than resized to hide the problem.',
    },
    {
      title: 'Your edits are immutable forks',
      body: 'Editing a draft creates a new version with its own id and the generated draft recorded as its parent. Regenerating adds a sibling to the version graph. There is no code path that writes over the words you wrote, which makes that a structural property rather than a promise.',
    },
  ] as const satisfies readonly ProofClaim[],
  postCopy: {
    heading: 'The post copy that shipped beside it',
    note: 'Exported as a plain text file next to the image, with no hashtag padding and nothing engineered for engagement. You edit it, then you post it yourself.',
    /**
     * Verbatim from `public/assets/export-signal-portrait-post.txt`, which the
     * same export run produced. Quoted rather than read at runtime so the page
     * never renders a file the manifest does not describe.
     */
    lines: [
      'Fixes in Harbour Ledger',
      'Six changes landed on six of seven days, in Harbour Ledger.',
      'That work breaks down as three fixes, one refactor, one documentation change, and one test change.',
      'Also in the window: Cover the drain path; Correct the backoff ceiling.',
    ],
  },
  syntheticNote: `Every name in the card is invented. ${asset.fictionalProject} is a fictional project and ${asset.fictionalAuthor} is a fictional author, so a real repository never appears in a published example.`,
} as const;
