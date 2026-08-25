import { expect, test } from '@playwright/test';

import { renderedPages } from './pages';
import { loadEveryImage, withoutMotion } from './support';

/**
 * What this page is allowed to be, and what it is allowed to reach.
 *
 * This file used to read response headers. It cannot any more, and the reason
 * is worth stating plainly rather than working around: the site is exported to
 * static files and published by GitHub Pages, which serves files and offers no
 * way to configure a header. Everything that was a header is now either in the
 * document or gone.
 *
 * What moved into the document:
 *   - the Content-Security-Policy, as a `<meta http-equiv>` tag;
 *   - the referrer policy, as a `<meta name="referrer">` tag;
 *   - `noindex, nofollow`, which was always in the markup as well as the header.
 *
 * What is gone, and is asserted nowhere because asserting it would be a lie:
 *   - `frame-ancestors`, which browsers ignore in a meta tag by specification.
 *     The page can be framed. There is a test below that says so out loud.
 *   - `X-Content-Type-Options: nosniff`, which has no meta equivalent at all.
 *
 * Putting Cloudflare in front of the origin restores both as real headers, and
 * `maecly.com` already resolves through Cloudflare. Until that is done, this
 * file describes a site with less protection than the Node server had, because
 * that is the site being published.
 */

/**
 * The policy, directive by directive.
 *
 * `'unsafe-inline'` appears twice because the framework's bootstrap script and
 * the theme attribute need it; it is a weakness this file records rather than
 * one it can refuse. Everything else is a refusal worth naming: nothing is
 * embedded (`object-src`), nothing is posted anywhere (`form-action`), and no
 * injected `<base>` can re-point every relative URL on the page (`base-uri`).
 *
 * `frame-ancestors` is deliberately absent. It is meaningless in a meta tag, so
 * listing it here would make the suite green over a protection that does not
 * exist.
 */
const POLICY: Readonly<Record<string, readonly string[]>> = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'none'"],
};

const NO_INDEX = 'noindex';
const REFERRER = 'strict-origin-when-cross-origin';

/**
 * A policy read as what it means rather than as the string it was written as.
 *
 * Sources are sorted because their order inside a directive says nothing; the
 * directives themselves are compared as a whole, so one going missing, one
 * arriving, and one quietly gaining a source all read as the same kind of
 * failure.
 */
const directivesOf = (policy: string): Readonly<Record<string, readonly string[]>> =>
  Object.fromEntries(
    policy
      .split(';')
      .map((declaration) => declaration.trim())
      .filter((declaration) => declaration !== '')
      .map((declaration) => {
        const [name = '', ...sources] = declaration.split(/\s+/);
        return [name.toLowerCase(), [...sources].sort()];
      }),
  );

const sorted = (policy: Readonly<Record<string, readonly string[]>>) =>
  Object.fromEntries(Object.entries(policy).map(([name, sources]) => [name, [...sources].sort()]));

/** The policy as delivered, taken from the markup rather than from a header. */
const policyIn = (html: string): string =>
  /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/
    .exec(html)?.[1]
    ?.replaceAll('&#x27;', "'") ?? '';

