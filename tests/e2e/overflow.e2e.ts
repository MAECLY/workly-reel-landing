import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { renderedPages } from './pages';
import { loadEveryImage, withoutMotion } from './support';

/**
 * Content that does not fit, and whether a reader can still get to it.
 *
 * The specification table and the longest command are wider than a phone and
 * are meant to be: they keep their columns and scroll within their own border
 * rather than reflow into a stack of wrapped dates. That decision is one
 * declaration wide. Change `overflow-x: auto` to `hidden` - the usual answer
 * to an unwanted scrollbar - and every gate in this suite stays green while
 * the right-hand half of the table becomes unreachable at 390: the page still
 * does not scroll sideways, every element still sits inside the viewport, the
 * register is still in the tab order, and axe has nothing to say about it.
 *
 * So the question here is neither what the stylesheet declares nor how the
 * page is laid out, but the reader's: is there content behind that edge, and
 * can it be brought into view.
 */

/** The width the two registers overflow at. Neither does at 1280. */
const PHONE = { width: 390, height: 844 } as const;

interface Clipped {
  /** Named with its page, since the sweep crosses all of them. */
  readonly name: string;
  readonly overflowX: string;
  /** Whether a keyboard can reach the region to scroll it. */
  readonly reachable: boolean;
  /** How far the region will actually travel when asked to scroll to its end. */
  readonly furthest: number;
  /** How far it would have to travel for the last column to be in view. */
  readonly beyond: number;
}

/**
 * Every region that clips content it is wider than, measured by moving it.
 *
 * `overflow-x: visible` is left out: content that spills out of its box is
 * painted and reachable, and the document growing sideways underneath it is
 * `responsive.e2e.ts`'s to refuse. The document itself is left out for the
 * same reason. What is measured here is a box that both hides what it cannot
 * fit and holds more than it shows.
 */
const clippedRegions = (page: Page, pageName: string): Promise<readonly Clipped[]> =>
  page.evaluate((where) => {
    const nameOf = (node: Element): string => {
      const classes = typeof node.className === 'string' ? node.className.trim() : '';
      return `${node.tagName.toLowerCase()}${classes === '' ? '' : `.${classes.split(/\s+/).join('.')}`}`;
    };

    return Array.from(document.body.querySelectorAll('*'))
      .filter((node) => {
        const overflowX = window.getComputedStyle(node).overflowX;
        return overflowX !== 'visible' && node.scrollWidth > node.clientWidth + 1;
      })
      .map((node) => {
        // Asked rather than assumed. A box can report scrollable overflow and
        // still refuse to move, which is what `overflow-x: clip` does, so the
        // only honest reading is to try to scroll it and put it back.
        const resting = node.scrollLeft;
        node.scrollLeft = node.scrollWidth;
        const furthest = node.scrollLeft;
        node.scrollLeft = resting;

        return {
          name: `${nameOf(node)} on ${where}`,
          overflowX: window.getComputedStyle(node).overflowX,
          reachable: node instanceof HTMLElement && node.tabIndex >= 0,
          furthest,
          beyond: node.scrollWidth - node.clientWidth,
        };
      });
  }, pageName);

test.describe('a register wider than the phone it is read on', () => {
  test('can be scrolled to the content it is hiding, on every page', async ({ page }) => {
    await withoutMotion(page);
    await page.setViewportSize({ ...PHONE });

    const clipped: Clipped[] = [];

    for (const target of renderedPages) {
      const response = await page.goto(target.path);
      expect(response?.status(), `${target.path} did not answer as it is meant to`).toBe(
        target.status,
      );

      // The lazy figures decide the height of the page and therefore whether
      // the registers below them have been laid out at all.
      await loadEveryImage(page);
      clipped.push(...(await clippedRegions(page, target.name)));
    }

    // A gate that could only be vacuous is worse than none: if nothing on any
    // page clips anything at a phone width, the list below is empty because
    // there was nothing to examine rather than because everything is reachable,
    // and this file should be rewritten rather than left reporting a pass.
    expect(
      clipped.length,
      'nothing on any page is wider than a phone, so this spec is measuring nothing',
    ).toBeGreaterThan(0);

    const unreachable = clipped.flatMap((region) => {
      const faults: string[] = [];

      if (!['auto', 'scroll'].includes(region.overflowX)) {
        faults.push(
          `${region.name} hides ${region.beyond}px of itself with overflow-x: ${region.overflowX}, so a reader cannot scroll to it`,
        );
      }

      if (region.furthest < region.beyond) {
        faults.push(
          `${region.name} only travels ${region.furthest}px of the ${region.beyond}px it is hiding`,
        );
      }

      if (!region.reachable) {
        faults.push(`${region.name} scrolls, but a keyboard cannot reach it to do so`);
      }

      return faults;
    });

    expect(unreachable, 'content on this page cannot be reached at a phone width').toEqual([]);
  });
});
