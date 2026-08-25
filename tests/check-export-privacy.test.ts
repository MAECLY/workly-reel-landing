import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { auditExport, type ExportExpectations } from '../scripts/check-export-privacy';

/**
 * Proof that the export privacy gate can fail.
 *
 * `scripts/check-export-privacy.ts` finds nothing in the real `out/`, and a
 * gate that finds nothing is indistinguishable from a gate that looks at
 * nothing. Every rule in it is therefore shown here catching the thing it was
 * written for, and the clean fixture is shown passing, so a regex that stops
 * matching is a red test rather than a quieter build.
 *
 * Every value below is invented. None of these hosts resolve, none of these
 * repositories exist, none of these accounts belong to anybody, and the tokens
 * are the right shape and nothing else. That is the whole point of the phase
 * this file belongs to: a test written to prove a leak detector works must not
 * be the leak.
 */

/** An invented site. `.invalid` is reserved by RFC 2606 and can never resolve. */
const ORIGIN = 'https://phase-zero.example.invalid';

const expectations: ExportExpectations = {
  origin: ORIGIN,
  canonical: `${ORIGIN}/`,
  customDomain: 'phase-zero.example.invalid',
  sitemapAddresses: [`${ORIGIN}/`],
  publishedAddresses: ['git@example.invalid'],
  builderTerms: ['quillstone', 'ashfield-desk'],
};

const CLEAN_DOCUMENT = [
  '<!DOCTYPE html><html lang="en"><head>',
  '<meta http-equiv="Content-Security-Policy" content="default-src &#x27;self&#x27;"/>',
  '<meta charSet="utf-8"/>',
  '<meta name="robots" content="noindex, nofollow"/>',
  '<meta property="og:type" content="website"/>',
  `<meta property="og:url" content="${ORIGIN}/"/>`,
  '<meta property="og:title" content="A page"/>',
  '<meta property="og:description" content="A description."/>',
  '<meta property="og:site_name" content="A site"/>',
  `<meta property="og:image" content="${ORIGIN}/assets/card.png"/>`,
  '<meta property="og:image:alt" content="A card."/>',
  '<meta property="og:image:width" content="1080"/>',
  '<meta property="og:image:height" content="1350"/>',
  '<meta name="twitter:card" content="summary_large_image"/>',
  '<meta name="twitter:title" content="A page"/>',
  '<meta name="twitter:description" content="A description."/>',
  `<meta name="twitter:image" content="${ORIGIN}/assets/card.png"/>`,
  '</head><body>',
  `<link rel="canonical" href="${ORIGIN}/"/>`,
  // A quoted clone command, which is the one address the fixture publishes on
  // purpose. It is here so the email rule is shown letting the exemption
  // through rather than only shown catching things.
  '<pre><code>git clone git@example.invalid:someone/a-project.git</code></pre>',
  // An icon, so the private-address rule is shown surviving a long run of
  // digits and full stops. This is the shape that made the first draft of that
  // rule report a leak on every page that drew anything.
  '<svg viewBox="0 0 256 256"><path d="M22.91,103.57A6,6,0,0,0,20,107.62l30.42,17.33.42.71.12,34.31Z"/></svg>',
  '</body></html>',
].join('');

const CLEAN_ROBOTS = [
  'User-Agent: *',
  'Disallow: /',
  '',
  `Host: ${ORIGIN}`,
  `Sitemap: ${ORIGIN}/sitemap.xml`,
  '',
].join('\n');

const CLEAN_SITEMAP = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  `<url><loc>${ORIGIN}/</loc><priority>1</priority></url>`,
  '</urlset>',
].join('\n');

/* ---------------------------------------------------------- PNG fixtures -- */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** One chunk, framed the way the format requires so the gate's parser accepts it. */
const chunk = (type: string, data: Buffer): Buffer => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
};

/**
 * A one-pixel PNG, plus whatever metadata a test wants to attach to it.
 *
 * Real bytes rather than a stub, because the thing under test is a chunk
 * parser: a fixture that only looked like a PNG would prove the parser reads
 * fixtures rather than that it reads images.
 */
