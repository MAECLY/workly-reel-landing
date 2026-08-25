import { createHash } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { SIGNAL_EXPORT, realAsset, site } from '../../content';

/**
 * What a crawler and a link preview are told.
 *
 * Phase 0 is publicly reachable so the work can be reviewed and deliberately
 * not indexable, and that pair of decisions is only true if the served
 * response says so. The Vitest suite checks the metadata objects; this checks
 * the headers and the documents `next start` actually returns, which is where
 * a config change would break the promise without touching either object.
 */

const NO_INDEX = 'noindex, nofollow';

test.describe('the published metadata', () => {
  test('states one canonical address, with the trailing slash it was agreed with', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', site.canonical);
    expect(site.canonical).toBe('https://workly-reel.maecly.com/');
  });

  test('refuses indexing in the markup and in the response header', async ({ page }) => {
    const response = await page.goto('/');

    expect(response?.headers()['x-robots-tag']).toBe(NO_INDEX);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', NO_INDEX);
  });

  test('offers the real export as its Open Graph image', async ({ page, request }) => {
    const asset = realAsset(SIGNAL_EXPORT);

    await page.goto('/');

    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      `${site.origin}${asset.file}`,
    );
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute(
      'content',
      String(asset.width),
    );
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute(
      'content',
      String(asset.height),
    );
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
      'content',
      asset.alt,
    );

    // The tag advertises the production origin, which is not what is running
    // here, so the same path is fetched from the server under test and the
    // bytes are held to the manifest. A preview card that resolves to a
    // placeholder, or to a re-encoded copy, fails this.
    const served = await request.get(asset.file);
    expect(served.status()).toBe(200);
    expect(served.headers()['content-type']).toBe('image/png');

    const bytes = await served.body();
    expect(bytes.byteLength).toBe(asset.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
  });

  test('publishes a sitemap and a robots file rooted at the agreed origin', async ({ request }) => {
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    expect(sitemap.headers()['content-type']).toContain('xml');
    expect(sitemap.headers()['x-robots-tag']).toBe(NO_INDEX);
    expect(await sitemap.text()).toContain(`<loc>${site.canonical}</loc>`);

    const robots = await request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    expect(robots.headers()['x-robots-tag']).toBe(NO_INDEX);

    const rules = await robots.text();
    expect(rules).toContain('Disallow: /');
    expect(rules).toContain(`Host: ${site.origin}`);
    expect(rules).toContain(`Sitemap: ${site.origin}/sitemap.xml`);
  });
});
