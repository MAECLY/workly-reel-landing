import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { SIGNAL_EXPORT, hero, notFound, realAsset, sectionIds, skipLink } from '../../content';
import { renderedPages } from './pages';
import { withoutMotion } from './support';

/**
 * What this site does when something is wrong.
 *
 * Everything else in this suite reads a page that exists, from an address that
 * answers, through a link that goes somewhere. The route that handles the
 * opposite of all three had one assertion against it - `contracts.e2e.ts`
 * checks that an unpublished address answers 404 with the right heading - and
 * nothing at all about whether a reader who lands there can see it, read it,
 * use it, or leave.
 *
 * The theme and the motion sweeps now visit this page too, because `pages.ts`
 * puts every route the router renders in front of them. What is left is what
 * only this route can be asked: that it is really an error rather than a page
 * apologising, that it publishes the same things about itself as the page that
 * does exist, that its one way out works, and that a keyboard can take it.
 *
 * The second half is the same question asked of the page that does exist. A
 * link into a section that has been renamed, or a fragment somebody mangled in
 * an email client, is the other way a reader arrives somewhere that is not
 * there.
 */

/** A control the not-found page owes a reader, named where a failure prints it. */
interface DeclaredControl {
  readonly name: string;
  readonly selector: string;
}

/**
 * Everything the browser has to put in the tab order here, in the order the
 * markup declares it.
 *
 * Written down rather than counted on the page, for the reason
 * `keyboard.e2e.ts` sets out at length: an expectation read out of the
 * document describes whatever the document already is, so a control that
 * disappeared would disappear from the expectation with it.
 */
const CONTROLS: readonly DeclaredControl[] = [
  { name: skipLink.label, selector: `a[href="#${skipLink.targetId}"]` },
  /* The toggle is the only control in the banner and both of its labels live
     in the component rather than in `content/`. */
  { name: 'the theme control', selector: 'header button' },
  { name: notFound.action.label, selector: `a[href="${notFound.action.href}"]` },
];

/** Everything the browser would put in the sequential focus order. */
const FOCUSABLE =
  'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/** Enough presses to cross this page twice. */
const TAB_LIMIT = 12;

/** Fragments a reader can arrive on, none of which name anything on the page. */
const BROKEN_FRAGMENTS = [
  /* A section that was renamed, in a link somebody sent a year ago. */
  '#a-section-that-was-removed',
  /* Percent-encoding truncated by whatever the link was pasted through. */
  '#%ZZ',
  /* The shape an injection attempt arrives in, which the page has to ignore. */
  '#"><img src=x onerror=document.title=1>',
  /* A text fragment for text this page does not contain. */
  '#:~:text=nothing%20this%20page%20says',
] as const;

interface Stop {
  /** Position in the declared order, -1 for a control nothing declares, -2 for outside. */
  readonly index: number;
  readonly label: string;
  readonly ringStyle: string;
  readonly ringWidth: number;
}

const OUTSIDE = -2;

const stopAt = (page: Page): Promise<Stop> =>
  page.evaluate(
    (selectors) => {
      const active = document.activeElement;
      const outside =
        active === null || active === document.body || active === document.documentElement;

      if (outside || active === null) {
        return { index: -2, label: 'outside the page', ringStyle: 'none', ringWidth: 0 };
      }

      const style = window.getComputedStyle(active);
      const text = (active.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);

      return {
        index: selectors.findIndex((selector) => active.matches(selector)),
        label: `${active.tagName.toLowerCase()} "${text}"`,
        ringStyle: style.outlineStyle,
        ringWidth: Number.parseFloat(style.outlineWidth),
      };
    },
    CONTROLS.map((control) => control.selector),
  );

/** Press Tab until focus leaves the page, recording every stop on the way. */
const walk = async (page: Page): Promise<readonly Stop[]> => {
  const stops: Stop[] = [];

  for (let press = 0; press < TAB_LIMIT; press += 1) {
    await page.keyboard.press('Tab');
    const stop = await stopAt(page);
    stops.push(stop);

    if (stop.index === OUTSIDE) {
      break;
    }
  }

  return stops;
};

