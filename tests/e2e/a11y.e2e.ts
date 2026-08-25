import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { skipLink } from '../../content';
import { renderedPages } from './pages';
import { loadEveryImage, settle, showTheme, withoutMotion } from './support';

/**
 * Accessibility, checked against the rendered page in both themes.
 *
 * The page paints entirely from `--wr-*` properties and the design system
 * redefines those under `[data-theme]`, so a contrast result from one theme
 * says nothing about the other. Both are therefore analysed in the same run,
 * after the toggle has actually flipped the attribute.
 *
 * Only serious and critical findings fail the build. Minor and moderate ones
 * are reported by axe as advice and are not a released-quality bar; anything
 * at serious or above is a defect a reader would meet.
 */

const BLOCKING_IMPACT = new Set(['serious', 'critical']);

const THEMES = ['dark', 'light'] as const;

const blockingViolations = async (page: Page): Promise<readonly string[]> => {
  const results = await new AxeBuilder({ page }).analyze();

  return results.violations
    .filter((violation) => BLOCKING_IMPACT.has(violation.impact ?? ''))
    .flatMap((violation) =>
      violation.nodes.map(
        (node) => `${violation.impact} ${violation.id} on ${node.target.join(' ')}`,
      ),
    );
};

/**
 * Axe, over every page the router renders rather than over the landing page.
 *
 * This was the last sweep in the suite with a page inventory beside it and a
 * hardcoded `/` inside it. One stylesheet paints both routes and the not-found
 * page has surfaces the landing page does not - a status code in monospace, a
 * different lead paragraph - so a contrast failure there was a contrast failure
 * nothing in this repository could see. `tests/e2e/not-found.e2e.ts` holds that
 * page's markup, metadata, theme and keyboard stops, and ran no axe at all.
 */
for (const target of renderedPages) {
  test.describe(`the accessibility of ${target.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await withoutMotion(page);
      const response = await page.goto(target.path);

      expect(response?.status(), `${target.path} did not answer as it is meant to`).toBe(
        target.status,
      );
      await loadEveryImage(page);
    });

    for (const theme of THEMES) {
      test(`reports nothing serious or critical under the ${theme} theme`, async ({ page }) => {
        await showTheme(page, theme);

        // The package transitions colour on the toggle rather than swapping it,
        // and under `reduce` it collapses the duration to a hundredth of a
        // millisecond instead of removing the transition. Axe reads the colour
        // it finds, so a run that lands inside that frame measures a colour no
        // reader ever sees: measured here, three runs in six on the not-found
        // page reported the footer pins at a contrast of 2.06, painted
        // #b4b1ae, while the settled colour is #56524e at better than 6:1.
        // Waiting measures the page rather than the frame; it relaxes nothing.
        await settle(page);

        expect(await blockingViolations(page)).toEqual([]);
      });
    }
  });
}

test.describe('the accessibility of the page', () => {
  test.beforeEach(async ({ page }) => {
    await withoutMotion(page);
    await page.goto('/');
    await loadEveryImage(page);
  });

  test('has one first-level heading and never skips a level', async ({ page }) => {
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll((nodes) =>
      nodes.map((node) => ({
        level: Number(node.tagName.slice(1)),
        text: (node.textContent ?? '').trim().slice(0, 60),
      })),
    );

    expect(headings.length).toBeGreaterThan(0);
    expect(headings.filter((heading) => heading.level === 1)).toHaveLength(1);
    expect(headings[0]?.level).toBe(1);

    let previous = headings[0]?.level ?? 1;
    for (const heading of headings) {
      expect(
        heading.level,
        `"${heading.text}" is an h${heading.level} directly after an h${previous}`,
      ).toBeLessThanOrEqual(previous + 1);
      previous = heading.level;
    }
  });

  test('offers a skip link that reaches the main content', async ({ page }) => {
    // The skip link is the first thing in the body and is off-screen until it
    // takes focus, so the only honest way to find it is with the keyboard.
    await page.keyboard.press('Tab');

    const link = page.getByRole('link', { name: skipLink.label });
    await expect(link).toBeFocused();
    await expect(link).toBeInViewport();

    await link.press('Enter');

    const main = page.locator(`#${skipLink.targetId}`);
    expect(new URL(page.url()).hash).toBe(`#${skipLink.targetId}`);
    await expect(main).toBeInViewport();

    // Following the link has to move the tab sequence as well as the address,
    // or it has skipped nothing.
    await page.keyboard.press('Tab');
    const landedInsideMain = await main.evaluate((node) => node.contains(document.activeElement));
    expect(landedInsideMain).toBe(true);
  });

  test('paints the skip link where it says it is, however it is hidden', async ({ page }) => {
    /*
      The test above proves the link is focusable, reachable, and does its job,
      and `toBeInViewport` proves its box is on screen. None of that is the
      same as a reader seeing it. The link is hidden until it takes focus, and
      the technique doing the hiding is an implementation detail that gets
      refactored: move from `transform` to `clip-path` and leave the
      `:focus-visible` rule reverting the transform, and the box stays exactly
      where it was, in the viewport, focused, and invisible for good.

      So this asks the two questions the box cannot answer. Is the link the
      thing a reader would touch at that point, which no clip or cover survives;
      and does taking focus change what is painted there at all, which nothing
      invisible survives.
    */
    await page.keyboard.press('Tab');

    const link = page.getByRole('link', { name: skipLink.label });
    await expect(link).toBeFocused();
    await expect(link).toBeInViewport();
    await settle(page);

    const box = await link.boundingBox();
    if (box === null) {
      throw new Error('the skip link has no box at all once it has focus');
    }

    const focused = await page.screenshot({ clip: box });

    const topmost = await link.evaluate((node) => {
      const at = node.getBoundingClientRect();
      const found = document.elementFromPoint(at.left + at.width / 2, at.top + at.height / 2);
      return found === null
        ? 'nothing'
        : found === node || node.contains(found)
          ? 'itself'
          : `${found.tagName.toLowerCase()}.${String(found.className)}`;
    });

    expect(topmost, 'something else is what a reader would touch at the skip link').toBe('itself');

    await page.evaluate(() => {
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        active.blur();
      }
    });
    await settle(page);

    const blurred = await page.screenshot({ clip: box });

    expect(
      focused.equals(blurred),
      'the skip link paints nothing a reader can see when it takes focus',
    ).toBe(false);
  });

  test('gives every image a non-empty alt', async ({ page }) => {
    const alts = await page
      .locator('img')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('alt')));

    expect(alts.length).toBeGreaterThan(0);
    for (const alt of alts) {
      expect((alt ?? '').trim()).not.toBe('');
    }
  });
});
