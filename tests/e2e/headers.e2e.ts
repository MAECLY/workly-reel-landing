import { expect, test } from '@playwright/test';

import { SIGNAL_EXPORT, realAsset } from '../../content';
import { renderedPages } from './pages';
import { loadEveryImage, withoutMotion } from './support';

/**
 * What this page is allowed to be, and what it is allowed to reach.
 *
 * A static marketing page has no session to steal and no endpoint to abuse, so
 * its permissions are entirely in its response headers: the policy it
 * publishes, the guards beside it, and the refusal to be indexed while Phase 0
 * is the published thing.
 *
 * `contracts.e2e.ts` already checks that those headers reach every surface,
 * and does it by reading `next.config.ts` - which is the right way to ask
 * whether a promise is kept everywhere, and no way at all to ask whether the
 * promise is still worth making. Delete `frame-ancestors 'none'` from the
 * config and the expectation goes with it: the header still exists, still
 * matches itself on every surface, and the page can be framed by anybody.
 *
 * So the directives are written out here instead, one by one, and read back
 * from the server. This file is the other end of that check, and the place a
 * deliberate change to the policy has to be recorded.
 */

/**
 * The policy, directive by directive.
 *
 * `'unsafe-inline'` appears twice because the framework's bootstrap script and
 * the theme attribute need it; it is a weakness this file records rather than
 * one it can refuse. Everything else is a refusal worth naming: nothing is
 * embedded (`object-src`), nothing is posted anywhere (`form-action`), no
 * injected `<base>` can re-point every relative URL on the page (`base-uri`),
 * and nobody may put this page inside their own (`frame-ancestors`).
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
  'frame-ancestors': ["'none'"],
};

/** The guards beside the policy, pinned to their value rather than to the config. */
const GUARDS: Readonly<Record<string, string>> = {
  'x-robots-tag': 'noindex, nofollow',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

const NO_INDEX = 'noindex';

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

test.describe('the permissions this page publishes', () => {
  for (const target of renderedPages) {
    test(`publishes every directive of its policy on ${target.name}`, async ({ request }) => {
      const response = await request.get(target.path);
      expect(response.status(), `${target.path} did not answer as it is meant to`).toBe(
        target.status,
      );

      const served = response.headers()['content-security-policy'] ?? '';

      expect(served, 'this address publishes no policy at all').not.toBe('');
      expect(
        directivesOf(served),
        'the policy served here is not the one this file records',
      ).toEqual(sorted(POLICY));
    });

    test(`guards ${target.name} with the headers that go beside the policy`, async ({
      request,
    }) => {
      const served = (await request.get(target.path)).headers();

      for (const [header, value] of Object.entries(GUARDS)) {
        expect(served[header] ?? 'nothing', `${target.path} answers ${header}`).toBe(value);
      }

      // Kept by omission, so no comparison of values can notice it going.
      expect('x-powered-by' in served, `${target.path} names the framework it was built with`).toBe(
        false,
      );
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

  test('refuses to be put inside a page belonging to somebody else', async ({ page }) => {
    await page.goto('/');

    /*
      The header text is pinned above; this is the browser being asked to obey
      it. A frame is the one permission whose absence is invisible from the
      outside: the page looks and behaves exactly the same whether or not
      someone else is showing it inside their own, under their own domain and
      beside their own claims about it.

      `about:blank` is framed first as a control. Without it a page that failed
      to embed for any other reason - a typo in the address, a server that had
      stopped answering - would read as a policy being enforced.
    */
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

  test('will not fetch an image for anybody from anywhere but itself', async ({ request }) => {
    const own = realAsset(SIGNAL_EXPORT).file;

    // The optimiser is a URL anyone can call with a URL of their own. Without
    // the refusal it becomes a proxy that fetches arbitrary remote images and
    // serves them from this origin, at this origin's reputation. The address
    // below is unresolvable on purpose: what is asserted is that the request
    // is turned away rather than attempted.
    const foreign = await request.get(
      `/_next/image?url=${encodeURIComponent('https://images.example.invalid/anything.png')}&w=640&q=75`,
    );

    expect(foreign.status(), 'the image optimiser will fetch a foreign origin').toBe(400);

    // The control: the same route, asked for something this site does publish.
    const mine = await request.get(`/_next/image?url=${encodeURIComponent(own)}&w=640&q=75`);
    expect(mine.status(), 'the optimiser refuses this site its own asset').toBe(200);
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
