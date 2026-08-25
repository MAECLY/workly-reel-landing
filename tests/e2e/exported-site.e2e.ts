import { mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';

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
 *
 * The audit reads what a browser would be instructed by without running
 * anything: a stylesheet that pulls a webfont from a CDN, a background image in
 * a `:hover` rule, an SVG that embeds a remote picture. What a script fetches
 * once it runs is a different question and cannot be answered by reading bytes;
 * `tests/e2e/headers.e2e.ts` answers it in a browser instead, in every state
 * the stylesheets declare and across the page's own unloading. Between the two
 * of them there is no file and no moment where a request outward is unobserved.
 */

const ROOT_FOR_TYPES = resolve(import.meta.dirname, '..', '..');

/** Every path under a directory, however deep. */
const filesUnder = (directory: string): readonly string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });

/**
 * A leak of the plainest kind, which every rule in the audit ought to find
 * wherever it is written. Invented: no such account and no such directory.
 */
const A_HOME_DIRECTORY_PATH = 'const root = "/Users/quillstone/Sites/a-project";';

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

  /**
   * That the audit reads the export rather than the file types it expected.
   *
   * The sweep it runs walks `out/` and reads everything it finds, but "reads
   * everything" is a claim about code, and the way this repository has been
   * wrong five times running is a sweep whose author had some file types in
   * mind. So the claim is measured instead: the extensions are taken from the
   * export that was just built, a file carrying an obvious leak is written
   * under each of them, and the audit has to report every one.
   *
   * A new kind of file in the export - a manifest, a feed, a font, a stylesheet
   * nobody thought about - therefore has to be a kind the audit reads, or this
   * goes red. Nothing here names an extension.
   */
  test('is audited whatever kind of file it is made of', () => {
    const published = filesUnder(join(ROOT_FOR_TYPES, 'out'));
    const extensions = [...new Set(published.map((path) => extname(path).toLowerCase()))].sort();

    // An export of one kind of file would make the loop below prove nothing.
    expect(
      extensions.length,
      'the export is made of too few kinds of file to mean this',
    ).toBeGreaterThan(3);

    const directory = mkdtempSync(join(tmpdir(), 'workly-reel-file-types-'));
    const unread: string[] = [];

    try {
      for (const extension of extensions) {
        const name = `a-file${extension === '' ? '' : extension}`;
        writeFileSync(join(directory, name), A_HOME_DIRECTORY_PATH);

        const findings = auditExport(directory, phaseZero());
        if (!findings.some((finding) => finding.file === name)) {
          unread.push(`a file ending "${extension}" was published without being read`);
        }

        rmSync(join(directory, name));
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }

    expect(unread, 'the audit walks past a kind of file this export is made of').toEqual([]);
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
