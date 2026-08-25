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
import {
  DOCUMENT_STATES,
  READER_STATES,
  VIEWPORT_WIDTHS,
  loadEveryImage,
  mediaConditionsDeclaredBy,
  pseudoClassesDeclaredBy,
  showTheme,
  withoutMotion,
} from './support';
import { renderedPages } from './pages';

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

const POLICY = 'content-security-policy';

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

/**
 * Every media feature the shipped stylesheets may ask about, and what answers it.
 *
 * Named after the sweep rather than after the feature, because the value of
 * this map is the sentence it lets the test say: this page is written for these
 * conditions, and each of them is one something here actually renders the page
 * in. A feature with no sweep beside it is a rendering nobody has seen.
 */
const FEATURES_THE_SUITE_ENTERS: Readonly<Record<string, string>> = {
  width: 'responsive.e2e.ts, at each of the widths in support.ts',
  'min-width': 'responsive.e2e.ts, at each of the widths in support.ts',
  'max-width': 'responsive.e2e.ts, at each of the widths in support.ts',
  'prefers-reduced-motion': 'motion.e2e.ts, on both sides of the preference',
  'prefers-color-scheme': 'theme.e2e.ts, on both sides of the preference',
};

test.describe('the contracts the page publishes', () => {
  /**
   * Where the policy reaches, now that it is markup rather than a header.
   *
   * A header covered everything the origin served: the document, the sitemap,
   * the robots file, every asset. A meta tag covers the document it is written
   * in and nothing else, so this test asserts both halves of that honestly -
   * the rendered pages carry the policy, and every other surface carries none.
   *
   * The second half is not a pass being manufactured out of a loss. It is the
   * record of which bytes are now served with no policy attached, so that the
   * day someone puts Cloudflare in front of the origin, this is the list of
   * surfaces that gets its protection back.
   */
  test('delivers its policy in every document, and cannot attach it to anything else', async ({
    request,
  }) => {
    const documents = renderedPages.map((page) => page.path);
    const others = [
      '/sitemap.xml',
      '/robots.txt',
      realAsset(SIGNAL_EXPORT).file,
      POST_COPY_FILE,
      UNPUBLISHED,
    ];

    const broken: string[] = [];

    for (const path of documents) {
      const response = await request.get(path);
      const html = await response.text();

      if (!html.includes('http-equiv="Content-Security-Policy"')) {
        broken.push(`${path} is a document that carries no policy`);
      }
      // Kept by omission, and a static host sends none of its own either.
      if ('x-powered-by' in response.headers()) {
        broken.push(`${path} still names the framework it was built with`);
      }
    }

    for (const path of others) {
      const served = (await request.get(path)).headers();
      if (POLICY in served) {
        broken.push(`${path} answers a policy header this host cannot send`);
      }
    }

    expect(broken, 'a surface this site publishes is not as this file records it').toEqual([]);
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
    // Read from the markup, because that is where the policy now lives. A
    // static host attaches no header for it to be read from.
    const html = await (await request.get('/')).text();
    const policy =
      /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/
        .exec(html)?.[1]
        ?.replaceAll('&#x27;', "'") ?? '';

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

  /**
   * The seam between the stylesheets and the sweeps that read them.
   *
   * Every other test in this suite measures the page in some condition. This
   * one asks the opposite question, which is the one that has been missed five
   * times running here: are there conditions the page is written for that
   * nothing measures it in. A rule behind a pseudo-class no driver enters, or a
   * breakpoint with no viewport on either side of it, is a piece of this page
   * that ships to readers and has never been looked at by anything.
   *
   * Both halves are read out of the shipped stylesheets rather than listed, so
   * adding `@media (forced-colors: active)` or a `:target` rule turns this red
   * and asks for a sweep, instead of quietly widening what nobody checks.
   */
  test('declares no state and no breakpoint that its own sweeps never enter', async ({ page }) => {
    await withoutMotion(page);
    await page.goto('/');

    const declared = await pseudoClassesDeclaredBy(page);
    const unaccountedFor = declared.filter(
      (pseudo) => !READER_STATES.includes(pseudo) && !DOCUMENT_STATES.includes(pseudo),
    );

    expect(
      unaccountedFor,
      'a stylesheet declares a pseudo-class that is neither driven as a state nor known to be settled at load',
    ).toEqual([]);
    expect(
      declared.filter((pseudo) => READER_STATES.includes(pseudo)),
      'nothing on this page reacts to a reader at all, which the design system contradicts',
    ).not.toEqual([]);

    const conditions = await mediaConditionsDeclaredBy(page);
    const asked = [
      ...new Set(
        conditions.flatMap((condition) =>
          [...condition.matchAll(/\(\s*([a-z-]+)\s*[:)]/g)].map((match) => match[1] ?? ''),
        ),
      ),
    ];

    expect(
      asked.filter((feature) => FEATURES_THE_SUITE_ENTERS[feature] === undefined),
      'a stylesheet asks the reader something no sweep in this suite ever answers',
    ).toEqual([]);

    // A breakpoint is only exercised if something is measured on each side of
    // it. `1440px` is the widest one the design system writes, and it would be
    // invisible with the widest viewport at 1280.
    const unstraddled = [
      ...new Set(
        conditions.flatMap((condition) =>
          [...condition.matchAll(/\((?:min|max)-width:\s*(\d+)px\)/g)]
            .map((match) => Number(match[1]))
            .filter(
              (breakpoint) =>
                !VIEWPORT_WIDTHS.some((width) => width < breakpoint) ||
                !VIEWPORT_WIDTHS.some((width) => width >= breakpoint),
            )
            .map((breakpoint) => `${breakpoint}px`),
        ),
      ),
    ];

    expect(
      unstraddled,
      'a breakpoint has no viewport measured on one of its two sides, so one of the two layouts it chooses between is never seen',
    ).toEqual([]);
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
