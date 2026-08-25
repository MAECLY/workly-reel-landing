import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { hero } from '../../content';
import { loadEveryImage, withoutMotion } from './support';

/**
 * Geometry at the four widths the layout is written for.
 *
 * A landing page that scrolls sideways on a phone is broken in a way no unit
 * test can see, because jsdom has no layout. These four widths are the ones
 * the stylesheet changes its mind at: one phone, one tablet, one laptop, and
 * one wide desktop where the shell stops growing and the gutters take over.
 */

const WIDTHS = [390, 768, 1280, 1680] as const;
const VIEWPORT_HEIGHT = 900;

/** WCAG 2.2 target size, minimum. Anything smaller is hard to hit accurately. */
const MINIMUM_TARGET = 24;

/** Five lines of display type is a paragraph wearing a headline's clothes. */
const MAXIMUM_HEADLINE_LINES = 4;

const INTERACTIVE =
  'a[href], button, input, select, textarea, summary, [role="button"], [tabindex="0"]';

/**
 * Elements whose box reaches past the viewport.
 *
 * An element inside a container that scrolls horizontally on purpose is
 * excluded: the specification table and the command lines are meant to keep
 * their shape and scroll within their own border rather than reflow, and the
 * document around them still has to sit still.
 */
const elementsPastTheViewport = async (page: Page): Promise<readonly string[]> =>
  page.evaluate(() => {
    const limit = document.documentElement.clientWidth;

    const describe = (node: Element): string => {
      const id = node.id === '' ? '' : `#${node.id}`;
      const classes = typeof node.className === 'string' ? node.className.trim() : '';
      const selector = classes === '' ? '' : `.${classes.split(/\s+/).join('.')}`;
      return `${node.tagName.toLowerCase()}${id}${selector}`;
    };

    const scrollsOnPurpose = (node: Element): boolean => {
      for (let parent = node.parentElement; parent !== null; parent = parent.parentElement) {
        const overflowX = window.getComputedStyle(parent).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden') {
          return true;
        }
      }
      return false;
    };

    const offenders: string[] = [];
    for (const node of Array.from(document.body.querySelectorAll('*'))) {
      const box = node.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) {
        continue;
      }
      // One physical pixel of slack, because a fractional grid column rounds.
      if (box.right <= limit + 1 && box.left >= -1) {
        continue;
      }
      if (scrollsOnPurpose(node)) {
        continue;
      }
      offenders.push(`${describe(node)} spans ${Math.round(box.left)} to ${Math.round(box.right)}`);
    }
    return offenders;
  });

/** Targets too small to hit. Anything with no box at all is not a target yet. */
const targetsUnderMinimumSize = async (
  page: Page,
  minimum: number,
  selector: string,
): Promise<readonly string[]> =>
  page.evaluate(
    ({ minimumSize, interactive }) =>
      Array.from(document.querySelectorAll(interactive))
        .map((node) => ({ node, box: node.getBoundingClientRect() }))
        .filter(({ box }) => box.width > 0 || box.height > 0)
        .filter(({ box }) => box.width < minimumSize || box.height < minimumSize)
        .map(
          ({ node, box }) =>
            `${node.tagName.toLowerCase()} "${(node.textContent ?? '').trim().slice(0, 40)}" is ${Math.round(box.width)} by ${Math.round(box.height)}`,
        ),
    { minimumSize: minimum, interactive: selector },
  );

/**
 * How many line boxes the headline occupies.
 *
 * A range over the text node reports one rectangle per line, which is the only
 * way to read a wrap count: the element's own height would have to be divided
 * by a line height this stylesheet sets with `clamp`.
 */
const headlineLineCount = async (page: Page, headline: string): Promise<number> =>
  page.getByRole('heading', { level: 1, name: headline }).evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const tops = Array.from(range.getClientRects()).map((box) => Math.round(box.top));
    return new Set(tops).size;
  });

for (const width of WIDTHS) {
  test.describe(`at ${width} pixels wide`, () => {
    test.beforeEach(async ({ page }) => {
      await withoutMotion(page);
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await page.goto('/');
      await loadEveryImage(page);
    });

    test('never scrolls sideways', async ({ page }) => {
      const measured = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
      }));

      expect(measured.scrollWidth).toBeLessThanOrEqual(measured.clientWidth);
      expect(measured.bodyScrollWidth).toBeLessThanOrEqual(measured.clientWidth);
    });

    test('keeps every element inside the viewport', async ({ page }) => {
      expect(await elementsPastTheViewport(page)).toEqual([]);
    });

    test('wraps the headline into no more than four lines', async ({ page }) => {
      const lines = await headlineLineCount(page, hero.headline);

      expect(lines).toBeGreaterThan(0);
      expect(lines).toBeLessThanOrEqual(MAXIMUM_HEADLINE_LINES);
    });

    test('leaves every interactive target at least 24 by 24', async ({ page }) => {
      expect(await targetsUnderMinimumSize(page, MINIMUM_TARGET, INTERACTIVE)).toEqual([]);
    });
  });
}
