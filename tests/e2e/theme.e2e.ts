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

/**
 * Surfaces the two themes have to disagree about.
 *
 * One of each kind that the page is built from: the canvas, the sticky bar
 * with its translucent fill, the display type, the sunken panel, and the
 * footer rule. If a theme reached only the masthead, this list would say so.
 */
const SURFACES = ['body', 'header', 'h1', '.lp-sequence', 'footer'] as const;

interface Paint {
  readonly surface: string;
  readonly colours: string;
}

/**
 * The colours each surface is currently painted in.
 *
 * Background, text, and border together, as one string per surface: the
 * comparison this file makes is only ever "did this change", so a formatted
 * line that a failure can print is more use than five separate numbers.
 */
const paintOf = (page: Page): Promise<readonly Paint[]> =>
  page.evaluate(
    (surfaces) => {
      return surfaces.map((surface) => {
        const node = document.querySelector(surface);

        if (node === null) {
          return { surface, colours: 'not on the page' };
        }

        const style = window.getComputedStyle(node);
        return {
          surface,
          colours: `${style.backgroundColor} / ${style.color} / ${style.borderBottomColor}`,
        };
      });
    },
    [...SURFACES],
  );

const surfacesStillPaintedAs = (
  before: readonly Paint[],
  after: readonly Paint[],
): readonly string[] =>
  after
    .filter((paint, position) => paint.colours === before[position]?.colours)
    .map((paint) => paint.surface);

/** The colour behind everything, which is the one a reader names the theme by. */
const canvasOf = (page: Page): Promise<string> =>
  page.locator('body').evaluate((node) => window.getComputedStyle(node).backgroundColor);

test.describe('the theme control', () => {
  test.beforeEach(async ({ page }) => {
    await withoutMotion(page);
    await page.goto('/');
  });

  test('repaints the page rather than only renaming itself', async ({ page }) => {
    const dark = await paintOf(page);
    const darkCanvas = await canvasOf(page);
    expect(dark.map((paint) => paint.colours)).not.toContain('not on the page');

    await showTheme(page, 'light');

    // Polled rather than read once. Under reduced motion the package collapses
    // every transition to a hundredth of a millisecond instead of removing it,
    // so the frame in which the attribute changes still reports the colour the
    // page is leaving. Polling measures the theme; a single read measures the
    // frame it happened to land in.
    await expect
      .poll(async () => surfacesStillPaintedAs(dark, await paintOf(page)), {
        message: 'a surface kept its dark colours after the page was switched to light',
      })
      .toEqual([]);

    // Named separately because a surface passes the sweep above on any one of
    // its three colours changing, and the canvas is the one that has to.
    expect(await canvasOf(page), 'the page is the same colour in both themes').not.toBe(darkCanvas);
  });

  test('puts the page back exactly as it found it', async ({ page }) => {
    const dark = await paintOf(page);

    await showTheme(page, 'light');
    await expect.poll(async () => surfacesStillPaintedAs(dark, await paintOf(page))).toEqual([]);

    await showTheme(page, 'dark');
    await expect
      .poll(async () => paintOf(page), {
        message: 'switching back left the page in a third state',
      })
      .toEqual(dark);
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
