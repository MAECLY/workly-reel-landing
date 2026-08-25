import {
  cssVariableFor,
  darkTheme,
  lightTheme,
  semanticColorNames,
} from '@maecly/workly-reel-ui/tokens';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { renderedPages } from './pages';
import { settle, showTheme, stateDriver, withoutMotion } from './support';

/**
 * The theme control, as a reader meets it.
 *
 * `showTheme` flips the attribute and the accessibility spec runs axe on
 * either side of it, which together prove that the attribute changes and that
 * whatever is painted is legible. Neither proves that anything is repainted.
 * Drop the package's `[data-theme="light"]` block, or start painting the
 * landing layer from a literal instead of a token, and the attribute would
 * still flip, axe would pass twice over the same dark page, and the jsdom
 * suite would not notice either, because jsdom applies no stylesheet at all.
 *
 * Everything below runs against every page the router renders, the not-found
 * page included. It used to run against `/` alone, which made "every surface
 * repaints" a sentence about one route.
 */

/** What Chromium reports for a colour the element does not paint at all. */
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

/** What it reports for an element with no background image or gradient. */
const NO_IMAGE = 'none';

/**
 * A colour no theme contains, used to ask an element where its colour comes
 * from rather than what it currently is.
 */
const SENTINEL = 'rgb(1, 2, 3)';

/**
 * The colours the token document gives both themes the same value.
 *
 * `text-on-accent` is the one today: the accent is the same colour in both
 * themes, so the text that sits on it has to be too, and the skip link and the
 * primary action are meant to look identical on either side of the toggle.
 * Derived from the generated token document rather than listed here, so a
 * second shared colour later needs no edit to this file.
 */
const SHARED_VARIABLES = semanticColorNames
  .filter((name) => darkTheme[name] === lightTheme[name])
  .map(cssVariableFor);

interface Paint {
  /**
   * Where the element sits, rather than what it is called.
   *
   * The two snapshots are taken minutes apart in browser terms and Next
   * appends its route announcer to the body after hydration, so comparing
   * them by position in a list would pair the wrong elements the moment the
   * document grows one. A path pairs an element with itself, and reads well
   * enough in a failure to find the surface in the markup.
   *
   * A generated box carries the same path with `::before` or `::after` on the
   * end, because it is a surface of its own with colours of its own.
   */
  readonly path: string;
  readonly name: string;
  readonly background: string;
  /**
   * The other half of a background.
   *
   * A gradient is a background *image*, and an element painting one reports
   * `rgba(0, 0, 0, 0)` for its background colour, so a sweep that read the
   * colour alone saw a panel repainted in two hardcoded darks as a panel that
   * paints no background at all and compared nothing.
   */
  readonly backgroundImage: string;
  readonly text: string;
  /** The colour of the first side that is actually drawn, if any is. */
  readonly border: string;
}

const CHANNELS = ['background', 'backgroundImage', 'text', 'border'] as const;

/**
 * Every colour the page paints, swept from the page itself.
 *
 * This used to be a list of five surfaces, which is a list a new element
 * escapes: `.lp-panel` was not on it, so every specification panel could have
 * stayed dark in the light theme with this file green. Adding `.lp-panel`
 * would only have moved the hole to whatever was added next, so nothing is
 * named here at all and the document decides what is examined.
 *
 * The generated boxes are swept beside the elements that own them. A `::before`
 * is a surface a reader looks at and paints its own background, its own text
 * and its own border, and the landing layer draws several of its rules with
 * one; a sweep of elements alone would call each of them a colour that is not
 * there. A box whose `content` is `none` is not generated at all and is left
 * out rather than compared against nothing.
 */
