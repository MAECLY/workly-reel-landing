import { darkTheme, lightTheme } from '@maecly/workly-reel-ui/tokens';

/**
 * Identity, metadata, and the labels that appear in more than one place.
 *
 * Phase 0 is deliberately not indexable, so the origin here is used for the
 * canonical link and the sitemap while `robots` still refuses indexing. The
 * canonical URL is what a reviewer pastes; it is not a bid for ranking.
 */
export const site = {
  origin: 'https://workly-reel.maecly.com',
  canonical: 'https://workly-reel.maecly.com/',
  productName: 'WorklyReel',
  endorsement: 'by MAECLY',
  category: 'Developer Proof-of-Work',
  workflow: 'Evidence-to-Brand',
  /** The honest status label. It appears on the page, not only in metadata. */
  phaseLabel: 'Functional proof of concept',
  desktopVersion: 'WorklyReel 0.1.0',
  testedPlatform: 'macOS on Apple silicon',
  title: 'Developer Proof-of-Work | WorklyReel by MAECLY',
  description:
    'Developer Proof-of-Work for people who write software. Review the evidence from your day or week, shape the story in your own voice, and export a LinkedIn-ready visual without giving up control of your code or edits.',
  locale: 'en',
} as const;

/** Every in-page destination, so an anchor and its heading cannot drift apart. */
export const sectionIds = {
  hero: 'top',
  workflow: 'workflow',
  window: 'activity-window',
  proof: 'proof',
  scope: 'privacy-and-scope',
  run: 'run-it',
} as const;

export const skipLink = {
  label: 'Skip to the main content',
  targetId: 'main-content',
} as const;

const canvasOf = (theme: Readonly<Record<string, string>>, name: string): string => {
  const value = theme[name];
  if (value === undefined) {
    throw new Error(`No "${name}" colour in the generated token document`);
  }
  return value;
};

/**
 * The browser chrome colour, read from the token document rather than typed.
 *
 * A `theme-color` meta tag cannot reference a custom property, so this is the
 * one place a colour is resolved to a literal. Reading it from the generated
 * tokens keeps it from drifting away from the canvas the page actually paints.
 */
export const themeColors = {
  dark: canvasOf(darkTheme, 'canvas'),
  light: canvasOf(lightTheme, 'canvas'),
} as const;