test.describe('the permissions this page publishes', () => {
  for (const target of renderedPages) {
    test(`publishes every directive of its policy on ${target.name}`, async ({ request }) => {
      const response = await request.get(target.path);
      expect(response.status(), `${target.path} did not answer as it is meant to`).toBe(
        target.status,
      );

      const served = policyIn(await response.text());

      expect(served, 'this address publishes no policy at all').not.toBe('');
      expect(
        directivesOf(served),
        'the policy served here is not the one this file records',
      ).toEqual(sorted(POLICY));
    });

    /**
     * The property that makes the difference between a policy and a decoration.
     *
     * A policy delivered by meta tag governs only what the parser meets after
     * it. Next controls the order of its own head and puts preloads, stylesheets
     * and its bootstrap scripts first: measured on a real build the tag landed
     * at position 15, with seven `<script>` tags already ahead of it. So the
     * export is rewritten by `scripts/harden-export.ts` to put the policy first,
     * and this is the check that the rewrite still works after a Next upgrade
     * changes the markup it matches.
     */
    test(`declares its policy before anything it governs on ${target.name}`, async ({
      request,
    }) => {
      const html = await (await request.get(target.path)).text();
      const head = html.slice(html.indexOf('<head'), html.indexOf('</head>'));

      const policyAt = head.indexOf('<meta http-equiv="Content-Security-Policy"');
      expect(policyAt, `${target.path} carries no policy in its head`).toBeGreaterThanOrEqual(0);

      const governed = [...head.matchAll(/<script|<link[^>]+rel="stylesheet"/g)].map(
        (match) => match.index,
      );
      expect(
        governed.filter((at) => at < policyAt).length,
        `${target.path} loads scripts or styles before its policy applies to them`,
      ).toBe(0);
    });

    test(`states its referrer policy in the markup of ${target.name}`, async ({ request }) => {
      const html = await (await request.get(target.path)).text();
      const stated = /<meta name="referrer" content="([^"]*)"/.exec(html)?.[1] ?? 'nothing';

      expect(stated, `${target.path} states no referrer policy`).toBe(REFERRER);
    });

    test(`refuses indexing in the markup of ${target.name}`, async ({ page }) => {
      await page.goto(target.path);

      // Next writes its own tag for the not-found route and the layout writes
      // another, so a document can carry more than one. Every one of them has
      // to refuse: the permissive one is the one a crawler would obey.
      const stated = await page
        .locator('meta[name="robots"]')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('content') ?? ''));

      expect(stated.length, `${target.path} states nothing about indexing`).toBeGreaterThan(0);
      expect(
        stated.filter((content) => !content.includes(NO_INDEX)),
        `${target.path} invites a crawler in while Phase 0 is the published thing`,
      ).toEqual([]);
    });
  }

  /**
   * Expected to fail, and kept because it is expected to fail.
   *
   * A frame is the one permission whose absence is invisible from the outside:
   * the page looks and behaves exactly the same whether or not someone else is
   * showing it inside their own, under their own domain and beside their own
   * claims about it. `frame-ancestors 'none'` is what refused that, and it only
   * works as a real header — browsers ignore it in a meta tag, so the static
   * host cannot send it and the page can be framed by anybody.
   *
   * Deleting this test would leave nothing anywhere recording that the
   * protection was lost. Making it pass against current behaviour would assert
   * that being framed is fine. So it states the intended behaviour and is
   * marked failing: put Cloudflare in front of the origin and restore the
   * header, and this turns green and demands the annotation come off.
   */
  test.fail('refuses to be put inside a page belonging to somebody else', async ({ page }) => {
    await page.goto('/');

    // `about:blank` is framed first as a control. Without it a page that
    // failed to embed for any other reason - a typo in the address, a server
    // that had stopped answering - would read as a policy being enforced.
    const embedded = await page.evaluate(async () => {
      const embed = async (source: string): Promise<string> => {
        const frame = document.createElement('iframe');
        frame.src = source;
        document.body.append(frame);

        await new Promise((resolve) => {
          frame.addEventListener('load', resolve, { once: true });
          setTimeout(resolve, 3000);
        });

        let seen: string;
        try {
          seen = frame.contentDocument === null ? 'refused' : 'rendered';
        } catch {
          seen = 'refused';
        }

        frame.remove();
        return seen;
      };

      return { control: await embed('about:blank'), site: await embed('/') };
    });

    expect(embedded.control, 'a frame this browser did allow could not be read either').toBe(
      'rendered',
    );
    expect(embedded.site, 'this page can be framed by anybody who wants to').toBe('refused');
  });

  /**
   * The one thing static hosting made strictly better.
   *
   * `/_next/image` was a URL anyone could call with a URL of their own, which
   * without a refusal becomes a proxy fetching arbitrary remote images and
   * serving them from this origin, at this origin's reputation. Static export
   * has no optimiser, so the endpoint does not exist and the attack surface is
   * gone rather than guarded. This asserts it stayed gone: turning image
   * optimisation back on without a server would reintroduce it.
   */
  test('publishes no image optimiser for anyone to point at another origin', async ({
    request,
  }) => {
    const response = await request.get(
      `/_next/image?url=${encodeURIComponent('https://images.example.invalid/anything.png')}&w=640&q=75`,
    );

    expect(response.status(), 'an image optimiser answered, so it can be pointed anywhere').toBe(
      404,
    );
  });

  test('asks the network for nothing but itself', async ({ page, baseURL }) => {
    const foreign: string[] = [];

    page.on('request', (request) => {
      const address = request.url();
      if (!address.startsWith(baseURL ?? '') && !address.startsWith('data:')) {
        foreign.push(`${request.resourceType()} from ${address}`);
      }
    });

    await withoutMotion(page);
    await page.goto('/');
    // Everything the page fetches, it fetches while being read.
    await loadEveryImage(page);

    expect(foreign, 'the page reached for something that is not this site').toEqual([]);
  });
});