const paintOf = (page: Page): Promise<readonly Paint[]> =>
  page.evaluate(() => {
    const sides = ['top', 'right', 'bottom', 'left'] as const;
    const boxes = [null, '::before', '::after'] as const;

    const pathOf = (node: Element): string => {
      const steps: string[] = [];

      for (let step: Element | null = node; step !== null; step = step.parentElement) {
        const parent: Element | null = step.parentElement;
        if (parent === null) {
          break;
        }
        const twins = Array.from(parent.children).filter(
          (child) => child.tagName === step?.tagName,
        );
        const tag = step.tagName.toLowerCase();
        steps.unshift(twins.length > 1 ? `${tag}[${twins.indexOf(step) + 1}]` : tag);
      }

      return steps.join('/');
    };

    const nameOf = (node: Element): string => {
      const classes = typeof node.className === 'string' ? node.className.trim() : '';
      return `${node.tagName.toLowerCase()}${classes === '' ? '' : `.${classes.split(/\s+/).join('.')}`}`;
    };

    return Array.from(document.querySelectorAll('*')).flatMap((node) =>
      boxes.flatMap((box): Paint[] => {
        const style = window.getComputedStyle(node, box);
        if (box !== null && style.content === 'none') {
          return [];
        }

        const drawn = sides.find(
          (side) => Number.parseFloat(style.getPropertyValue(`border-${side}-width`)) > 0,
        );

        return [
          {
            path: `${pathOf(node)}${box ?? ''}`,
            name: `${nameOf(node)}${box ?? ''}`,
            background: style.backgroundColor,
            backgroundImage: style.backgroundImage,
            text: style.color,
            border:
              drawn === undefined
                ? 'rgba(0, 0, 0, 0)'
                : style.getPropertyValue(`border-${drawn}-color`),
          },
        ];
      }),
    );
  });

/** Set or clear the shared tokens on the root, where the themes declare them. */
const overrideShared = async (page: Page, value: string | null): Promise<void> => {
  await page.evaluate(
    ({ variables, colour }) => {
      for (const variable of variables) {
        if (colour === null) {
          document.documentElement.style.removeProperty(variable);
        } else {
          document.documentElement.style.setProperty(variable, colour);
        }
      }
    },
    { variables: [...SHARED_VARIABLES], colour: value },
  );

  await settle(page);
};

/**
 * Which surfaces are painted *from* a shared token, asked of the page rather
 * than inferred from the colour it happens to be.
 *
 * The excuse this list grants used to be granted by colour value: anything
 * painting the same colour as a shared token was forgiven for not changing.
 * That forgives a surface for a fact about its value rather than about where
 * its value comes from, and a border hardcoded to the literal a shared token
 * holds is exactly the case it lets through - it matches, so it is compared
 * against nothing.
 *
 * Overriding the tokens to a colour no theme contains asks the question the
 * other way round. A channel that moves is one the token feeds and is
 * genuinely allowed to be identical in both themes; a channel that sits still
 * under the override is painted from somewhere else, whatever it looks like,
 * and owes this page two colours like every other channel.
 */
const pairsFedByShared = async (page: Page): Promise<ReadonlySet<string>> => {
  const before = await paintOf(page);
  await overrideShared(page, SENTINEL);
  const after = await paintOf(page);
  await overrideShared(page, null);

  const overridden = new Map(after.map((paint) => [paint.path, paint]));

  return new Set(
    before.flatMap((paint) => {
      const now = overridden.get(paint.path);
      if (now === undefined) {
        return [];
      }

      return CHANNELS.filter((channel) => paint[channel] !== now[channel]).map(
        (channel) => `${paint.path}|${channel}`,
      );
    }),
  );
};

/** Something the element paints, as opposed to a colour it merely computes. */
const painted = (value: string): boolean => value !== TRANSPARENT && value !== NO_IMAGE;

/**
 * Every colour that stayed exactly as it was, other than the ones that are
 * meant to.
 *
 * Elements the two snapshots do not have in common are left out rather than
 * guessed at; the count of what was compared is asserted separately, so a
 * sweep that quietly stopped finding anything cannot pass this as agreement.
 */
