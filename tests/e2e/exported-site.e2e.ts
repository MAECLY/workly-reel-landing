import { join, resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import { site } from '../../content';
import { auditExport, phaseZero } from '../../scripts/check-export-privacy';

/**
 * The bytes that get uploaded, rather than the page that gets rendered.
 *
 * Everything else in this directory asks a browser what it sees. This asks the
 * export directory what it contains, because `actions/upload-pages-artifact`
 * uploads `out/` wholesale: a file nothing links to is published just as
 * completely as the home page, and a browser would never open it.
 *
 * `pnpm build` runs the same audit, so a leak fails the build before it can
 * reach here. This is the second place it is asked, and the one that puts the
 * answer in a test report rather than in a build log.
 */

const ROOT = resolve(import.meta.dirname, '..', '..');

test.describe('the exported site', () => {
  test('publishes nothing that identifies the machine or the person that built it', () => {
    const findings = auditExport(join(ROOT, 'out'), phaseZero());

    // The findings carry a kind and a position and never the value, so printing
    // them into a report that CI keeps as an artefact republishes nothing.
    expect(
      findings.map(
        (finding) => `${finding.file} (${finding.at}) [${finding.rule}] ${finding.message}`,
      ),
      'the exported site carries something that should not leave this machine',
    ).toEqual([]);
  });

  test('advertises to a link preview the same address it claims as its canonical', async ({
    request,
  }) => {
    /*
      Expected to fail, and left red on purpose.

      `app/layout.tsx` sets `openGraph.url` to `site.canonical`, and
      `tests/metadata.test.ts` asserts that it does. Both are true of the
      metadata object. What is served is not: Next normalises a metadata URL by
      dropping the trailing slash, so the document goes out advertising
      `https://workly-reel.maecly.com` to a link preview while the canonical
      link beside it claims `https://workly-reel.maecly.com/`.

      The layout already works around exactly this normalisation once - the
      canonical link is hand-written in the body for no other reason - so the
      site has decided which of the two addresses is its own, and then publishes
      the other one as the permanent identity Open Graph asks for. That is one
      page claiming two identities to two different readers.

      Writing this assertion the other way round would record the drift as the
      agreement. It is written for the address the site says is its own, and
      marked failing, so it turns green the day `og:url` is made to carry the
      slash rather than the day someone notices this comment.
    */
    test.fail();

    const html = await (await request.get('/')).text();
    const advertised = /<meta property="og:url" content="([^"]*)"/.exec(html)?.[1];

    expect(advertised).toBe(site.canonical);
  });
});