/** Every `<meta>` a document publishes about itself, as one comparable list. */
const metadataOf = (page: Page): Promise<readonly string[]> =>
  page.locator('meta').evaluateAll((nodes) =>
    nodes
      .map((node) => {
        const key = node.getAttribute('name') ?? node.getAttribute('property') ?? '';
        const media = node.getAttribute('media') ?? '';
        return key === ''
          ? ''
          : `${key}${media === '' ? '' : ` ${media}`}=${node.getAttribute('content') ?? ''}`;
      })
      .filter((entry) => entry !== '')
      .sort(),
  );

const notFoundPage = renderedPages.find((target) => target.status === 404);

test.describe('an address Phase 0 never published', () => {
  /*
    The address comes from the inventory the sweeps use, so this file cannot
    end up testing a not-found route the rest of the suite has stopped
    visiting. If the inventory ever loses it, everything below fails at once
    rather than quietly passing against `/`.
  */
  const address = notFoundPage?.path ?? '/';

  test.beforeEach(async ({ page }) => {
    await withoutMotion(page);
  });

  test('is answered by a page written for it, as an error rather than as a page', async ({
    page,
  }) => {
    expect(notFoundPage, 'the page inventory no longer holds a not-found route').toBeDefined();

    const response = await page.goto(address);

    expect(response?.status(), 'an unpublished address was served as a page').toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(notFound.heading);
    await expect(page.getByText(notFound.code, { exact: true })).toBeVisible();
    await expect(page.getByText(notFound.body)).toBeVisible();
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });

  test('arrives already in its theme, with nothing left for a script to paint', async ({
    page,
    request,
  }) => {
    // The route is rendered by a different module from the landing page and
    // could easily be the one that ships without the attribute, which is a
    // white flash in a dark page, on the one screen a reader did not choose to
    // be on.
    const markup = await (await request.get(address)).text();

    expect(markup).toContain('data-theme="dark"');
    await page.goto(address);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('body')).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  });

  test('publishes the same things about itself as the page that does exist', async ({ page }) => {
    await page.goto('/');
    const landing = await metadataOf(page);
    const landingTitle = await page.title();

    await page.goto(address);
    const missing = await metadataOf(page);

    expect(
      landing.length,
      'the landing page publishes no metadata to compare against',
    ).toBeGreaterThan(5);

    // Everything the landing page says about the product - the description,
    // the preview card, the theme colours, the application name - is written
    // in the layout, so a 404 that stopped carrying it would mean the layout
    // had stopped applying to it. Extra entries are allowed: Next writes its
    // own `noindex` here, and `headers.e2e.ts` holds every one of them to
    // refusing.
    expect(
      landing.filter((entry) => !missing.includes(entry)),
      'the not-found page publishes less about itself than the page beside it',
    ).toEqual([]);

    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    expect(await page.title(), 'the not-found page is titled as though it were the page').not.toBe(
      landingTitle,
    );
    expect(await page.title()).toContain('Not found');
  });

  test('offers one way out, and it reaches a page that answers', async ({ page }) => {
    await page.goto(address);

    const out = page.getByRole('link', { name: notFound.action.label });
    await expect(out).toHaveCount(1);

    const [response] = await Promise.all([
      page.waitForResponse((answer) => answer.request().isNavigationRequest()),
      out.click(),
    ]);

    expect(response.status(), 'the way out of the not-found page does not answer').toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(hero.headline);
    expect(new URL(page.url()).pathname).toBe(notFound.action.href);
  });

  test('can be read and left with the keyboard alone', async ({ page }) => {
    await page.goto(address);

    const inventory = await page.evaluate(
      ({ controls, focusable }) => {
        const missing = controls
          .filter((control) => document.querySelectorAll(control.selector).length !== 1)
          .map((control) => `${control.name} is not in the markup exactly once`);

        const declared = controls.flatMap((control) =>
          Array.from(document.querySelectorAll(control.selector)),
        );

        const undeclared = Array.from(document.querySelectorAll(focusable))
          .filter((node) => !declared.includes(node))
          .map((node) => `${node.tagName.toLowerCase()} takes focus and nothing declares it`);

        return { missing, undeclared };
      },
      { controls: CONTROLS, focusable: FOCUSABLE },
    );

    expect(inventory.missing, 'a control this page owes a reader is not there').toEqual([]);
    expect(inventory.undeclared, 'a control reached this page without being declared').toEqual([]);

    // Read the token rather than the number it currently holds: this asserts
    // that focus is indicated, not that it is indicated at two pixels.
    const required = Number.parseFloat(
      await page
        .locator('html')
        .evaluate((node) => window.getComputedStyle(node).getPropertyValue('--wr-focus-width')),
    );
    expect(required).toBeGreaterThan(0);

    const stops = await walk(page);
    const reached = stops.filter((stop) => stop.index !== OUTSIDE);

    expect(stops.at(-1)?.index, 'Tab never left the page: something is holding focus').toBe(
      OUTSIDE,
    );
    expect(
      reached.map((stop) => stop.index),
      reached.map((stop) => stop.label).join(' then '),
    ).toEqual(CONTROLS.map((_, position) => position));
    expect(
      reached
        .filter((stop) => stop.ringStyle === 'none' || stop.ringWidth < required)
        .map((stop) => `${stop.label} shows ${stop.ringStyle} ${stop.ringWidth}px`),
      'a control takes focus without showing where focus went',
    ).toEqual([]);
  });

  test('refuses a file it does not have rather than serving something else', async ({
    request,
  }) => {
    const published = realAsset(SIGNAL_EXPORT).file;
    const missing = published.replace(/\.png$/, '-that-was-never-exported.png');

    const answer = await request.get(missing);

    // A 200 here would be the version of this that hurts: a preview card or an
    // `<img>` pointed at a file that has moved would be served an HTML page
    // with an image content type, and would fail somewhere far away from the
    // cause.
    expect(answer.status(), `${missing} is answered as though it existed`).toBe(404);
    expect(answer.headers()['content-type'] ?? '').not.toContain('image/');

    // The refusal is in the body rather than in a header: the static host sends
    // none, and `404.html` carries the same robots tag every document does.
    expect(await answer.text(), 'the not-found body invites a crawler in').toContain('noindex');

    // The control: the file that is published still is.
    expect((await request.get(published)).status()).toBe(200);
  });
});

