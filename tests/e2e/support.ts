import { expect } from '@playwright/test';
import type { CDPSession, Page } from '@playwright/test';

/**
 * Shared setup for the end-to-end specs.
 *
 * Nothing here asserts anything about the product. Each function only puts the
 * page into a state a measurement can be trusted in, so that a spec failure
 * means the page is wrong rather than that the page was still moving.
 *
 * The drivers at the foot of this file are the exception in shape but not in
 * kind: they put the page into every state and through every lifecycle event a
 * reader can, so that the specs which sweep the whole document sweep it in
 * every condition it is ever seen in rather than only in the one it loads in.
 */

/**
 * Ask for the reduced-motion rendering.
 *
 * Every reveal on this page lives inside one
 * `@media (prefers-reduced-motion: no-preference)` block, some of it on a timer
 * and some on a scroll timeline. Sampled halfway through, a heading is a
 * part-faded colour no reader ever sees, and axe reported a different contrast
 * ratio on every run because of it. Under `reduce` the whole block drops out
 * and every element sits at the value the animation was travelling towards,
 * which is both the settled state and the one a reduced-motion reader gets.
 *
 * `page.emulateMedia` rather than `test.use({ reducedMotion })`: the fixture
 * form does not reach the context here, and this is verifiable in one call.
 */
export const withoutMotion = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
};

/**
 * Ask for the rendering a reader who has expressed no preference receives.
 *
 * This is Playwright's default, and stating it anyway is the point: the only
 * spec that calls it measures the page with motion allowed so that the
 * reduced-motion measurement beside it means something. A page that never
 * animates at all would satisfy `withoutMotion` on its own.
 */
export const withMotion = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
};

/**
 * Let whatever the last change started finish moving.
 *
 * The design system transitions colour on its controls, so a value read in the
 * same task as the change that caused it is a value part of the way there: the
 * primary action reported three different greys on three consecutive reads
 * after a token was overridden under it. Under `reduce` the package collapses
 * every duration to a hundredth of a millisecond rather than removing the
 * transition, so a frame is all this has to wait for and the timeout is only
 * slack for a loaded machine.
 */
export const settle = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    for (let frame = 0; frame < 3; frame += 1) {
      await new Promise((resolve) => {
        requestAnimationFrame(() => resolve(null));
      });
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 120);
    });
  });
};

/**
 * Bring every lazily loaded figure into the document.
 *
 * Only the hero image is eager. The rest carry `loading="lazy"`, so their
 * `naturalWidth` stays at zero, and a test that read it without scrolling
 * would report a broken image for a working one.
 */
export const loadEveryImage = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    for (let offset = 0; offset < document.body.scrollHeight; offset += window.innerHeight) {
      window.scrollTo({ top: offset, behavior: 'instant' });
      await new Promise((resolve) => {
        requestAnimationFrame(() => resolve(null));
      });
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });

  await page.waitForFunction(() =>
    Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
  );
};

/**
 * Put the page into one of the two themes the design system ships.
 *
 * The toggle is the only control in the masthead and its two labels are
 * written in the component rather than in `content/`, so it is found by its
 * place in the banner instead of by a string this file would have to keep in
 * step by hand.
 */
export const showTheme = async (page: Page, theme: 'dark' | 'light'): Promise<void> => {
  const root = page.locator('html');

  if ((await root.getAttribute('data-theme')) !== theme) {
    await page.getByRole('banner').getByRole('button').click();
  }

  await expect(root).toHaveAttribute('data-theme', theme);
};

/* ------------------------------------------- the widths the layout is written for -- */

/**
 * The four viewport widths the sweeps measure at.
 *
 * They live here rather than in `responsive.e2e.ts` because two files now need
 * them: the one that measures geometry at each width, and the one in
 * `contracts.e2e.ts` that reads every breakpoint out of the shipped stylesheets
 * and refuses one no width on this list straddles. A breakpoint nothing is
 * measured on either side of is a layout nobody has ever looked at.
 */
export const VIEWPORT_WIDTHS = [390, 768, 1280, 1680] as const;

/* --------------------------------------------------- the states a reader reaches -- */

/**
 * Pseudo-classes whose truth is decided by the reader.
 *
 * This is the CSS specification's list of user-action and input pseudo-classes,
 * not an inventory of what this site uses: which of them this site declares is
 * read out of the shipped stylesheets, and `contracts.e2e.ts` refuses a
 * pseudo-class that appears in neither this list nor the structural one, so a
 * new kind of state cannot arrive unclassified and be swept past in silence.
 */
