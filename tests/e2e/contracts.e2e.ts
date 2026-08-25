import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import sitemap from '../../app/sitemap';
import {
  SIGNAL_EXPORT,
  assetProvenance,
  hero,
  notFound,
  proof,
  realAsset,
  site,
} from '../../content';
import nextConfig from '../../next.config';
import { loadEveryImage, showTheme, withoutMotion } from './support';

/**
 * The contracts this page publishes, checked against what it serves.
 *
 * A static page has no routes to interrogate, but it publishes plenty: a
 * sitemap, a robots file, a canonical address, a security policy, a set of
 * response headers, an Open Graph image, and a provenance line naming the
 * commit its design system came from. Each of those is a promise made in one
 * file about something produced by another, and each of them can drift without
 * a single rendering test noticing, because the page still looks right.
 *
 * `metadata.e2e.ts` already reads the documents themselves. What is checked
 * here is the seams between them: whether the address robots advertises is one
 * the server answers, whether the sitemap lists a page that exists and agrees
 * about its own canonical, whether the headers the config promises reach every
 * surface rather than only the page, and whether the version the footer
 * publishes is the version the lockfile installed.
 */

const ROOT = resolve(import.meta.dirname, '..', '..');

/** An address Phase 0 never published, which has to be refused rather than served. */
const UNPUBLISHED = '/phase-one';

/**
 * The exported post copy, which the compositor writes beside the image under
 * the same stem. Derived from the manifest entry rather than typed out, so the
 * pairing is asserted rather than assumed.
 */
const POST_COPY_FILE = realAsset(SIGNAL_EXPORT).file.replace(/\.png$/, '-post.txt');

/**
 * The response headers the site promises, read from the config that declares
 * them rather than copied into this file.
 *
 * Only the rules that apply to every path are taken. Those are the ones every
 * surface below is supposed to keep; a narrower rule added later belongs to
 * the route it names, and this file would have to learn about it rather than
 * silently demand it everywhere.
 */
const promisedHeaders = async (): Promise<readonly { key: string; value: string }[]> => {
  const rules = (await nextConfig.headers?.()) ?? [];

  return rules
    .filter((rule) => rule.source.endsWith(':path*'))
    .flatMap((rule) => rule.headers.map((header) => ({ key: header.key, value: header.value })));
};

const POLICY = 'content-security-policy';

/**
 * One address this site answers, and whether the framework answers it under a
 * policy of its own.
 *
 * Next replaces the configured `Content-Security-Policy` on `/_next/image`
 * with `script-src 'none'; frame-src 'none'; sandbox;`, so an optimised image
 * cannot execute anything even if a crafted file reaches the route. That is
 * stricter than what this site declares rather than a hole in it, so the one
 * surface it applies to is marked here and its policy is held to being the
 * sandbox instead of being held to the promise.
 */
interface Surface {
  readonly path: string;
  readonly sandboxed?: boolean;
}

/** Every `<loc>` a sitemap advertises, in the order it advertises them. */
const advertisedAddresses = (xml: string): readonly string[] =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] ?? '');

const directive = (robots: string, name: string): string | undefined =>
  new RegExp(`^${name}:\\s*(\\S+)$`, 'm').exec(robots)?.[1];

/**
 * Everything a policy on this page is allowed to name as a source.
 *
 * Phase 0 fetches nothing it does not ship. Comparing the served policy
 * against the configured one, as the header check below does, cannot see a
 * relaxation, because relaxing the config relaxes the expectation with it;
 * this is what notices a foreign origin or a wildcard arriving in either.
 * `'unsafe-inline'` is on the list because the framework's own bootstrap
 * script and the theme attribute need it, which is a weakness this file
 * records rather than one it can refuse.
 */
const ALLOWED_SOURCES = new Set(["'self'", "'none'", "'unsafe-inline'", 'data:']);

