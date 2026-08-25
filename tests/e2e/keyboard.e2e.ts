import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { hero, run, skipLink } from '../../content';
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
 * A control this page has to offer, named where a failure can print it.
 *
 * `text` is set only where the selector alone would match more than one
 * control, and it comes from `content/` in every case, so a command renamed
 * there fails here rather than going quietly untested.
 */
interface DeclaredControl {
  readonly name: string;
  readonly selector: string;
  readonly text?: string;
}

/**
 * Everything the browser has to put in the sequential focus order here, in the
 * order the markup declares it.
 *
 * Written down rather than counted on the page, which is the whole point. The
 * first version of this file built the expected order from
 * `document.querySelectorAll`, so a control removed from the page was removed
 * from the expectation in the same breath: the total fell by one, the walk
 * still matched, and hiding the skip link with `display: none` left the gate
 * green. An expectation read out of the document can only ever describe
 * whatever the document already is. "Every control is reached" therefore means
 * "each of the controls below, all of which must be here, is reached exactly
 * once".
 *
 * The two scrollable registers, the specification panel and the command lines,
 * carry `tabindex="0"` so a keyboard can reach the part of them that
 * overflows; they are as much a stop as the buttons are. `tabindex="-1"` says
 * the opposite, and `ScrollAction` writes exactly that on its destination:
 * reachable by script, deliberately not by Tab.
 */
const CONTROLS: readonly DeclaredControl[] = [
  { name: skipLink.label, selector: `a[href="#${skipLink.targetId}"]` },
  /*
    The toggle is the only control in the banner and both of its labels are
    written in the component rather than in `content/`, so it is declared by
    its place rather than by a string this file would have to keep in step by
    hand.
  */
  { name: 'the theme control', selector: 'header button' },
  { name: hero.primaryAction.label, selector: `a[href="#${hero.primaryAction.targetId}"]` },
  { name: hero.secondaryAction.label, selector: `a[href="#${hero.secondaryAction.targetId}"]` },
  { name: 'the selection-mode table, which scrolls sideways', selector: '.lp-panel__scroll' },
  ...run.steps.map((step) => ({ name: step.command, selector: 'pre', text: step.command })),
];

/** Everything the browser would put in the sequential focus order. */
const FOCUSABLE =
  'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/** Enough presses to cross the page twice. Past that the sequence is a loop. */
const TAB_LIMIT = 40;

/** How the document answers the declaration above. Every list has to be empty. */
interface Inventory {
  readonly missing: readonly string[];
  readonly outOfOrder: readonly string[];
  readonly undeclared: readonly string[];
  /** How many declared controls the document actually offers a keyboard. */
  readonly present: number;
}

interface Stop {
  /** Position in the declared order, or -1 for a control it does not name. */
  readonly index: number;
  /** True once focus has left the page altogether. */
  readonly outside: boolean;
  readonly label: string;
  readonly ringStyle: string;
  readonly ringWidth: number;
}

interface Reading {
  readonly inventory: Inventory;
  readonly stop: Stop;
}

/**
 * Resolve the declaration against the document, and say where focus is in
 * terms of it.
 *
 * Both halves come from one call because they have to agree: the position a
 * stop reports is a position in the same resolved list the inventory reports
 * on, so a walk can never be compared against a different reading of the page
 * than the one it was measured in.
 */
