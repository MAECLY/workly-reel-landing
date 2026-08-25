import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { withoutMotion } from './support';

/**
 * The page driven by nothing but the keyboard.
 *
 * The accessibility spec proves the skip link works and axe proves the
 * controls are named, but neither walks the document. A control left out of
 * the tab order, a positive `tabindex` that reorders the page, a panel that
 * swallows Tab, and a focus ring someone removed are all invisible to those
 * checks and all fatal to a reader who never touches a pointer. So the whole
 * sequence is walked once in each direction and held to the order the markup
 * declares.
 */

/**
 * Everything the browser puts in the sequential focus order here.
 *
 * The two scrollable registers, the specification panel and the command
 * lines, carry `tabindex="0"` so a keyboard can reach the part of them that
 * overflows; they are as much a stop as the buttons are. `tabindex="-1"` says
 * the opposite, and `ScrollAction` writes exactly that on its destination:
 * reachable by script, deliberately not by Tab.
 */
const FOCUSABLE =
  'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/** Enough presses to cross the page twice. Past that the sequence is a loop. */
const TAB_LIMIT = 40;

interface Stop {
  /** Position in document order, or -1 once focus has left the page. */
  readonly index: number;
  readonly label: string;
  /** How many stops the document offers, so a walk can say what it missed. */
  readonly total: number;
  readonly ringStyle: string;
  readonly ringWidth: number;
}

/**
 * Where focus is now, expressed as a position in the document's own order.
 *
 * An index rather than a selector because the two facts this file needs are
 * both about order: that the sequence visits `0, 1, 2, …` with no gaps, and
 * that walking back retraces it. The label rides along only so a failure
 * names the control rather than a number.
 */
const stopAt = (page: Page): Promise<Stop> =>
  page.evaluate((selector) => {
    const order = Array.from(document.querySelectorAll(selector)).filter(
      (node) => node.getClientRects().length > 0,
    );
    const active = document.activeElement;

    if (active === null || active === document.body || active === document.documentElement) {
      return {
        index: -1,
        label: 'outside the page',
        total: order.length,
        ringStyle: 'none',
        ringWidth: 0,
      };
    }

    const style = window.getComputedStyle(active);
    const text = (active.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);

    return {
      index: order.indexOf(active),
      label: `${active.tagName.toLowerCase()} "${text}"`,
      total: order.length,
      ringStyle: style.outlineStyle,
      ringWidth: Number.parseFloat(style.outlineWidth),
    };
  }, FOCUSABLE);

/** Press one key until focus leaves the page, recording every stop on the way. */
const walk = async (page: Page, key: 'Tab' | 'Shift+Tab'): Promise<readonly Stop[]> => {
  const stops: Stop[] = [];

  for (let press = 0; press < TAB_LIMIT; press += 1) {
    await page.keyboard.press(key);
    const stop = await stopAt(page);
    stops.push(stop);

    if (stop.index < 0) {
      break;
    }
  }

  return stops;
};

const inside = (stops: readonly Stop[]): readonly Stop[] => stops.filter((stop) => stop.index >= 0);

test.describe('the page under the keyboard alone', () => {
  test.beforeEach(async ({ page }) => {
    await withoutMotion(page);
    await page.goto('/');
  });

  test('reaches every control exactly once, in the order the markup declares them', async ({
    page,
  }) => {
    const stops = await walk(page, 'Tab');
    const reached = inside(stops);
    const total = stops[0]?.total ?? 0;

    expect(total).toBeGreaterThan(0);
    expect(stops.at(-1)?.index, 'Tab never left the page: something is holding focus').toBe(-1);
    // One comparison covers three failures at once: a control the sequence
    // never reaches, one it reaches twice, and one a positive `tabindex` has
    // pulled out of source order.
    expect(
      reached.map((stop) => stop.index),
      reached.map((stop) => stop.label).join(' then '),
    ).toEqual(Array.from({ length: total }, (_, position) => position));
  });

  test('lets the keyboard back out, retracing the same stops in reverse', async ({ page }) => {
    const forward = await walk(page, 'Tab');
    const backward = await walk(page, 'Shift+Tab');

    expect(
      backward.at(-1)?.index,
      'Shift+Tab never left the page: something is holding focus',
    ).toBe(-1);
    expect(inside(backward).map((stop) => stop.index)).toEqual(
      [...inside(forward)].reverse().map((stop) => stop.index),
    );
  });

  test('shows the focus ring the design system defines on every stop', async ({ page }) => {
    // Read the token rather than the number it currently holds: this asserts
    // that focus is indicated, not that it is indicated at two pixels.
    const required = Number.parseFloat(
      await page
        .locator('html')
        .evaluate((node) => window.getComputedStyle(node).getPropertyValue('--wr-focus-width')),
    );

    expect(required).toBeGreaterThan(0);

    const unmarked = inside(await walk(page, 'Tab'))
      .filter((stop) => stop.ringStyle === 'none' || stop.ringWidth < required)
      .map((stop) => `${stop.label} shows ${stop.ringStyle} ${stop.ringWidth}px`);

    expect(unmarked, 'a control takes focus without showing where focus went').toEqual([]);
  });

  test('leaves no region that scrolls sideways out of the tab order', async ({ page }) => {
    // Whether a register is overflowing at this particular width is a layout
    // accident: the specification table and the longest command both overflow
    // at 390 and neither does at 1280. What decides the reader's fate is the
    // declaration, so every element that says it may scroll sideways is held
    // to being reachable, at both widths.
    const regions = await page.evaluate(() =>
      Array.from(document.querySelectorAll('*'))
        .filter((node) => ['auto', 'scroll'].includes(window.getComputedStyle(node).overflowX))
        .map((node) => {
          const classes = typeof node.className === 'string' ? node.className.trim() : '';
          return {
            name: `${node.tagName.toLowerCase()}${classes === '' ? '' : `.${classes.split(/\s+/).join('.')}`}`,
            reachable: node instanceof HTMLElement && node.tabIndex >= 0,
          };
        }),
    );

    expect(regions.length, 'nothing on the page scrolls sideways any more').toBeGreaterThan(0);
    expect(
      regions.filter((region) => !region.reachable).map((region) => region.name),
      'a keyboard cannot reach the part of this region that overflows',
    ).toEqual([]);
  });
});