export const READER_STATES: readonly string[] = [
  'active',
  'autofill',
  'checked',
  'default',
  'disabled',
  'enabled',
  'focus',
  'focus-visible',
  'focus-within',
  'hover',
  'in-range',
  'indeterminate',
  'invalid',
  'link',
  'open',
  'optional',
  'out-of-range',
  'placeholder-shown',
  'read-only',
  'read-write',
  'required',
  'target',
  'user-invalid',
  'user-valid',
  'valid',
  'visited',
];

/**
 * Pseudo-classes that describe where an element sits rather than what is being
 * done to it.
 *
 * These need no driving: they are already true or false of the document as it
 * loads, so a sweep that reads computed style once has already seen whatever
 * they paint. They are listed only so that the coverage check can tell a
 * pseudo-class it has accounted for from one nobody has thought about.
 */
export const DOCUMENT_STATES: readonly string[] = [
  'any-link',
  'defined',
  'dir',
  'empty',
  'first-child',
  'first-of-type',
  'has',
  'host',
  'is',
  'last-child',
  'last-of-type',
  'not',
  'nth-child',
  'nth-last-child',
  'nth-last-of-type',
  'nth-of-type',
  'only-child',
  'only-of-type',
  'root',
  'scope',
  'where',
];

/**
 * Every pseudo-class the loaded stylesheets declare a rule for.
 *
 * Read from the CSSOM rather than from the source, so it covers the design
 * system's stylesheet as completely as the landing layer's own: both are served
 * to a reader, and only one of them is in this repository.
 *
 * Single colon only. `::before` and `::after` are boxes rather than states, and
 * the sweeps that care read them as boxes.
 */
export const pseudoClassesDeclaredBy = async (page: Page): Promise<readonly string[]> => {
  const { declared, unreadable } = await page.evaluate(() => {
    const found = new Set<string>();
    let unreadableSheets = 0;

    const walk = (rules: CSSRuleList): void => {
      for (const rule of Array.from(rules)) {
        const selector = (rule as CSSStyleRule).selectorText;
        if (typeof selector === 'string') {
          for (const match of selector.matchAll(/(?<!:):([a-z][a-z-]*)/g)) {
            found.add(match[1] ?? '');
          }
        }
        const nested = (rule as CSSGroupingRule).cssRules;
        if (nested !== undefined) walk(nested);
      }
    };

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        walk(sheet.cssRules);
      } catch {
        unreadableSheets += 1;
      }
    }

    return { declared: [...found].sort(), unreadable: unreadableSheets };
  });

  // A stylesheet from another origin refuses to be read, and a sweep that
  // quietly skipped one would report a clean page for a page it never saw.
  // Everything this site serves is its own, so this is nought or a defect.
  expect(unreadable, 'a stylesheet on this page could not be read at all').toBe(0);
  expect(declared.length, 'no stylesheet on this page declares anything').toBeGreaterThan(0);

  return declared;
};

/**
 * Every media condition the loaded stylesheets are written against.
 *
 * A media query is a state as surely as `:hover` is: the page is a different
 * page inside one, and a sweep that never emulates the condition has never seen
 * that page. Read from the CSSOM for the same reason the pseudo-classes are -
 * the design system ships a stylesheet of its own, and it is the one carrying
 * the `prefers-color-scheme` block.
 *
 * Media rules only. A container query asks about an element rather than about
 * the reader or the display, and an `@supports` condition asks about the
 * browser; neither is something a sweep can emulate, and both are exercised by
 * whatever renders inside them.
 */
export const mediaConditionsDeclaredBy = async (page: Page): Promise<readonly string[]> => {
  const conditions = await page.evaluate(() => {
    const found = new Set<string>();

    const walk = (rules: CSSRuleList): void => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSMediaRule) found.add(rule.conditionText);
        const nested = (rule as CSSGroupingRule).cssRules;
        if (nested !== undefined) walk(nested);
      }
    };

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        walk(sheet.cssRules);
      } catch {
        /* Counted and refused by `pseudoClassesDeclaredBy`, which reads the same sheets. */
      }
    }

    return [...found].sort();
  });

  expect(
    conditions.length,
    'no stylesheet on this page is written against a media condition',
  ).toBeGreaterThan(0);

  return conditions;
};