const png = (extra: readonly Buffer[] = []): Buffer => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    ...extra,
    chunk('IDAT', deflateSync(Buffer.from([0, 0, 0, 0, 0]))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const textChunk = (keyword: string, value: string): Buffer =>
  chunk(
    'tEXt',
    Buffer.concat([Buffer.from(`${keyword}\0`, 'latin1'), Buffer.from(value, 'latin1')]),
  );

const xmpChunk = (body: string): Buffer =>
  chunk(
    'iTXt',
    Buffer.concat([
      Buffer.from('XML:com.adobe.xmp\0\0\0\0\0', 'latin1'),
      Buffer.from(body, 'utf8'),
    ]),
  );

/**
 * A big-endian TIFF block holding one ASCII tag, which is all an EXIF chunk is.
 * `0x013b` is Artist and `0xa002` is PixelXDimension, so the same builder makes
 * both the fixture that must fail and the fixture that must not.
 */
const exifChunk = (tag: number, value: string): Buffer => {
  const padded = `${value}\0`;
  /* Eight bytes of header, two for the entry count, twelve for the one entry. */
  const VALUE_AT = 22;
  const block = Buffer.alloc(VALUE_AT + padded.length);
  block.write('MM\0*', 0, 'latin1');
  block.writeUInt32BE(8, 4);
  block.writeUInt16BE(1, 8);
  block.writeUInt16BE(tag, 10);
  block.writeUInt16BE(2, 12);
  block.writeUInt32BE(padded.length, 14);
  block.writeUInt32BE(VALUE_AT, 18);
  block.write(padded, VALUE_AT, 'latin1');
  return chunk('eXIf', block);
};

/* -------------------------------------------------------------- the tree -- */

let directory = '';

const put = (path: string, contents: string | Buffer): void => {
  const target = join(directory, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
};

const rules = (): readonly string[] => auditExport(directory, expectations).map((one) => one.rule);

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'workly-reel-export-'));
  put('index.html', CLEAN_DOCUMENT);
  // Next writes its own bare `noindex` on a not-found route in addition to the
  // one the metadata declares, so the second document carries two tags. The
  // fixture reproduces that, because a gate that required `nofollow` of every
  // tag would fail on a page that refuses more than it was asked to.
  put(
    '404.html',
    CLEAN_DOCUMENT.replace(
      '<meta name="robots" content="noindex, nofollow"/>',
      '<meta name="robots" content="noindex"/><meta name="robots" content="noindex, nofollow"/>',
    ),
  );
  put('robots.txt', CLEAN_ROBOTS);
  put('sitemap.xml', CLEAN_SITEMAP);
  put('CNAME', 'phase-zero.example.invalid\n');
  put('assets/card.png', png());
  put('_next/static/chunks/one.js', 'export const a=1;// a bundled chunk with nothing in it\n');
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe('an export with nothing to hide', () => {
  it('is passed, so the rules below are shown failing on the leak and not on the fixture', () => {
    expect(auditExport(directory, expectations)).toEqual([]);
  });

  it('is still passed when a document quotes the one address the site publishes', () => {
    // The clean document already carries the clone command. This states the
    // exemption as its own claim, because the day it stops working the failure
    // would otherwise read as a leak in an unrelated fixture.
    expect(rules()).not.toContain('email-address');
  });

  it('is still passed when a bundler names its own redaction of the project directory', () => {
    put(
      '_next/static/chunks/two.js',
      'const url=`file:///ROOT/${name}`;const dir="/ROOT/node_modules";',
    );
    expect(rules()).toEqual([]);
  });

  it('is still passed when an image records only its own dimensions', () => {
    put('assets/card.png', png([exifChunk(0xa002, '1080')]));
    expect(rules()).toEqual([]);
  });

  it('is still passed when an ordinary asset has a name that merely contains a refused one', () => {
    // The rule matches a whole path segment, so a file legitimately named after
    // one of the words it refuses is not the thing it is looking for.
    put('assets/changelog.txt', 'Nothing here.\n');
    put('assets/keyboard-shortcuts.txt', 'Nothing here either.\n');
    expect(rules()).toEqual([]);
  });
});

