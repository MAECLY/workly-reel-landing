import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Shared setup for the end-to-end specs.
 *
 * Nothing here asserts anything about the product. Each function only puts the
 * page into a state a measurement can be trusted in, so that a spec failure
 * means the page is wrong rather than that the page was still moving.
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
