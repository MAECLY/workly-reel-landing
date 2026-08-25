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
