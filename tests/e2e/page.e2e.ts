import { expect, test } from '@playwright/test';

import { hero, realAssets, run, sectionIds, workflow } from '../../content';
import { loadEveryImage } from './support';

/**
 * The page as a browser receives it from `next start`.
 *
 * The Vitest suite renders the same components in jsdom, which cannot say
 * whether an image ever decoded, whether a scroll reached its target, or
 * whether the route answers at all. Every expectation below is read from the
 * content module and the asset manifest, so a section renamed in `content/`
 * fails here rather than being quietly untested.
 */

const SECTION_IDS = Object.values(sectionIds);

test.describe('the Phase 0 page, served the way it is deployed', () => {
  test('answers 200 and carries the five sections and the run block', async ({ page }) => {
    const response = await page.goto('/');

    expect(response, 'the server under test did not answer').not.toBeNull();
    expect(response?.status()).toBe(200);

    const rendered = await page
      .locator('main > section')
      .evaluateAll((sections) => sections.map((section) => section.id));

    expect(rendered).toEqual(SECTION_IDS);
  });

  test('anchors every workflow stage the content module names', async ({ page }) => {
    await page.goto('/');

    for (const stage of workflow.stages) {
      await expect(page.locator(`#${stage.id}`)).toHaveCount(1);
    }
  });

  test('takes the primary action to the run instructions and leaves them in view', async ({
    page,
  }) => {
    await page.goto('/');

    const target = page.locator(`#${sectionIds.run}`);
    await expect(target).not.toBeInViewport();

    await page.getByRole('link', { name: hero.primaryAction.label }).click();

    await expect(target).toBeInViewport();
    await expect(page.getByRole('heading', { name: run.heading })).toBeInViewport();
    // The action moves keyboard focus as well as the viewport, which is the
    // part a bare fragment link gets wrong.
    await expect(target).toBeFocused();
    expect(new URL(page.url()).hash).toBe(`#${sectionIds.run}`);
  });

  test('renders manifest images only, and every one of them decodes', async ({ page }) => {
    await page.goto('/');
    await loadEveryImage(page);

    const rendered = await page.locator('img').evaluateAll((nodes) =>
      nodes.map((node) => {
        const image = node as HTMLImageElement;
        return {
          alt: image.alt,
          declaredWidth: image.getAttribute('width'),
          declaredHeight: image.getAttribute('height'),
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
        };
      }),
    );

    expect(rendered.length).toBeGreaterThan(0);

    for (const image of rendered) {
      const asset = realAssets.find((entry) => entry.alt === image.alt);
      if (asset === undefined) {
        throw new Error(`An image is on the page whose alt text the manifest does not declare`);
      }

      expect(image.naturalWidth, `${asset.file} never decoded`).toBeGreaterThan(0);
      expect(image.declaredWidth).toBe(String(asset.width));
      expect(image.declaredHeight).toBe(String(asset.height));
      // The optimiser serves a resized variant, so the proportion is the only
      // part of the manifest's geometry the rendered bytes can be held to.
      expect(image.naturalWidth / image.naturalHeight).toBeCloseTo(asset.width / asset.height, 2);
    }

    const shown = new Set(rendered.map((image) => image.alt));
    for (const asset of realAssets) {
      expect(shown.has(asset.alt), `${asset.file} is approved but never rendered`).toBe(true);
    }
  });

  test('serves every manifest file at the exact size the manifest records', async ({ page }) => {
    await page.goto('/');

    for (const asset of realAssets) {
      const intrinsic = await page.evaluate(async (file) => {
        const image = new Image();
        image.src = file;
        await image.decode();
        return { width: image.naturalWidth, height: image.naturalHeight };
      }, asset.file);

      expect(intrinsic, `${asset.file} is not the size the manifest claims`).toEqual({
        width: asset.width,
        height: asset.height,
      });
    }
  });
});
