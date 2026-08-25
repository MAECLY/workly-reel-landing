import { expect, test } from '@playwright/test';

import { hero, run, sectionIds, workflow } from '../../content';

/**
 * The page with scripting turned off.
 *
 * Every section is a server component and `ScrollAction` is written as a real
 * anchor with a handler bolted on, which together are a claim that the page is
 * readable and navigable without JavaScript. Nothing tested that claim: the
 * rest of the suite runs with scripting on, and with scripting on a page that
 * depends on its client bundle looks exactly like one that does not.
 *
 * The measurements below still evaluate expressions in the page. That is the
 * test harness talking to the browser over the debugging protocol, which keeps
 * working while the document's own scripts are disabled, so the page is being
 * read rather than helped.
 */

test.use({ javaScriptEnabled: false });

const SECTION_IDS = Object.values(sectionIds);

test.describe('the page without JavaScript', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('arrives complete in the first response', async ({ page }) => {
    const rendered = await page
      .locator('main > section')
      .evaluateAll((sections) => sections.map((section) => section.id));

    expect(rendered).toEqual(SECTION_IDS);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(hero.headline);

    const readable = (await page.locator('body').textContent()) ?? '';

    for (const stage of workflow.stages) {
      expect(readable, `the ${stage.name} stage needs a script to appear`).toContain(stage.name);
    }
    for (const step of run.steps) {
      expect(readable, 'a command in the run block needs a script to appear').toContain(
        step.command,
      );
    }
  });

  test('is already in its theme, so no script decides what colour it is', async ({
    page,
    request,
  }) => {
    const markup = await (await request.get('/')).text();

    // In the served document, not written by the provider on hydration. This
    // is what keeps a reader from meeting a light flash or an unpainted page.
    expect(markup).toContain('data-theme="dark"');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('body')).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  });

  test('follows its in-page actions with the browser alone', async ({ page }) => {
    const target = page.locator(`#${sectionIds.run}`);
    await expect(target).not.toBeInViewport();

    await page.getByRole('link', { name: hero.primaryAction.label }).click();

    // The handler marks its destination `tabindex="-1"` before focusing it, so
    // the absence of that attribute is proof that the browser did the
    // navigating and this file is measuring what it says it is. Focus itself is
    // the part a bare fragment link cannot move, and `page.e2e.ts` holds the
    // handler to it with scripting on; here only the arrival is claimed.
    await expect(target).not.toHaveAttribute('tabindex', '-1');
    expect(new URL(page.url()).hash).toBe(`#${sectionIds.run}`);
    await expect(target).toBeInViewport();
    await expect(page.getByRole('heading', { name: run.heading })).toBeInViewport();
  });

  test('reveals the rest of itself on scroll, with no observer holding it back', async ({
    page,
  }) => {
    const stillHidden = (): Promise<number> =>
      page.evaluate(
        () =>
          Array.from(document.querySelectorAll('.lp-reveal')).filter(
            (node) => Number(window.getComputedStyle(node).opacity) < 1,
          ).length,
      );

    // Below the fold and waiting, which is the whole point: if this were nought
    // already the next assertion would prove nothing.
    //
    // Polled rather than read once. The reveal is driven by a `view()` scroll
    // timeline, and until the browser first samples that timeline the computed
    // opacity is still the base 1 - so a single read taken straight after
    // `goto()` sees nothing hidden and fails a precondition that is about to
    // become true. Measured at roughly 3 in 16 runs before this changed.
    await expect
      .poll(stillHidden, { message: 'the reveal timeline was never sampled' })
      .toBeGreaterThan(0);

    await page.keyboard.press('End');

    await expect
      .poll(stillHidden, { message: 'content stayed hidden once it had been scrolled to' })
      .toBe(0);
  });
});