/**
 * Puts every element on the page into one state at a time, and takes it out.
 *
 * Chromium is asked to force the state rather than the pointer being moved onto
 * each element in turn, for two reasons. `:hover` matches the element under the
 * pointer *and every ancestor of it*, so a real pointer can never put one
 * element into the state on its own; and an element that is covered, off-screen
 * or zero-sized cannot be pointed at at all, which is exactly where a forgotten
 * rule hides. Forcing reaches all of them, and it is what the browser's own
 * developer tools do, so it is the same code path a person would use by hand.
 *
 * Measured, because the point of a driver is that it drives: forcing `:hover`
 * on a rule carrying a remote background image issued the request for that
 * image, and the forced state is visible to `getComputedStyle`, which is what
 * lets the motion and theme sweeps read the page in it.
 *
 * Chromium only, which this suite is anyway: the whole idea is a Chrome
 * DevTools Protocol command, and `playwright.config.ts` runs no other engine.
 */
export interface StateDriver {
  /** The states the stylesheets declare and the browser agreed to force. */
  readonly reachable: readonly string[];
  /** How many elements each state is forced on, so a caller can say it drove something. */
  readonly elements: number;
  enter(state: string): Promise<void>;
  leave(): Promise<void>;
}

export const stateDriver = async (page: Page): Promise<StateDriver> => {
  const declared = await pseudoClassesDeclaredBy(page);
  const session: CDPSession = await page.context().newCDPSession(page);

  await session.send('DOM.enable');
  await session.send('CSS.enable');
  const { root } = await session.send('DOM.getDocument', { depth: -1, pierce: true });
  const { nodeIds } = await session.send('DOM.querySelectorAll', {
    nodeId: root.nodeId,
    selector: '*',
  });

  const force = async (state: readonly string[]): Promise<void> => {
    await Promise.all(
      nodeIds.map((nodeId) =>
        session.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [...state] }),
      ),
    );
  };

  return {
    reachable: declared.filter((pseudo) => READER_STATES.includes(pseudo)),
    elements: nodeIds.length,
    enter: (state: string) => force([state]),
    leave: () => force([]),
  };
};

/* -------------------------------------------- the events that can carry data away -- */

/**
 * Fire every event this document has asked to be told about.
 *
 * The shape being gated is the commonest analytics there is: a handler on
 * `pagehide` or `visibilitychange` that posts a beacon as the reader leaves.
 * A recording read while the page is still open never sees it, and - measured
 * here rather than assumed - a recording read after a real navigation does not
 * see it either, because Chromium reports neither the request nor the console
 * message once the document that made them is gone. Both windows are empty, so
 * the gate would have been green over a page that phoned home on every visit.
 *
 * So the events are fired into the living document instead, where a handler
 * runs exactly as it would on the way out and everything it asks for is
 * observable. Which events are fired is read off the document rather than
 * listed: whatever it has registered a listener for is what gets dispatched, so
 * a lifecycle event nobody here has heard of is covered from the moment
 * something starts listening for it.
 */
export const throughEveryRegisteredEvent = async (page: Page): Promise<readonly string[]> => {
  const session: CDPSession = await page.context().newCDPSession(page);

  const listenedFor = async (expression: string): Promise<readonly string[]> => {
    const { result } = await session.send('Runtime.evaluate', { expression });
    if (result.objectId === undefined) return [];

    const { listeners } = await session.send('DOMDebugger.getEventListeners', {
      objectId: result.objectId,
    });
    return [...new Set(listeners.map((listener) => listener.type))];
  };

  const onWindow = await listenedFor('window');
  const onDocument = await listenedFor('document');

  await page.evaluate(
    ({ windowEvents, documentEvents }) => {
      for (const type of windowEvents) window.dispatchEvent(new Event(type));
      for (const type of documentEvents) document.dispatchEvent(new Event(type));
    },
    { windowEvents: [...onWindow], documentEvents: [...onDocument] },
  );

  return [...new Set([...onWindow, ...onDocument])];
};

/**
 * Leave the page the way a reader does, and stay somewhere the recording still
 * reaches.
 *
 * The address has to be on the same origin. Measured: a beacon fired on the way
 * out is reported when the browser goes on to another page of this site, and is
 * reported nowhere at all when it goes to `about:blank`, because the recording
 * belongs to the page and `about:blank` is not one.
 */
export const leaveThePage = async (page: Page, to: string): Promise<void> => {
  await page.goto(to);
  await settle(page);
};