describe('an export carrying a file nobody meant to publish', () => {
  // Measured rather than imagined: Next copies `public/` into `out/` untouched,
  // so a file dropped beside the screenshots is uploaded and served at its own
  // address. Each of these was passed by every other rule in this gate, which
  // is why the name is refused rather than the contents read.
  it.each([
    ['a Finder index', '.DS_Store'],
    ['a Finder index beside the assets', 'assets/.DS_Store'],
    ['an environment file', '.env.production'],
    ['a private key', 'assets/deploy.pem'],
    ['an SSH key', 'id_ed25519'],
    ['a registry configuration', '.npmrc'],
    ['a build log', 'build.log'],
    ['an editor backup', 'assets/notes.txt~'],
    ['a repository configuration', '.gitconfig'],
  ])('is refused for %s', (_name, path) => {
    put(path, 'anything at all\n');
    expect(rules()).toContain('unpublishable-file');
  });
});

describe('an export that would publish a source map', () => {
  it('is refused when the map itself is in the tree', () => {
    put('_next/static/chunks/one.js.map', '{"version":3,"sources":[],"sourcesContent":[]}');
    expect(rules()).toContain('source-map');
  });

  it('is refused when only the comment pointing at one survives', () => {
    put('_next/static/chunks/one.js', 'export const a=1;\n//# sourceMappingURL=one.js.map\n');
    expect(rules()).toContain('source-map');
  });

  it('is refused when a bundler source scheme reaches the export', () => {
    put('_next/static/chunks/one.js', 'const origin="webpack://a-project/./src/index.ts";');
    expect(rules()).toContain('source-map');
  });
});

describe('an export that would identify the machine it was built on', () => {
  it('is refused for a home directory path', () => {
    put('_next/static/chunks/one.js', 'const root="/Users/quillstone/Sites/a-project";');
    expect(rules()).toContain('absolute-path');
  });

  it('is refused for a Windows profile path', () => {
    put('_next/static/chunks/one.js', 'const root="C:\\\\Users\\\\Quillstone\\\\a-project";');
    expect(rules()).toContain('absolute-path');
  });

  it('is refused for a file URL that is not the redacted one', () => {
    put('_next/static/chunks/one.js', 'const url="file:///Volumes/Scratch/a-project/index.ts";');
    expect(rules()).toContain('absolute-path');
  });

  it('is refused for the name of the account that ran the build', () => {
    put('_next/static/chunks/one.js', 'const author="quillstone";');
    expect(rules()).toContain('builder-identity');
  });

  it('is refused for the name of the machine that ran the build', () => {
    put('_next/static/chunks/one.js', 'const host="ashfield-desk";');
    expect(rules()).toContain('builder-identity');
  });

  it('is refused when the identity is in the file name rather than the file', () => {
    // A file name is served in the URL that reaches it, so it is as published
    // as anything inside it.
    put('_next/static/chunks/quillstone-notes.js', 'export const a=1;');
    expect(rules()).toContain('builder-identity');
  });

  it('is refused for an address the content modules do not publish', () => {
    put('_next/static/chunks/one.js', 'const contact="someone@example.invalid";');
    expect(rules()).toContain('email-address');
  });

  it('is refused for a hostname from a private network', () => {
    put('_next/static/chunks/one.js', 'const api="http://ashfield-desk.local:5173/";');
    expect(rules()).toContain('internal-host');
  });

  it('is refused for a private network address', () => {
    put('_next/static/chunks/one.js', 'const api="http://192.168.4.21:5173/";');
    expect(rules()).toContain('internal-host');
  });
});

describe('an export that would publish a credential', () => {
  // Shapes, not secrets. Each one is the documented prefix followed by filler,
  // so the pattern is exercised and nothing here has ever authorised anything.
  it.each([
    ['a GitHub token', `ghp_${'A'.repeat(36)}`],
    ['a fine-grained GitHub token', `github_pat_${'B'.repeat(40)}`],
    ['an AWS access key id', `AKIA${'C'.repeat(16)}`],
    ['a Slack token', `xoxb-${'1'.repeat(12)}-${'2'.repeat(12)}`],
    ['a private key', '-----BEGIN OPENSSH PRIVATE KEY-----'],
    ['an SSH key body', `ssh-ed25519 AAAA${'D'.repeat(40)}`],
  ])('is refused for something shaped like %s', (_name, shape) => {
    put('_next/static/chunks/one.js', `const value="${shape}";`);
    expect(rules()).toContain('credential-shape');
  });
});