const coloursThatDidNotChange = (
  before: readonly Paint[],
  after: readonly Paint[],
  fedByShared: ReadonlySet<string>,
): readonly string[] => {
  const was = new Map(before.map((paint) => [paint.path, paint]));

  return after.flatMap((paint) => {
    const previous = was.get(paint.path);
    if (previous === undefined) {
      return [];
    }

    return CHANNELS.filter(
      (channel) =>
        painted(paint[channel]) &&
        !fedByShared.has(`${paint.path}|${channel}`) &&
        previous[channel] === paint[channel],
    ).map((channel) => `${paint.name} still paints its ${channel} ${paint[channel]}`);
  });
};

/** Every colour that changed, which is what a round trip has to undo. */
const coloursThatChanged = (
  before: readonly Paint[],
  after: readonly Paint[],
): readonly string[] => {
  const was = new Map(before.map((paint) => [paint.path, paint]));

  return after.flatMap((paint) => {
    const previous = was.get(paint.path);
    if (previous === undefined) {
      return [];
    }

    return CHANNELS.filter((channel) => previous[channel] !== paint[channel]).map(
      (channel) =>
        `${paint.name} paints its ${channel} ${paint[channel]}, and did ${previous[channel]}`,
    );
  });
};

/** How many colours a sweep found worth comparing at all. */
const paintedCount = (sweep: readonly Paint[]): number =>
  sweep.flatMap((paint) => CHANNELS.filter((channel) => painted(paint[channel]))).length;

/** How many elements the document holds, which the sweep has to keep up with. */
const elementCount = (page: Page): Promise<number> =>
  page.evaluate(() => document.querySelectorAll('*').length);

/** The colour behind everything, which is the one a reader names the theme by. */
const canvasOf = (page: Page): Promise<string> =>
  page.locator('body').evaluate((node) => window.getComputedStyle(node).backgroundColor);

/**
 * Take the pointer off whatever was last clicked, and put the page into one of
 * the two themes.
 *
 * `showTheme` presses the toggle, which leaves the cursor resting on it, and
 * the design system paints a hover fill under a resting cursor. That fill is a
 * fact about the control and nothing to do with the theme, so a sweep taken
 * with the pointer still there reports the toggle as a surface that changed
 * and then would not change back. The corner is empty of anything that reacts
 * to a pointer.
 */
const switchTo = async (page: Page, theme: 'dark' | 'light'): Promise<void> => {
  await showTheme(page, theme);
  await page.mouse.move(0, 0);
};

