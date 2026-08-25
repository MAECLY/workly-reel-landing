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

/** Everything that animates: the hero's timed rise and the scroll-driven reveals. */
const ANIMATED = '.lp-rise, .lp-reveal';

interface MotionState {
  readonly scrollBehavior: string;
  readonly total: number;
  readonly animating: number;
  readonly hidden: number;
}

const motionState = (page: Page): Promise<MotionState> =>
  page.evaluate((selector) => {
    const nodes = Array.from(document.querySelectorAll(selector));
    const styleOf = (node: Element): CSSStyleDeclaration => window.getComputedStyle(node);

    return {
      scrollBehavior: styleOf(document.documentElement).scrollBehavior,
      total: nodes.length,
      animating: nodes.filter((node) => styleOf(node).animationName !== 'none').length,
      hidden: nodes.filter((node) => Number(styleOf(node).opacity) < 1).length,
    };
  }, ANIMATED);

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

    expect(state.total).toBeGreaterThan(0);
    expect(state.animating, 'an animation is still declared under reduce').toBe(0);
    expect(state.hidden, 'content is still waiting for an animation to reveal it').toBe(0);
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

    expect(state.animating, 'nothing animates even with motion allowed').toBe(state.total);
    // The scroll-driven reveals hold their content at zero opacity until they
    // are scrolled into view, so part of the page is always still hidden at
    // this point. Under `reduce` that same count has to be nought.
    expect(state.hidden).toBeGreaterThan(0);
    expect(state.scrollBehavior).toBe('smooth');
  });

  test('is glided to the run block instead', async ({ page }) => {
    const moved = await scrollAcrossTheClick(page);

    expect(moved.after, 'the scroll happened at once rather than over time').toBe(moved.before);
    await expect(page.locator(`#${sectionIds.run}`)).toBeInViewport();
  });
});