const readPage = (page: Page): Promise<Reading> =>
  page.evaluate(
    ({ controls, focusable }) => {
      const nameOf = (node: Element): string => {
        const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
        return `${node.tagName.toLowerCase()} "${text}"`;
      };

      const claimed: Element[] = [];
      const present: Element[] = [];
      const missing: string[] = [];

      for (const control of controls) {
        const found = Array.from(document.querySelectorAll(control.selector)).filter(
          (node) => control.text === undefined || (node.textContent ?? '').trim() === control.text,
        );
        claimed.push(...found);

        const only = found.length === 1 ? found[0] : undefined;
        if (only === undefined) {
          missing.push(`${control.name} is in the markup ${found.length} times rather than once`);
          continue;
        }

        /*
          `checkVisibility` rather than a rectangle. The skip link sits at
          `translateY(-200%)` until it takes focus and still reports one, so a
          rectangle cannot tell a control parked off-screen from a control that
          has been taken out of the tab order with `display: none`.
        */
        if (!(only instanceof HTMLElement) || !only.checkVisibility({ visibilityProperty: true })) {
          missing.push(`${control.name} is in the markup but is not rendered`);
          continue;
        }

        present.push(only);
      }

      const outOfOrder: string[] = [];
      let previous: Element | undefined;
      for (const node of present) {
        if (
          previous !== undefined &&
          (previous.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) === 0
        ) {
          outOfOrder.push(
            `${nameOf(node)} appears earlier in the markup than the control before it`,
          );
        }
        previous = node;
      }

      const undeclared = Array.from(document.querySelectorAll(focusable))
        .filter((node) => !claimed.includes(node))
        .map((node) => `${nameOf(node)} takes focus and nothing declares it`);

      const active = document.activeElement;
      const outside =
        active === null || active === document.body || active === document.documentElement;

      if (outside || active === null) {
        return {
          inventory: { missing, outOfOrder, undeclared, present: present.length },
          stop: {
            index: -1,
            outside: true,
            label: 'outside the page',
            ringStyle: 'none',
            ringWidth: 0,
          },
        };
      }

      const style = window.getComputedStyle(active);

      return {
        inventory: { missing, outOfOrder, undeclared, present: present.length },
        stop: {
          index: present.indexOf(active),
          outside: false,
          label: nameOf(active),
          ringStyle: style.outlineStyle,
          ringWidth: Number.parseFloat(style.outlineWidth),
        },
      };
    },
    { controls: CONTROLS, focusable: FOCUSABLE },
  );

const stopAt = async (page: Page): Promise<Stop> => (await readPage(page)).stop;

/** Press one key until focus leaves the page, recording every stop on the way. */
const walk = async (page: Page, key: 'Tab' | 'Shift+Tab'): Promise<readonly Stop[]> => {
  const stops: Stop[] = [];

  for (let press = 0; press < TAB_LIMIT; press += 1) {
    await page.keyboard.press(key);
    const stop = await stopAt(page);
    stops.push(stop);

    if (stop.outside) {
      break;
    }
  }

  return stops;
};

const inside = (stops: readonly Stop[]): readonly Stop[] => stops.filter((stop) => !stop.outside);

/** The positions a complete walk has to report, in order and with no gaps. */
const EVERY_POSITION = CONTROLS.map((_, position) => position);

test.describe('the page under the keyboard alone', () => {
  test.beforeEach(async ({ page }) => {
    await withoutMotion(page);
    await page.goto('/');
  });

  test('offers each declared control once, and nothing else that takes focus', async ({ page }) => {
    const { inventory } = await readPage(page);

    expect(inventory.missing, 'a control this page promises is not there to be reached').toEqual(
      [],
    );
    expect(inventory.outOfOrder, 'the markup no longer declares them in this order').toEqual([]);
    // The other half of the same claim. Without it the declaration above could
    // fall behind the page: a control added and never declared would be walked
    // past by every test in this file without one of them noticing.
    expect(inventory.undeclared, 'a control reached this page without being declared').toEqual([]);
    expect(inventory.present).toBe(CONTROLS.length);
  });

  test('reaches every control exactly once, in the order the markup declares them', async ({
    page,
  }) => {
    const stops = await walk(page, 'Tab');
    const reached = inside(stops);

    expect(stops.at(-1)?.outside, 'Tab never left the page: something is holding focus').toBe(true);
    // One comparison covers four failures at once: a control the sequence
    // never reaches, one it reaches twice, one a positive `tabindex` has
    // pulled out of source order, and one that takes focus without being
    // declared, which arrives here as -1.
    expect(
      reached.map((stop) => stop.index),
      reached.map((stop) => stop.label).join(' then '),
    ).toEqual(EVERY_POSITION);
  });

  test('lets the keyboard back out, retracing the same stops in reverse', async ({ page }) => {
    const forward = await walk(page, 'Tab');
    const backward = await walk(page, 'Shift+Tab');

    expect(
      backward.at(-1)?.outside,
      'Shift+Tab never left the page: something is holding focus',
    ).toBe(true);
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

    const walked = inside(await walk(page, 'Tab'));
    expect(walked).toHaveLength(CONTROLS.length);

    const unmarked = walked
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
