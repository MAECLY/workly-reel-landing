import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Every page this router renders, discovered rather than listed.
 *
 * The sweeps that describe the whole page - the theme repaint and the
 * reduced-motion check - used to open `/` and nothing else, which made every
 * claim they publish a claim about one route. The not-found page carries the
 * same stylesheet, the same masthead, and the same theme control, and an
 * animation declared outside the `prefers-reduced-motion` guard on a class only
 * it uses was invisible to all of them.
 *
 * Adding `/404` to a list beside `/` would have moved the hole to whatever
 * route was added next, so nothing is named here at all: `app/` is walked, and
 * a `page.tsx` or a `not-found.tsx` appearing in it is swept from the moment it
 * exists.
 */

const ROOT = resolve(import.meta.dirname, '..', '..');

/**
 * An address Phase 0 never published, which the not-found page is what answers.
 *
 * Any unpublished address would do. This one is written out so a failure names
 * something no reader could mistake for a route that was meant to exist.
 */
export const UNPUBLISHED_ADDRESS = 'no-such-page-in-phase-0';

export interface RenderedPage {
  /** How a failure names the page. */
  readonly name: string;
  /** An address that reaches it on the server under test. */
  readonly path: string;
  /** The status that address is supposed to answer with. */
  readonly status: number;
}

/**
 * Route groups and private folders are directories in `app/` that are not
 * segments of any address, so they are dropped rather than walked into blindly.
 */
const isAddressSegment = (segment: string): boolean =>
  !segment.startsWith('(') && !segment.startsWith('@') && !segment.startsWith('_');

const addressOf = (segments: readonly string[]): string =>
  `/${segments.filter(isAddressSegment).join('/')}`;

const collect = (directory: string, segments: readonly string[]): readonly RenderedPage[] => {
  const entries = readdirSync(directory, { withFileTypes: true });
  const here = addressOf(segments);

  const found = entries.flatMap((entry): readonly RenderedPage[] => {
    if (entry.isDirectory()) {
      return collect(join(directory, entry.name), [...segments, entry.name]);
    }

    if (entry.name === 'page.tsx') {
      return [{ name: `the page at ${here}`, path: here, status: 200 }];
    }

    if (entry.name === 'not-found.tsx') {
      const path = here.endsWith('/')
        ? `${here}${UNPUBLISHED_ADDRESS}`
        : `${here}/${UNPUBLISHED_ADDRESS}`;
      return [{ name: `the not-found page under ${here}`, path, status: 404 }];
    }

    return [];
  });

  return found;
};

const discovered = collect(join(ROOT, 'app'), []);

/*
  A sweep that visits nothing passes every assertion in it, and a `for` loop
  over an empty inventory declares no tests at all, which reads in a report as
  a suite that has nothing to say rather than as a suite that has stopped
  looking. Both routes are the product's, so their absence is a failure here
  rather than a smaller inventory.
*/
if (!discovered.some((page) => page.status === 200)) {
  throw new Error('No page.tsx under app/: the page sweeps would have nothing to visit');
}

if (!discovered.some((page) => page.status === 404)) {
  throw new Error(
    'No not-found.tsx under app/: nothing answers an address that was never published',
  );
}

export const renderedPages: readonly RenderedPage[] = discovered;
