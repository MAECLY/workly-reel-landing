import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { skipLink } from '../../content';
import { loadEveryImage, showTheme, withoutMotion } from './support';

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

test.describe('the accessibility of the page', () => {
  test.beforeEach(async ({ page }) => {
    await withoutMotion(page);
    await page.goto('/');
    await loadEveryImage(page);
  });

  for (const theme of THEMES) {
    test(`reports nothing serious or critical under the ${theme} theme`, async ({ page }) => {
      await showTheme(page, theme);

      expect(await blockingViolations(page)).toEqual([]);
    });
  }

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
