import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { hero, sectionIds } from '../../content';
import { withMotion, withoutMotion } from './support';

/**
 * Whether asking for less motion changes anything.
 *
 * Three specs open the page with `prefers-reduced-motion: reduce` so their
 * measurements hold still, which means the suite asks for the setting
 * everywhere and nowhere checks that the page listens. Misspell the media
 * query, or move the reveal outside it, and all three keep passing on a page
 * that fades and glides at a reader who asked it not to.
 *
 * Both halves are measured here, because the reduced half only means
 * something next to a page that is otherwise genuinely moving.
 */

/** The classes the landing layer animates, used only to prove the page moves. */
const REVEALED = '.lp-rise, .lp-reveal';

interface MotionState {
  readonly scrollBehavior: string;
  /** Every element declaring an animation, named so a failure can print it. */
  readonly declared: readonly string[];
  /** Every element still held below full opacity by one. */
  readonly faded: readonly string[];
  /** What the browser reports it is actually running, animations and all. */
  readonly running: number;
}

/**
 * Sweep the whole document for motion, rather than the two classes that were
 * expected to carry it.
 *
 * This used to sample `.lp-rise, .lp-reveal` and nothing else, which made the
 * reduced-motion claim "those two classes hold still" while reading as "the
 * page holds still". An animation declared on any other class, outside the
 * `prefers-reduced-motion: no-preference` block, is precisely the accident
 * this spec exists to prevent, and it was the one thing the spec could not
 * see: adding one to `.lp-status` left all ninety tests green.
 *
 * `animationName` rather than a duration, because the design system collapses
 * every duration token to zero under `reduce` and forces
 * `animation-duration: 0.01ms` on everything besides. A declaration written
 * outside the guard therefore survives as a named animation with no time in
 * it, and the name is what says a human wrote it in the wrong place. The two
 * generated boxes are swept as well: a `::before` animates as readily as the
 * element that owns it.
 */
const motionState = (page: Page): Promise<MotionState> =>
  page.evaluate(() => {
    const nameOf = (node: Element): string => {
      const classes = typeof node.className === 'string' ? node.className.trim() : '';
      return `${node.tagName.toLowerCase()}${classes === '' ? '' : `.${classes.split(/\s+/).join('.')}`}`;
    };

    const declared: string[] = [];
    const faded: string[] = [];

    for (const node of Array.from(document.querySelectorAll('*'))) {
      for (const box of [null, '::before', '::after']) {
        const style = window.getComputedStyle(node, box);

        if (style.animationName !== 'none') {
          declared.push(`${nameOf(node)}${box ?? ''} animates ${style.animationName}`);
        }
      }

      if (Number(window.getComputedStyle(node).opacity) < 1) {
        faded.push(nameOf(node));
      }
    }

    return {
      scrollBehavior: window.getComputedStyle(document.documentElement).scrollBehavior,
      declared,
      faded,
      // A second reading of the same question through a different window.
      // `element.animate()` never touches a computed style, so a reveal moved
      // into client JavaScript would leave the sweep above empty.
      running: document.getAnimations().length,
    };
  });

/** How many of the landing layer's own reveals are moving. */
const revealState = (page: Page): Promise<{ total: number; animating: number }> =>
  page.evaluate((selector) => {
    const nodes = Array.from(document.querySelectorAll(selector));

    return {
      total: nodes.length,
      animating: nodes.filter((node) => window.getComputedStyle(node).animationName !== 'none')
        .length,
    };
  }, REVEALED);

/**
 * Follow the hero's primary action and report the scroll position on either
 * side of the click, within the same task.
 *
 * This is the only measurement that can tell the two scroll behaviours apart
 * without a stopwatch: an instant scroll has already moved the document by
 * the time the handler returns, and a smooth one has not moved it at all yet.
 */
const scrollAcrossTheClick = (page: Page): Promise<{ before: number; after: number }> =>
  page.getByRole('link', { name: hero.primaryAction.label }).evaluate((node) => {
    const before = window.scrollY;
    (node as HTMLAnchorElement).click();
    return { before, after: window.scrollY };
  });

test.describe('a reader who has asked for reduced motion', () => {
  test.beforeEach(async ({ page }) => {
    await withoutMotion(page);
    await page.goto('/');
  });

  test('is handed the finished page, with nothing left to animate', async ({ page }) => {
    const state = await motionState(page);

    expect(state.declared, 'an animation is declared outside the reduced-motion guard').toEqual([]);
    expect(state.running, 'the browser is running an animation under reduce').toBe(0);
    expect(state.faded, 'content is still waiting for an animation to reveal it').toEqual([]);
    expect(state.scrollBehavior).toBe('auto');
  });

  test('is put at the run block in one jump rather than glided to it', async ({ page }) => {
    const moved = await scrollAcrossTheClick(page);

    expect(moved.before).toBe(0);
    expect(
      moved.after,
      'the scroll was animated for a reader who asked it not to be',
    ).toBeGreaterThan(moved.before);
    await expect(page.locator(`#${sectionIds.run}`)).toBeInViewport();
  });
});

test.describe('a reader who has asked for nothing', () => {
  test.beforeEach(async ({ page }) => {
    await withMotion(page);
    await page.goto('/');
  });

  test('gets the motion the reduced rendering is measured against', async ({ page }) => {
    const state = await motionState(page);
    const reveals = await revealState(page);

    expect(state.declared.length, 'nothing animates even with motion allowed').toBeGreaterThan(0);
    expect(state.running).toBeGreaterThan(0);
    // Named separately from the sweep: the sweep says something on the page
    // moves, and this says the reveals the landing layer declares are what is
    // moving. Delete the `no-preference` block and the first would still pass
    // on one stray animation elsewhere.
    expect(reveals.total).toBeGreaterThan(0);
    expect(reveals.animating).toBe(reveals.total);
    // The scroll-driven reveals hold their content at zero opacity until they
    // are scrolled into view, so part of the page is always still hidden at
    // this point. Under `reduce` that same list has to be empty.
    expect(state.faded.length).toBeGreaterThan(0);
    expect(state.scrollBehavior).toBe('smooth');
  });

  test('is glided to the run block instead', async ({ page }) => {
    const moved = await scrollAcrossTheClick(page);

    expect(moved.after, 'the scroll happened at once rather than over time').toBe(moved.before);
    await expect(page.locator(`#${sectionIds.run}`)).toBeInViewport();
  });
});
