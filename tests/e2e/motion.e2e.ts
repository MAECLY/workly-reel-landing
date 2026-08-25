import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { hero, sectionIds } from '../../content';
import { renderedPages } from './pages';
import { settle, stateDriver, withMotion, withoutMotion } from './support';

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
 *
 * The reduced half is asked of every page the router renders. It used to be
 * asked of `/` alone, and one stylesheet paints every route: an animation on
 * `.lp-notfound__code`, declared outside the guard, is on a class the landing
 * page never uses and was therefore on no page this spec opened.
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

/**
 * The same sweep again, once for every state a reader can put an element into.
 *
 * The sweep above reads the page as it loads, which is the one condition an
 * animation is least likely to be forgotten in. `.lp-figure__frame:hover` is
 * already a rule in the landing layer; an `animation` added beside the
 * `border-color` in it, outside the reduced-motion guard, would move under
 * every pointer and appear in no measurement anywhere in this repository.
 *
 * Which states are entered is read out of the shipped stylesheets rather than
 * named here, so a rule written against a state nobody has used yet is swept
 * from the moment it exists.
 *
 * Only what is *declared* is collected. What the browser reports as running is
 * deliberately not, and the reason is a property of the design system rather
 * than an excuse: entering a state changes colours, the package transitions
 * colour on its controls, and under `reduce` it collapses those transitions to
 * a hundredth of a millisecond instead of removing them. So a state entered
 * always has transitions briefly in flight, and counting them would fail on
 * correct behaviour. A declared `animation-name` cannot be explained that way:
 * the package forces `animation-duration` to nothing under `reduce`, so a name
 * surviving there is a human writing a declaration in the wrong place.
 */
const animationsDeclaredInEveryState = async (
  page: Page,
): Promise<{ readonly found: readonly string[]; readonly states: readonly string[] }> => {
  const states = await stateDriver(page);
  const found: string[] = [];

  for (const state of states.reachable) {
    await states.enter(state);
    const { declared } = await motionState(page);
    for (const one of declared) found.push(`with :${state} applied, ${one}`);
    await states.leave();
  }

  return { found, states: states.reachable };
};

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

for (const target of renderedPages) {
  test.describe(`a reader who has asked for reduced motion, on ${target.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await withoutMotion(page);
      const response = await page.goto(target.path);

      expect(response?.status(), `${target.path} did not answer as it is meant to`).toBe(
        target.status,
      );

      // The package keeps its transitions under `reduce` and collapses them to
      // a hundredth of a millisecond, so a page read in the same task as its
      // own arrival still has one or two in flight and the count below is not
      // yet nought. Measured: this failed on roughly one run in sixteen, on
      // the not-found page, before this line existed. Waiting measures the
      // settled page, which is what the test claims to be reading; it changes
      // nothing about what is asserted.
      await settle(page);
    });

    test('is handed the finished page, with nothing left to animate', async ({ page }) => {
      const state = await motionState(page);

      expect(state.declared, 'an animation is declared outside the reduced-motion guard').toEqual(
        [],
      );
      expect(state.running, 'the browser is running an animation under reduce').toBe(0);
      expect(state.faded, 'content is still waiting for an animation to reveal it').toEqual([]);
      expect(state.scrollBehavior).toBe('auto');
    });

    test('holds still in every state a reader can put it into', async ({ page }) => {
      const { found, states } = await animationsDeclaredInEveryState(page);

      // A sweep of no states is a sweep that passes on anything, and this page
      // is built from a design system whose controls all have a hover fill.
      expect(states, 'the stylesheets declare no state a reader can reach').not.toEqual([]);
      expect(
        found,
        'an animation is declared outside the reduced-motion guard, in a state the page is only read in under a pointer or a keyboard',
      ).toEqual([]);
    });
  });
}

test.describe('a reader who has asked for reduced motion', () => {
  test.beforeEach(async ({ page }) => {
    await withoutMotion(page);
    await page.goto('/');
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