test.describe('a link that promised something this page does not have', () => {
  test.beforeEach(async ({ page }) => {
    await withoutMotion(page);
  });

  test('lands on a working page rather than on a broken one', async ({ page }) => {
    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(`the page threw: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        failures.push(`the console reports: ${message.text()}`);
      }
    });

    for (const fragment of BROKEN_FRAGMENTS) {
      /*
        Away and back for each one. Moving between two fragments of the same
        address is a same-document navigation, which answers with no response
        at all, and a status is the first thing worth asserting here.
      */
      await page.goto('about:blank');
      const response = await page.goto(`/${fragment}`);

      expect(response?.status(), `${fragment} was not answered`).toBe(200);
      await expect(
        page.getByRole('heading', { level: 1 }),
        `${fragment} left the page without its heading`,
      ).toHaveText(hero.headline);

      const state = await page.evaluate(() => ({
        scrolled: Math.round(window.scrollY),
        injected: document.querySelectorAll('img[src="x"]').length,
        title: document.title,
      }));

      // A fragment naming nothing is not an instruction to go anywhere, and it
      // is certainly not markup.
      expect(state.scrolled, `${fragment} scrolled the page to something`).toBe(0);
      expect(state.injected, `${fragment} was treated as markup`).toBe(0);
      expect(state.title).not.toBe('1');
    }

    expect(failures, 'a fragment naming nothing broke the page').toEqual([]);
  });

  test('still goes where a fragment that does name something says', async ({ page }) => {
    // The control for the test above: a page that ignored every fragment,
    // including its own, would satisfy it completely.
    await page.goto(`/#${sectionIds.run}`);

    await expect(page.locator(`#${sectionIds.run}`)).toBeInViewport();
  });

  for (const target of renderedPages) {
    test(`leaves no in-page link on ${target.name} pointing at nothing`, async ({ page }) => {
      await page.goto(target.path);

      const dangling = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href^="#"]'))
          .map((node) => (node.getAttribute('href') ?? '').slice(1))
          .filter((id) => id !== '' && document.getElementById(id) === null)
          .map((id) => `a link offers #${id}, and nothing on the page has that id`),
      );

      expect(dangling, 'a link on this page promises a section it does not have').toEqual([]);
    });
  }
});
