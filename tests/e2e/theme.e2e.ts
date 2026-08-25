import {
  cssVariableFor,
  darkTheme,
  lightTheme,
  semanticColorNames,
} from '@maecly/workly-reel-ui/tokens';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { showTheme, withoutMotion } from './support';

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
 */

/** What Chromium reports for a colour the element does not paint at all. */
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

/**
 * The two themes are allowed to agree on a colour only where the token
 * document says they do.
 *
 * `text-on-accent` is the one today: the accent is the same colour in both
 * themes, so the text that sits on it has to be too, and the skip link and the
 * primary action are meant to look identical on either side of the toggle.
 * Derived from the generated token document rather than listed here, so a
 * second shared colour later needs no edit to this file, and so a surface
 * cannot be excused by anything the token document does not actually share.
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
   */
  readonly path: string;
  readonly name: string;
  readonly background: string;
  readonly text: string;
  /** The colour of the first side that is actually drawn, if any is. */
  readonly border: string;
}

/**
 * Every colour the page paints, swept from the page itself.
 *
 * This used to be a list of five surfaces, which is a list a new element
 * escapes: `.lp-panel` was not on it, so every specification panel could have
 * stayed dark in the light theme with this file green. Adding `.lp-panel`
 * would only have moved the hole to whatever was added next, so nothing is
 * named here at all and the document decides what is examined.
 */
const paintOf = (page: Page): Promise<readonly Paint[]> =>
  page.evaluate(() => {
    const sides = ['top', 'right', 'bottom', 'left'] as const;

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

    return Array.from(document.querySelectorAll('*')).map((node) => {
      const style = window.getComputedStyle(node);
      const drawn = sides.find(
        (side) => Number.parseFloat(style.getPropertyValue(`border-${side}-width`)) > 0,
      );

      return {
        path: pathOf(node),
        name: nameOf(node),
        background: style.backgroundColor,
        text: style.color,
        border:
          drawn === undefined
            ? 'rgba(0, 0, 0, 0)'
            : style.getPropertyValue(`border-${drawn}-color`),
      };
    });
  });

/**
 * Resolve the shared token colours the way the sweep above reports colours.
 *
 * Read through the browser rather than converted from the hex in the token
 * document, so both sides of the comparison are strings Chromium wrote and no
 * colour-space arithmetic sits between the token and the assertion.
 */
const sharedColours = (page: Page): Promise<readonly string[]> =>
  page.evaluate(
    (variables) => {
      const probe = document.createElement('span');
      probe.style.display = 'none';
      document.body.append(probe);

      const resolved = variables.map((variable) => {
        probe.style.color = `var(${variable})`;
        return window.getComputedStyle(probe).color;
      });

      probe.remove();
      return resolved;
    },
    [...SHARED_VARIABLES],
  );

/** Something the element paints, as opposed to a colour it merely computes. */
const painted = (colour: string, shared: readonly string[]): boolean =>
  colour !== TRANSPARENT && !shared.includes(colour);

const CHANNELS = ['background', 'text', 'border'] as const;

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
  shared: readonly string[],
): readonly string[] => {
  const was = new Map(before.map((paint) => [paint.path, paint]));

  return after.flatMap((paint) => {
    const previous = was.get(paint.path);
    if (previous === undefined) {
      return [];
    }

    return CHANNELS.filter(
      (channel) => painted(paint[channel], shared) && previous[channel] === paint[channel],
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
const paintedCount = (sweep: readonly Paint[], shared: readonly string[]): number =>
  sweep.flatMap((paint) => CHANNELS.filter((channel) => painted(paint[channel], shared))).length;

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

test.describe('the theme control', () => {
  test.beforeEach(async ({ page }) => {
    await withoutMotion(page);
    await page.goto('/');
  });

  test('repaints every surface it paints, rather than only renaming itself', async ({ page }) => {
    const shared = await sharedColours(page);
    const dark = await paintOf(page);
    const darkCanvas = await canvasOf(page);

    // A floor rather than a number: it says the sweep is looking at the page
    // and not at an empty document, without pinning how many surfaces the
    // design happens to have this week.
    expect(paintedCount(dark, shared), 'the sweep found almost nothing painted').toBeGreaterThan(
      100,
    );

    await switchTo(page, 'light');

    // Polled rather than read once. Under reduced motion the package collapses
    // every transition to a hundredth of a millisecond instead of removing it,
    // so the frame in which the attribute changes still reports the colour the
    // page is leaving. Polling measures the theme; a single read measures the
    // frame it happened to land in.
    await expect
      .poll(async () => coloursThatDidNotChange(dark, await paintOf(page), shared), {
        message: 'a surface kept its dark colours after the page was switched to light',
      })
      .toEqual([]);

    // Named separately because the sweep above forgives a colour the token
    // document shares between the themes, and the canvas is the one colour
    // that can never be one of those.
    expect(await canvasOf(page), 'the page is the same colour in both themes').not.toBe(darkCanvas);
  });

  test('puts the page back exactly as it found it', async ({ page }) => {
    const shared = await sharedColours(page);
    const dark = await paintOf(page);

    await switchTo(page, 'light');
    await expect
      .poll(async () => coloursThatDidNotChange(dark, await paintOf(page), shared))
      .toEqual([]);

    await switchTo(page, 'dark');
    await expect
      .poll(async () => coloursThatChanged(dark, await paintOf(page)), {
        message: 'switching back left the page in a third state',
      })
      .toEqual([]);
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