describe('an image that would identify who captured it', () => {
  it('is refused for an EXIF Artist tag', () => {
    put('assets/card.png', png([exifChunk(0x013b, 'A. Person')]));
    expect(rules()).toContain('image-metadata');
  });

  it('is refused for a text chunk that names the software that wrote it', () => {
    put('assets/card.png', png([textChunk('Software', 'A capture tool 1.0')]));
    expect(rules()).toContain('image-metadata');
  });

  it('is refused for an XMP packet that names the tool that created it', () => {
    put('assets/card.png', png([xmpChunk('<xmp:CreatorTool>A capture tool</xmp:CreatorTool>')]));
    expect(rules()).toContain('image-metadata');
  });

  it('is refused when a comment carries a path rather than a name', () => {
    // The keyword is innocuous, so only reading the value catches this. It is
    // how a capture tool records the window it captured.
    put('assets/card.png', png([textChunk('Comment', '/Users/quillstone/Desktop/capture.png')]));
    expect(rules()).toContain('absolute-path');
  });
});

describe('the contracts the export publishes about itself', () => {
  it('refuses a robots file that readmits a crawler it just refused', () => {
    put('robots.txt', CLEAN_ROBOTS.replace('Disallow: /', 'Disallow: /\nAllow: /'));
    expect(rules()).toContain('robots');
  });

  it('refuses a robots file that stops refusing the site', () => {
    put('robots.txt', CLEAN_ROBOTS.replace('Disallow: /', 'Disallow: /nothing'));
    expect(rules()).toContain('robots');
  });

  it('refuses a robots file whose only refusal binds one named crawler', () => {
    // The refused line is still there, still spelled `Disallow: /`, and the
    // file now invites every crawler but the one it names. A check that looked
    // for the line rather than for the group it sits under would call this
    // closed.
    put('robots.txt', CLEAN_ROBOTS.replace('User-Agent: *', 'User-Agent: SomeBot'));
    expect(rules()).toContain('robots');
  });

  it('accepts a refusal written under a group that names other crawlers beside the wildcard', () => {
    // Consecutive agent lines open one group, so the refusal below them binds
    // all of them, the wildcard included.
    put('robots.txt', CLEAN_ROBOTS.replace('User-Agent: *', 'User-Agent: SomeBot\nUser-Agent: *'));
    expect(rules()).not.toContain('robots');
  });

  it('refuses a robots file that names a sitemap at another origin', () => {
    put(
      'robots.txt',
      CLEAN_ROBOTS.replace(`Sitemap: ${ORIGIN}`, 'Sitemap: https://elsewhere.invalid'),
    );
    expect(rules()).toContain('robots');
  });

  it('refuses a sitemap that advertises a page the export does not contain', () => {
    put(
      'sitemap.xml',
      CLEAN_SITEMAP.replace('<loc>', '<loc>').replace(`${ORIGIN}/`, `${ORIGIN}/phase-one`),
    );
    expect(rules()).toContain('sitemap');
  });

  it('refuses a sitemap that advertises another origin', () => {
    put('sitemap.xml', CLEAN_SITEMAP.replace(ORIGIN, 'https://elsewhere.invalid'));
    expect(rules()).toContain('sitemap');
  });

  it('refuses a document that permits indexing', () => {
    put(
      'index.html',
      CLEAN_DOCUMENT.replace('content="noindex, nofollow"', 'content="index, follow"'),
    );
    expect(rules()).toContain('noindex');
  });

  it('refuses a document that carries no robots tag at all', () => {
    put(
      'index.html',
      CLEAN_DOCUMENT.replace('<meta name="robots" content="noindex, nofollow"/>', ''),
    );
    expect(rules()).toContain('noindex');
  });

  it('refuses a document whose policy is not the first thing the parser meets', () => {
    // The failure this catches is silent: the tag is present, the page renders,
    // and the scripts declared above it are outside the policy entirely.
    const policy =
      '<meta http-equiv="Content-Security-Policy" content="default-src &#x27;self&#x27;"/>';
    put(
      'index.html',
      CLEAN_DOCUMENT.replace(policy, '').replace(
        '<meta charSet="utf-8"/>',
        `<meta charSet="utf-8"/>${policy}`,
      ),
    );
    expect(rules()).toContain('policy-first');
  });

  it('refuses a document that reaches for another origin', () => {
    put(
      'index.html',
      CLEAN_DOCUMENT.replace(
        '</head>',
        '<script src="https://cdn.example.invalid/a.js"></script></head>',
      ),
    );
    expect(rules()).toContain('external-reference');
  });

  it('refuses a card that has lost a tag a link preview needs', () => {
    put(
      'index.html',
      CLEAN_DOCUMENT.replace(`<meta property="og:image" content="${ORIGIN}/assets/card.png"/>`, ''),
    );
    expect(rules()).toContain('preview-card');
  });

  it('refuses a card that advertises an image the export does not contain', () => {
    put('index.html', CLEAN_DOCUMENT.replaceAll('/assets/card.png', '/assets/missing.png'));
    expect(rules()).toContain('preview-card');
  });

  it('refuses a card whose Twitter image alone has drifted off this origin', () => {
    // The two image tags are written from one metadata object, which is exactly
    // why only one of them going wrong would go unnoticed.
    put(
      'index.html',
      CLEAN_DOCUMENT.replace(
        `<meta name="twitter:image" content="${ORIGIN}/assets/card.png"/>`,
        '<meta name="twitter:image" content="https://elsewhere.invalid/card.png"/>',
      ),
    );
    expect(rules()).toContain('preview-card');
  });

  it('refuses a card whose Twitter image alone points at nothing the export holds', () => {
    put(
      'index.html',
      CLEAN_DOCUMENT.replace(
        `<meta name="twitter:image" content="${ORIGIN}/assets/card.png"/>`,
        `<meta name="twitter:image" content="${ORIGIN}/assets/missing.png"/>`,
      ),
    );
    expect(rules()).toContain('preview-card');
  });

  it('refuses a card that names another origin as the permanent address of this page', () => {
    // Every reshare of the card carries whatever `og:url` says, so a wrong one
    // sends the audience of this page somewhere else for as long as the link
    // circulates.
    put(
      'index.html',
      CLEAN_DOCUMENT.replace(
        `<meta property="og:url" content="${ORIGIN}/"/>`,
        '<meta property="og:url" content="https://elsewhere.invalid/"/>',
      ),
    );
    expect(rules()).toContain('preview-card');
  });

  it('refuses a home page that claims an address other than the agreed one', () => {
    put(
      'index.html',
      CLEAN_DOCUMENT.replace(
        `<link rel="canonical" href="${ORIGIN}/"/>`,
        `<link rel="canonical" href="${ORIGIN}/index.html"/>`,
      ),
    );
    expect(rules()).toContain('canonical');
  });

  it('refuses an export that would drop the custom domain', () => {
    rmSync(join(directory, 'CNAME'));
    expect(rules()).toContain('custom-domain');
  });

  it('refuses an export that would publish to a domain nothing points at', () => {
    put('CNAME', 'someone.github.io\n');
    expect(rules()).toContain('custom-domain');
  });
});

describe('an export that is not there', () => {
  it('is refused rather than passed, because an empty tree satisfies every rule above', () => {
    rmSync(directory, { recursive: true, force: true });
    expect(auditExport(directory, expectations).map((one) => one.rule)).toEqual(['no-export']);
  });
});

describe('what a failure says', () => {
  it('names the kind and the position and never reproduces the value', () => {
    // This gate's own output reaches a CI log that is public the moment the
    // repository is. A message that quoted the leak would publish it a second
    // time while reporting it.
    const secret = '/Users/quillstone/Sites/a-project';
    put('_next/static/chunks/one.js', `const root="${secret}";`);

    const findings = auditExport(directory, expectations);
    expect(findings.length).toBeGreaterThan(0);
    for (const finding of findings) {
      expect(JSON.stringify(finding)).not.toContain('quillstone');
      expect(finding.file).toBe(join('_next', 'static', 'chunks', 'one.js'));
      expect(finding.at).toMatch(/^line \d+$/);
    }
  });
});