for (const target of renderedPages) {
  test.describe(`the theme control on ${target.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await withoutMotion(page);
      const response = await page.goto(target.path);

      expect(response?.status(), `${target.path} did not answer as it is meant to`).toBe(
        target.status,
      );
    });

    test('repaints every surface it paints, rather than only renaming itself', async ({ page }) => {
      const dark = await paintOf(page);
      const fedByShared = await pairsFedByShared(page);
      const darkCanvas = await canvasOf(page);

      // A floor drawn from the document rather than a number: it says the
      // sweep is looking at the page and not at an empty one, at whatever size
      // the page happens to be. Nearly every element paints at least the text
      // colour it inherits, so a sweep that has stopped finding surfaces falls
      // under this long before it reaches nothing.
      expect(paintedCount(dark), 'the sweep found almost nothing painted').toBeGreaterThan(
        (await elementCount(page)) / 2,
      );

      await switchTo(page, 'light');

      // Polled rather than read once. Under reduced motion the package collapses
      // every transition to a hundredth of a millisecond instead of removing it,
      // so the frame in which the attribute changes still reports the colour the
      // page is leaving. Polling measures the theme; a single read measures the
      // frame it happened to land in.
      await expect
        .poll(async () => coloursThatDidNotChange(dark, await paintOf(page), fedByShared), {
          message: 'a surface kept its dark colours after the page was switched to light',
        })
        .toEqual([]);

      // Named separately because the sweep above forgives a colour a shared
      // token feeds, and the canvas is the one colour that can never be one of
      // those.
      expect(await canvasOf(page), 'the page is the same colour in both themes').not.toBe(
        darkCanvas,
      );
    });

    test('puts the page back exactly as it found it', async ({ page }) => {
      const dark = await paintOf(page);
      const fedByShared = await pairsFedByShared(page);

      await switchTo(page, 'light');
      await expect
        .poll(async () => coloursThatDidNotChange(dark, await paintOf(page), fedByShared))
        .toEqual([]);

      await switchTo(page, 'dark');
      await expect
        .poll(async () => coloursThatChanged(dark, await paintOf(page)), {
          message: 'switching back left the page in a third state',
        })
        .toEqual([]);
    });

    /**
     * The same question, asked of every state a reader can put the page into.
     *
     * The sweep above reads the page as it loads. Every control on it also has
     * a hover fill, a focus ring and a pressed colour, and the landing layer
     * adds a `:hover` border of its own, so a good part of what a reader
     * actually looks at is painted by a rule the sweep never reached. A hover
     * fill hardcoded to a dark grey would leave every control on the page dark
     * in the light theme under the pointer, and every test in this file green.
     *
     * The states are read out of the shipped stylesheets, so a rule written
     * against a state nobody has used here yet is covered from the moment it
     * exists. Each state is compared against itself across the toggle - the
     * dark hover against the light hover - because a state has its own two
     * colours exactly as the resting surface does.
     */
    test('repaints in every state a reader can put it into', async ({ page }) => {
      const states = await stateDriver(page);

      // A sweep of no states passes on anything at all, and this page is built
      // out of a design system whose every control reacts to a pointer.
      expect(states.reachable, 'the stylesheets declare no state a reader can reach').not.toEqual(
        [],
      );

      const dark = new Map<string, readonly Paint[]>();
      const fedByShared = new Map<string, ReadonlySet<string>>();

      for (const state of states.reachable) {
        await states.enter(state);
        await settle(page);
        dark.set(state, await paintOf(page));
        fedByShared.set(state, await pairsFedByShared(page));
        await states.leave();
      }

      await switchTo(page, 'light');
      await settle(page);

      const stuck: string[] = [];
      for (const state of states.reachable) {
        await states.enter(state);
        await settle(page);
        stuck.push(
          ...coloursThatDidNotChange(
            dark.get(state) ?? [],
            await paintOf(page),
            fedByShared.get(state) ?? new Set(),
          ).map((one) => `with :${state} applied, ${one}`),
        );
        await states.leave();
      }

      expect(stuck, 'a surface kept its dark colours in a state a reader can reach').toEqual([]);
    });

    /**
     * Which of the two themes the page is in is the attribute's business alone.
     *
     * The design system's token document carries a
     * `@media (prefers-color-scheme: dark)` block, so the reader's system has an
     * opinion about this page whether or not anything here asked for one. It is
     * written to defer - the block is scoped to a root that carries no theme
     * attribute - and this page always carries one, so the two must agree.
     *
     * Nothing measured that. Playwright emulates the light preference by
     * default, so every other test in this suite runs on one side of that block
     * and no test in this suite has ever run on the other. A reader whose system
     * is set to dark is most of the readers this page will have.
     */
    test('paints from its own attribute rather than from the reader’s system preference', async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
      await settle(page);
      const preferringLight = await paintOf(page);

      await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
      await settle(page);

      expect(
        coloursThatChanged(preferringLight, await paintOf(page)),
        'the reader’s system preference repainted a page that had already chosen its theme',
      ).toEqual([]);
    });

    test('is operable from the keyboard and says what it will do next', async ({ page }) => {
      const toggle = page.getByRole('banner').getByRole('button');
      const before = await toggle.getAttribute('aria-label');

      // The skip link is the first stop and the toggle the second; the order
      // itself is `keyboard.e2e.ts`'s to defend.
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await expect(toggle).toBeFocused();

      await page.keyboard.press('Enter');

      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      expect(before).not.toBeNull();
      expect(
        await toggle.getAttribute('aria-label'),
        'the control still offers the theme it has just applied',
      ).not.toBe(before);
    });
  });
}