test.describe('the contracts the page publishes', () => {
  test('sends the headers it promises on every surface it serves', async ({ page, request }) => {
    const promised = await promisedHeaders();
    expect(promised.length, 'the config promises no headers at all').toBeGreaterThan(0);

    await page.goto('/');
    // The optimiser is a surface too, and it is the one nobody thinks of: the
    // page asks for `/_next/image`, not for the file in `public/`, so a header
    // rule that stopped covering it would leave the bytes a reader actually
    // receives outside the policy. Taken from the page rather than composed
    // here, because only the browser knows which variant it asked for.
    const optimised = await page
      .locator('img')
      .first()
      .evaluate((node) => {
        const asked = new URL((node as HTMLImageElement).currentSrc);
        return `${asked.pathname}${asked.search}`;
      });

    expect(optimised, 'the hero image is not being served through the optimiser').toContain(
      '/_next/image',
    );

    const surfaces: readonly Surface[] = [
      { path: '/' },
      { path: '/sitemap.xml' },
      { path: '/robots.txt' },
      { path: realAsset(SIGNAL_EXPORT).file },
      { path: POST_COPY_FILE },
      { path: optimised, sandboxed: true },
      { path: UNPUBLISHED },
    ];

    const broken: string[] = [];

    for (const surface of surfaces) {
      const served = (await request.get(surface.path)).headers();

      for (const header of promised) {
        const answered = served[header.key.toLowerCase()] ?? 'nothing';

        if (surface.sandboxed === true && header.key.toLowerCase() === POLICY) {
          if (!answered.includes('sandbox')) {
            broken.push(`${surface.path} serves an image without sandboxing it: ${answered}`);
          }
          continue;
        }

        if (answered !== header.value) {
          broken.push(`${surface.path} answers ${header.key}: ${answered}`);
        }
      }

      // `poweredByHeader: false` is a promise as much as the list above is,
      // and it is the one that is kept by omission, so nothing else can check
      // it by comparing values.
      if ('x-powered-by' in served) {
        broken.push(`${surface.path} still names the framework it was built with`);
      }
    }

    expect(broken, 'a surface this site publishes is outside the headers it promises').toEqual([]);
  });

  test('advertises in its sitemap only addresses that answer, and agree', async ({
    page,
    request,
  }) => {
    const published = await request.get('/sitemap.xml');
    expect(published.status()).toBe(200);

    // The served document against the module that produced it. The Vitest
    // suite checks the module and `metadata.e2e.ts` checks that the served XML
    // mentions the canonical; neither would notice a second entry appearing in
    // one and not the other.
    const advertised = advertisedAddresses(await published.text());
    expect(advertised).toEqual(sitemap().map((entry) => String(entry.url)));
    expect(advertised.length).toBeGreaterThan(0);

    for (const address of advertised) {
      expect(new URL(address).origin, 'the sitemap advertises another origin').toBe(site.origin);

      // The advertised origin is the production one, which is not what is
      // running here, so the path is asked of the server under test. An
      // address advertised to crawlers and answered with a 404 is the failure
      // this catches.
      const response = await page.goto(new URL(address).pathname);
      expect(response?.status(), `${address} is advertised but does not answer`).toBe(200);
      await expect(
        page.locator('link[rel="canonical"]'),
        `${address} is advertised under an address it does not claim as its own`,
      ).toHaveAttribute('href', address);
    }
  });

  test('points its robots file at a sitemap this server actually serves', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.status()).toBe(200);

    const rules = await robots.text();
    const advertised = directive(rules, 'Sitemap');
    const disallowed = directive(rules, 'Disallow');

    expect(advertised, 'the robots file names no sitemap').toBeDefined();
    expect(disallowed, 'the robots file forbids nothing').toBeDefined();

    // The address is written out in full for crawlers, so only its path can be
    // asked of the server under test. A sitemap advertised at one path and
    // served at another is a working page with a dead promise attached.
    const served = await request.get(new URL(advertised ?? '').pathname);
    expect(served.status(), 'the sitemap robots names is not served there').toBe(200);
    expect(served.headers()['content-type']).toContain('xml');

    // The two files have to describe the same Phase 0: everything the sitemap
    // offers a crawler is something the robots file tells it not to take.
    for (const address of advertisedAddresses(await served.text())) {
      expect(
        new URL(address).pathname.startsWith(disallowed ?? ''),
        `${address} is advertised to crawlers and not refused to them`,
      ).toBe(true);
    }
  });

  test('answers an address it never published with 404, and refuses to have it indexed', async ({
    page,
  }) => {
    const response = await page.goto(UNPUBLISHED);

    // A soft 404, answered 200 with an apology in the body, is the version of
    // this that a crawler would file away as a page. The status is the part of
    // the promise only the server can keep.
    expect(response?.status(), 'an unpublished address was served as a page').toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(notFound.heading);

    // Next writes its own `noindex` for a not-found route and the route writes
    // another, so the document carries two. Neither may be the one that lets it
    // in. This matters more than it looks: the canonical link is written in the
    // layout, so a 404 goes out naming the home page as its canonical, and what
    // keeps that from reading as a page is the status above, these tags, and
    // the `X-Robots-Tag` the header check holds this address to as well.
    const robots = await page
      .locator('meta[name="robots"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('content') ?? ''));

    expect(robots.length).toBeGreaterThan(0);
    expect(robots.filter((content) => !content.includes('noindex'))).toEqual([]);
  });

  test('names no origin but its own in the policy it publishes', async ({ request }) => {
    const policy = (await request.get('/')).headers()[POLICY] ?? '';

    // Every source in every directive, which is everything after the directive
    // name. A policy is a promise about where bytes may come from, and this is
    // that promise reduced to the only question worth asking of it in Phase 0:
    // is anything here not this site.
    const foreign = policy
      .split(';')
      .flatMap((declaration) => declaration.trim().split(/\s+/).slice(1))
      .filter((source) => source !== '' && !ALLOWED_SOURCES.has(source));

    expect(policy, 'the page publishes no policy at all').not.toBe('');
    expect(foreign, 'the policy admits somewhere other than this site').toEqual([]);
  });

  test('raises no violation of the security policy it publishes', async ({ page }) => {
    // Reported by the browser rather than inferred from the policy text: this
    // is the only way to learn that the page has started asking for something
    // its own header forbids. A web font from another origin, an analytics
    // script, or an image proxied through a third party would each arrive here
    // as a blocked request, and nowhere else in the suite as anything at all.
    await page.addInitScript(() => {
      const reported: string[] = [];
      (window as unknown as { policyViolations: string[] }).policyViolations = reported;
      document.addEventListener('securitypolicyviolation', (event) => {
        reported.push(`${event.violatedDirective} blocked ${event.blockedURI}`);
      });
    });

    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(`the page threw: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        failures.push(`the console reports: ${message.text()}`);
      }
    });

    await withoutMotion(page);
    await page.goto('/');
    // Everything the page fetches, it fetches while being read: the lazy
    // figures on scroll, the second theme on the toggle, and the run block on
    // the primary action. A policy is only tested by the requests that happen.
    await loadEveryImage(page);
    await showTheme(page, 'light');
    await page.getByRole('link', { name: hero.primaryAction.label }).click();

    const violations = await page.evaluate(
      () => (window as unknown as { policyViolations: string[] }).policyViolations,
    );

    expect(violations, 'the page asked for something its own policy forbids').toEqual([]);
    expect(failures).toEqual([]);
  });

  test('publishes the design system commit the build actually installed', async ({ page }) => {
    const declared = assetProvenance.designSystemCommit;

    const packaged = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      readonly dependencies: Readonly<Record<string, string>>;
    };
    const pinned = /#([0-9a-f]{40})$/.exec(
      packaged.dependencies['@maecly/workly-reel-ui'] ?? '',
    )?.[1];

    // Four statements of one fact, in four files that are edited at different
    // times: the manifest records the commit the screenshots and the export
    // were produced from, the dependency pins the commit the page is built
    // against, the lockfile records the commit that was installed, and the
    // footer publishes it to a reader as something they can check. Bump the
    // dependency without regenerating the assets and the page goes on
    // attributing them to a design system it no longer consumes.
    expect(pinned, 'the design system is not pinned to a commit').toBe(declared);
    expect(
      readFileSync(join(ROOT, 'pnpm-lock.yaml'), 'utf8').includes(`{commit: ${declared},`),
      'the lockfile resolved the design system to a different commit',
    ).toBe(true);

    await page.goto('/');
    await expect(page.getByRole('contentinfo')).toContainText(declared);
    await expect(page.getByRole('contentinfo')).toContainText(assetProvenance.desktopCommit);
  });

  test('quotes the exported post copy exactly as the file beside the image reads', async ({
    page,
    request,
  }) => {
    const exported = await request.get(POST_COPY_FILE);
    expect(exported.status(), 'the post copy the export produced is not published').toBe(200);

    // `content/proof.ts` says its lines are verbatim from this file, which
    // until now was a claim in a comment. The export writes blank lines
    // between paragraphs and the page renders each paragraph as its own
    // element, so it is the non-empty lines that have to agree.
    const written = (await exported.text())
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');

    expect(written, 'the page quotes post copy the export did not write').toEqual([
      ...proof.postCopy.lines,
    ]);

    await page.goto('/');
    expect(await page.locator('.lp-postcopy__body p').allTextContents()).toEqual(written);
  });
});
