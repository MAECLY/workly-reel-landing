/**
 * The export privacy gate.
 *
 * `out/` is the whole product of this repository. Every byte in it is served to
 * anybody who asks, with no login and no referrer check, and the repository
 * that produces it is about to be readable too. So the question this file asks
 * is narrow and worth asking on every build rather than once: does the exported
 * site say anything about the machine or the person that built it, and do the
 * documents it publishes about itself still say what Phase 0 intends.
 *
 * The four things it looks for, and why each one is here:
 *
 * - A source map. Turbopack writes one per chunk during a production build and
 *   fills in `sourcesContent`, so a map is not a pointer to source, it *is* the
 *   source. Turned on and measured rather than assumed: `pnpm build` with
 *   `productionBrowserSourceMaps: true` wrote 12 maps totalling 4.5 MB, and
 *   between them they carried the complete text of 29 modules of the private
 *   `@maecly/workly-reel-ui` package. Publishing browser maps from this
 *   repository would therefore republish a private design system to the open
 *   web. The same measurement corrects the other half of the old claim here:
 *   Turbopack rewrites every source to `turbopack:///ROOT/...`, so the maps
 *   carried no absolute path from the build machine at all. The maps are
 *   refused for the source they contain, not for a path they do not. This
 *   refuses the artefact rather than the setting, because the artefact is what
 *   gets served.
 * - An identity. An absolute path, a home directory, an account name, a machine
 *   name, an email address, a private address on somebody's network. Bundlers
 *   leak these through error messages, banner comments and cache keys, and a
 *   screenshot leaks them through the metadata the capture tool attaches, which
 *   is why the PNG chunks are parsed rather than skipped as binary.
 * - A credential. Nothing here should ever hold one, which is exactly why the
 *   day one appears nobody will be looking.
 * - A file nobody meant to publish. Next copies `public/` into `out/` without
 *   reading it, so a `.DS_Store` or a stray `.env` left beside the screenshots
 *   is uploaded and served at its own address. Both were measured arriving in
 *   `out/` on a real build, and both were passed by every rule above.
 *
 * And the contracts, checked over the same bytes: `robots.txt`, `sitemap.xml`,
 * the `noindex` in every document, the Open Graph card, the security policy's
 * position, and the custom domain. `tests/e2e/contracts.e2e.ts` holds those
 * against a running server; this holds them against the files on disk, which is
 * what `actions/upload-pages-artifact` uploads and therefore what is published
 * even if nothing is ever served locally again.
 *
 * A finding never quotes what it found. This gate's own output goes to a CI log
 * that is public the moment the repository is, so a message that pasted the
 * leak would publish it a second time in the course of reporting it. Findings
 * name the kind, the file and the position, and nothing else.
 *
 * Run with `pnpm privacy:check`, or let `pnpm build` run it for you.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir, hostname, userInfo } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

import sitemap from '../app/sitemap';
import * as content from '../content';

const ROOT = resolve(import.meta.dirname, '..');

export interface Finding {
  /** Relative to the audited directory, so a message never carries a real path. */
  readonly file: string;
  /** Where in the file, in whatever unit that file has: a line, or a chunk. */
  readonly at: string;
  readonly rule: string;
  readonly message: string;
}

export interface ExportExpectations {
  /** The scheme and host the site publishes about itself, with no trailing slash. */
  readonly origin: string;
  /** The one address the site claims as its own, trailing slash included. */
  readonly canonical: string;
  /** What `CNAME` has to hold for the custom domain to survive the export. */
  readonly customDomain: string;
  /** Every address the sitemap is supposed to advertise, in order. */
  readonly sitemapAddresses: readonly string[];
  /**
   * Addresses the page publishes deliberately, so the email rule can tell the
   * run instructions apart from a leak. Derived from the content modules rather
   * than typed, so deleting the copy tightens the gate instead of leaving a
   * stale exemption behind.
   */
  readonly publishedAddresses: readonly string[];
  /** Names that would identify the machine or the account that ran the build. */
  readonly builderTerms: readonly string[];
}

/* ------------------------------------------------------------- the rules -- */

interface TextRule {
  readonly id: string;
  readonly pattern: RegExp;
  /** Describes the match without reproducing it. */
  readonly describe: (match: string) => string;
}

/**
 * A published source map, in either of the two forms it can take.
 *
 * The file itself is caught by extension below. This catches the comment that
 * points at one, which survives even when the map is deleted afterwards and is
 * a working instruction to a browser's developer tools, and the two bundler
 * schemes that appear only inside map payloads.
 */
const SOURCE_MAP_RULES: readonly TextRule[] = [
  {
    id: 'source-map',
    pattern: /sourceMappingURL\s*=\s*\S+/g,
    describe: () => 'a published file points a debugger at a source map',
  },
  {
    id: 'source-map',
    pattern: /(?:webpack|turbopack|rsc):\/\/\S*/g,
    describe: (match) =>
      `a bundler source scheme (${match.split(':', 1)[0]}:) reached the exported site`,
  },
];

/**
 * A path that only exists on the machine that ran the build.
 *
 * `/ROOT/` is deliberately not matched: Next substitutes it for the real
 * project directory in its own runtime, so it is the redaction rather than the
 * leak. Anything under a real account directory is the leak.
 */
const PATH_RULES: readonly TextRule[] = [
  {
    id: 'absolute-path',
    pattern: /\/(?:Users|home|root)\/[A-Za-z0-9._-]+/g,
    describe: (match) => `an absolute home directory path (${match.length} characters)`,
  },
  {
    // One backslash or two, because a path that reaches a bundle reaches it
    // through a JavaScript string literal, where every separator is doubled.
    id: 'absolute-path',
    pattern: /[A-Za-z]:\\{1,2}(?:Users|Documents and Settings)\\{1,2}[A-Za-z0-9._ -]+/g,
    describe: (match) => `an absolute Windows profile path (${match.length} characters)`,
  },
  {
    // `file:///ROOT/` is the same substitution as `/ROOT/` above, made by the
    // Turbopack runtime when it builds a URL for a module it wants to name in a
    // stack trace. It is skipped for the same reason: it is what replaced the
    // project directory, so matching it would report the redaction as the leak.
    id: 'absolute-path',
    pattern: /file:\/\/\/(?!ROOT\/)[A-Za-z0-9._~/%-]+/g,
    describe: (match) => `a file:// URL from the build machine (${match.length} characters)`,
  },
];

/**
 * A machine on somebody's network rather than on the internet.
 *
 * `.local` is how macOS names itself over Bonjour, so a hostname in an exported
 * file is almost always the laptop the export was produced on. The private IPv4
 * ranges are matched only where the surrounding characters make a dotted quad
 * possible, because an SVG path is a long run of numbers and full stops and
 * would otherwise report a leak on every icon.
 */
const HOST_RULES: readonly TextRule[] = [
  {
    id: 'internal-host',
    pattern: /\b[A-Za-z0-9][A-Za-z0-9-]{2,}\.(?:local|internal|lan|localdomain|home\.arpa)\b/g,
    describe: () => 'a hostname from a private network',
  },
  {
    id: 'internal-host',
    pattern:
      /(?<![0-9.\-])(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?![0-9.])/g,
    describe: () => 'a private network address',
  },
];

/**
 * Credential shapes.
 *
 * None of these can be here legitimately: this page reads nothing at runtime
 * and the one secret the build needs is an SSH key that never leaves the
 * runner. They are listed because the cost of the check is nothing and the cost
 * of missing one on a public origin is unbounded.
 */
const CREDENTIAL_RULES: readonly TextRule[] = [
  {
    id: 'credential-shape',
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g,
    describe: () => 'something shaped like a GitHub token',
  },
  {
    id: 'credential-shape',
    pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
    describe: () => 'something shaped like a GitHub fine-grained token',
  },
  {
    id: 'credential-shape',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    describe: () => 'something shaped like an AWS access key id',
  },
  {
    id: 'credential-shape',
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g,
    describe: () => 'something shaped like a Slack token',
  },
  {
    id: 'credential-shape',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
    describe: () => 'the opening line of a private key',
  },
  {
    id: 'credential-shape',
    pattern: /\bssh-(?:rsa|ed25519|dss) AAAA[A-Za-z0-9+/]{20,}/g,
    describe: () => 'an SSH key body',
  },
];

const ALWAYS: readonly TextRule[] = [
  ...SOURCE_MAP_RULES,
  ...PATH_RULES,
  ...HOST_RULES,
  ...CREDENTIAL_RULES,
];

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * Files that reach the export by being in the way rather than by being wanted.
 *
 * Next copies `public/` into `out/` byte for byte and asks no questions, and
 * `actions/upload-pages-artifact` uploads `out/` wholesale, so a file the
 * Finder wrote next to the screenshots is served at its own URL to anyone who
 * guesses the name. Measured rather than assumed: a `.DS_Store` and a stray
 * `.env` dropped into `public/` both arrived in `out/` on a real build, and
 * every rule above passed them, because a Finder index is binary noise with no
 * absolute path in it and an environment file only trips the credential shapes
 * if the value it holds happens to be one of them.
 *
 * The rule is the name, not the contents, because the name is what makes these
 * publishable by accident: nothing here is ever meant to be fetched, so the
 * honest answer to finding one in the export is to refuse the build rather than
 * to read it and decide.
 */
const UNPUBLISHABLE_NAMES: readonly RegExp[] = [
  /* What a file manager or an editor leaves behind. */
  /^\.DS_Store$/i,
  /^Thumbs\.db$/i,
  /^desktop\.ini$/i,
  /^\.Spotlight-V100$/i,
  /^\.Trashes$/i,
  /^__MACOSX$/,
  /~$/,
  /^\.#/,
  /\.(?:swp|swo|orig|rej|bak|tmp)$/i,
  /* What a person's own configuration lives in. */
  /^\.env(?:\..+)?$/i,
  /^\.npmrc$/i,
  /^\.netrc$/i,
  /^\.git(?:ignore|config|modules|attributes)?$/i,
  /^\.ssh$/i,
  /^\.aws$/i,
  /* What a key is called when somebody saves one. */
  /\.(?:pem|key|p12|pfx|jks|keystore|asc|gpg)$/i,
  /^id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?$/i,
  /* What a build or a run writes about itself. */
  /\.log$/i,
  /^npm-debug\.log/i,
  /^\.eslintcache$/i,
  /\.tsbuildinfo$/i,
];

/* ----------------------------------------------------------- what to read -- */

const filesUnder = (directory: string): readonly string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });

/** A run of printable ASCII long enough to be a word rather than a byte pattern. */
const printableRuns = (bytes: Buffer): string =>
  bytes
    .toString('latin1')
    // eslint-disable-next-line no-control-regex -- The point is to split on the bytes that are not text.
    .split(/[^\x20-\x7e]+/)
    .filter((piece) => piece.length >= 6)
    .join('\n');

const looksBinary = (bytes: Buffer): boolean => bytes.subarray(0, 8192).includes(0);

const lineOf = (text: string, index: number): number => text.slice(0, index).split('\n').length;

/* -------------------------------------------------------- image metadata -- */

interface PngChunk {
  readonly type: string;
  readonly data: Buffer;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const pngChunks = (bytes: Buffer): readonly PngChunk[] => {
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return [];

  const chunks: PngChunk[] = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('latin1');
    if (offset + 12 + length > bytes.length) break;
    chunks.push({ type, data: bytes.subarray(offset + 8, offset + 8 + length) });
    if (type === 'IEND') break;
    offset += 12 + length;
  }
  return chunks;
};

const inflateOrEmpty = (bytes: Buffer): Buffer => {
  try {
    return inflateSync(bytes);
  } catch {
    return Buffer.alloc(0);
  }
};

/**
 * Every EXIF tag that names a person, a machine, a place or a moment.
 *
 * Presence is the failure, not the value: a screenshot of an application does
 * not need to record which camera body took it, and a tool that started writing
 * `Artist` would be recording the account name of whoever pressed the shortcut.
 * The tags the current captures do carry, being the pixel dimensions and the
 * word `Screenshot`, describe the image rather than its author and are allowed.
 */
const IDENTIFYING_EXIF_TAGS = new Map<number, string>([
  [0x010f, 'Make'],
  [0x0110, 'Model'],
  [0x0131, 'Software'],
  [0x0132, 'DateTime'],
  [0x013b, 'Artist'],
  [0x013c, 'HostComputer'],
  [0x8298, 'Copyright'],
  [0x8825, 'GPS'],
  [0x9003, 'DateTimeOriginal'],
  [0x9004, 'DateTimeDigitized'],
  [0xa420, 'ImageUniqueID'],
  [0xa430, 'CameraOwnerName'],
  [0xa431, 'BodySerialNumber'],
]);

/** XMP properties that carry an identity, whichever namespace prefix is used. */
const IDENTIFYING_XMP_PROPERTIES: readonly string[] = [
  'dc:creator',
  'dc:rights',
  'xmp:CreatorTool',
  'xmp:CreateDate',
  'xmp:ModifyDate',
  'xmp:MetadataDate',
  'tiff:Artist',
  'tiff:Make',
  'tiff:Model',
  'tiff:Software',
  'tiff:HostComputer',
  'photoshop:',
  'xmpMM:',
  'exif:GPS',
  'aux:',
  'Iptc4xmpCore',
];

/** PNG text keywords that exist to record who made the file. */
const IDENTIFYING_PNG_KEYWORDS: readonly string[] = [
  'Author',
  'Artist',
  'Copyright',
  'Software',
  'Source',
  'Creation Time',
  'Disclaimer',
];

interface MetadataText {
  readonly at: string;
  readonly text: string;
}

/**
 * Read a TIFF block the way an EXIF reader would, far enough to list its tags.
 *
 * Only the first directory and the two pointers out of it are walked. That is
 * where every tag above lives, and a walker that followed everything would be a
 * parser to maintain rather than a gate.
 */
const exifTags = (block: Buffer): readonly number[] => {
  if (block.length < 8) return [];
  const order = block.subarray(0, 2).toString('latin1');
  if (order !== 'MM' && order !== 'II') return [];
  const big = order === 'MM';
  const u16 = (at: number): number => (big ? block.readUInt16BE(at) : block.readUInt16LE(at));
  const u32 = (at: number): number => (big ? block.readUInt32BE(at) : block.readUInt32LE(at));

  const tags: number[] = [];
  const directories = [u32(4)];
  const seen = new Set<number>();

  while (directories.length > 0) {
    const start = directories.pop() ?? 0;
    if (seen.has(start) || start + 2 > block.length) continue;
    seen.add(start);

    const count = u16(start);
    for (let index = 0; index < count; index += 1) {
      const entry = start + 2 + index * 12;
      if (entry + 12 > block.length) break;
      const tag = u16(entry);
      tags.push(tag);
      // The Exif and GPS directories hang off IFD0 as offsets rather than values.
      if (tag === 0x8769 || tag === 0x8825) directories.push(u32(entry + 8));
    }
  }
  return tags;
};

/**
 * Everything a PNG says about itself in words, and every identifying tag it
 * carries. The text comes back so the ordinary rules can run over it too: a
 * capture tool that writes a window title into a comment writes an absolute
 * path into a comment.
 */
const pngMetadata = (
  bytes: Buffer,
): { readonly text: readonly MetadataText[]; readonly identifying: readonly string[] } => {
  const text: MetadataText[] = [];
  const identifying: string[] = [];

  for (const chunk of pngChunks(bytes)) {
    if (chunk.type === 'tEXt' || chunk.type === 'zTXt' || chunk.type === 'iTXt') {
      const separator = chunk.data.indexOf(0);
      const keyword = chunk.data.subarray(0, Math.max(separator, 0)).toString('latin1');
      const body =
        chunk.type === 'zTXt'
          ? inflateOrEmpty(chunk.data.subarray(separator + 2))
          : chunk.data.subarray(separator + 1);
      text.push({ at: `${chunk.type} chunk "${keyword}"`, text: printableRuns(body) });

      if (IDENTIFYING_PNG_KEYWORDS.includes(keyword)) {
        identifying.push(`a ${chunk.type} chunk keyed "${keyword}"`);
      }
      for (const property of IDENTIFYING_XMP_PROPERTIES) {
        if (body.toString('latin1').includes(property)) {
          identifying.push(`an XMP packet carrying ${property}`);
        }
      }
      continue;
    }

    if (chunk.type === 'eXIf') {
      text.push({ at: 'eXIf chunk', text: printableRuns(chunk.data) });
      for (const tag of exifTags(chunk.data)) {
        const name = IDENTIFYING_EXIF_TAGS.get(tag);
        if (name !== undefined) identifying.push(`an EXIF ${name} tag`);
      }
      continue;
    }

    if (chunk.type === 'iCCP') {
      const separator = chunk.data.indexOf(0);
      const profile = inflateOrEmpty(chunk.data.subarray(separator + 2));
      text.push({
        at: 'iCCP chunk',
        text: `${chunk.data.subarray(0, Math.max(separator, 0)).toString('latin1')}\n${printableRuns(profile)}`,
      });
    }
  }

  return { text, identifying: [...new Set(identifying)] };
};

/* ------------------------------------------------------------- the audit -- */

/** Every `<loc>` a sitemap advertises, in the order it advertises them. */
const advertisedAddresses = (xml: string): readonly string[] =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] ?? '');

/**
 * Whether `Disallow: /` is written under the group that binds every crawler.
 *
 * A robots file is groups rather than lines: consecutive `User-agent` lines
 * open one group, and the rules under them apply to those agents alone. So
 * `Disallow: /` under `User-agent: SomeBot` refuses one crawler and invites
 * every other one, while a check that only looked for the line would read the
 * same file as a closed site. `Sitemap` and `Host` belong to no group and are
 * therefore not what closes one.
 */
const refusesEveryCrawler = (robots: string): boolean => {
  let agents: string[] = [];
  let started = false;

  for (const raw of robots.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    const [field = '', ...rest] = line.split(':');
    const value = rest.join(':').trim();

    if (/^user-agent$/i.test(field)) {
      if (started) {
        agents = [];
        started = false;
      }
      agents.push(value);
      continue;
    }

    if (/^(?:disallow|allow|crawl-delay)$/i.test(field)) {
      started = true;
      if (/^disallow$/i.test(field) && value === '/' && agents.includes('*')) return true;
    }
  }

  return false;
};

const metaContent = (html: string, selector: RegExp): readonly string[] =>
  [...html.matchAll(selector)].map((match) => match[1] ?? '');

const named = (html: string, name: string): readonly string[] =>
  metaContent(html, new RegExp(`<meta name="${name}" content="([^"]*)"`, 'g'));

const propertied = (html: string, property: string): readonly string[] =>
  metaContent(html, new RegExp(`<meta property="${property}" content="([^"]*)"`, 'g'));

/**
 * The Open Graph and Twitter tags a link preview needs to render this card.
 *
 * Listed rather than discovered because the failure being gated is a tag that
 * stops being emitted, and a check that read the tags it found would report a
 * clean card for a page that publishes none.
 */
const REQUIRED_PREVIEW_TAGS: readonly string[] = [
  'og:type',
  'og:url',
  'og:title',
  'og:description',
  'og:site_name',
  'og:image',
  'og:image:alt',
  'og:image:width',
  'og:image:height',
];

const REQUIRED_TWITTER_TAGS: readonly string[] = [
  'twitter:card',
  'twitter:title',
  'twitter:description',
  'twitter:image',
];

export function auditExport(directory: string, expected: ExportExpectations): readonly Finding[] {
  const findings: Finding[] = [];
  const fail = (file: string, at: string, rule: string, message: string): void => {
    findings.push({ file, at, rule, message });
  };

  let files: readonly string[];
  try {
    files = filesUnder(directory);
  } catch {
    fail('.', 'the directory itself', 'no-export', 'there is no export here to audit');
    return findings;
  }

  if (files.length === 0) {
    fail('.', 'the directory itself', 'no-export', 'the export is empty');
    return findings;
  }

  const relativeTo = (path: string): string => relative(directory, path);
  const readable = new Map<string, string>();

  const applyRules = (file: string, at: string, text: string, rules: readonly TextRule[]): void => {
    for (const rule of rules) {
      for (const match of text.matchAll(rule.pattern)) {
        const where = at === '' ? `line ${lineOf(text, match.index)}` : at;
        fail(file, where, rule.id, rule.describe(match[0]));
      }
    }
  };

  const applyIdentityRules = (file: string, at: string, text: string): void => {
    for (const term of expected.builderTerms) {
      const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      for (const match of text.matchAll(pattern)) {
        const where = at === '' ? `line ${lineOf(text, match.index)}` : at;
        fail(file, where, 'builder-identity', 'the name of the account or machine that built this');
      }
    }

    for (const match of text.matchAll(EMAIL)) {
      if (expected.publishedAddresses.includes(match[0])) continue;
      const where = at === '' ? `line ${lineOf(text, match.index)}` : at;
      fail(file, where, 'email-address', 'an email address the content modules do not publish');
    }
  };

  for (const path of files) {
    const file = relativeTo(path);

    // The name of a file is served in the URL that reaches it, so it is as
    // published as the bytes inside it.
    applyRules(file, 'its own name', file, ALWAYS);
    applyIdentityRules(file, 'its own name', file);

    // Every segment, because the directory a stray file sits in is published
    // too: `assets/.DS_Store` is fetched at that address exactly as
    // `.DS_Store` at the root would be.
    if (file.split(/[/\\]/).some((segment) => UNPUBLISHABLE_NAMES.some((n) => n.test(segment)))) {
      fail(
        file,
        'the whole file',
        'unpublishable-file',
        'a file nothing should ever fetch is part of the published site',
      );
      continue;
    }

    if (file.toLowerCase().endsWith('.map')) {
      fail(file, 'the whole file', 'source-map', 'a source map is part of the published site');
      continue;
    }

    const bytes = readFileSync(path);

    // Lower-cased, here and above, because a capture tool that names its output
    // `Screenshot.PNG` would otherwise be read as an anonymous binary and have
    // its metadata skipped, which is the one thing this branch exists to read.
    if (file.toLowerCase().endsWith('.png')) {
      const { text, identifying } = pngMetadata(bytes);
      for (const description of identifying) {
        fail(file, 'its metadata', 'image-metadata', `the image carries ${description}`);
      }
      for (const piece of text) {
        applyRules(file, piece.at, piece.text, ALWAYS);
        applyIdentityRules(file, piece.at, piece.text);
      }
      continue;
    }

    if (looksBinary(bytes)) {
      const text = printableRuns(bytes);
      applyRules(file, 'its readable strings', text, ALWAYS);
      applyIdentityRules(file, 'its readable strings', text);
      continue;
    }

    const text = bytes.toString('utf8');
    readable.set(file, text);
    applyRules(file, '', text, ALWAYS);
    applyIdentityRules(file, '', text);
  }

  /* ------------------------------------------------------ the contracts -- */

  const documents = [...readable.entries()].filter(([file]) => file.endsWith('.html'));

  if (documents.length === 0) {
    fail('.', 'the directory itself', 'no-export', 'the export contains no HTML document');
  }

  for (const [file, html] of documents) {
    const refusals = named(html, 'robots');
    if (refusals.length === 0) {
      fail(file, 'its head', 'noindex', 'a document is published with no robots tag at all');
    }
    // Every tag has to refuse indexing, and at least one has to refuse the
    // links as well. Next writes its own bare `noindex` on the not-found route
    // in addition to the one the metadata declares, so requiring `nofollow` of
    // every tag would fail on a document that refuses more than it is asked to.
    for (const refusal of refusals) {
      if (!refusal.includes('noindex')) {
        fail(file, 'its head', 'noindex', 'a robots tag on this document permits indexing');
      }
    }
    if (refusals.length > 0 && !refusals.some((refusal) => refusal.includes('nofollow'))) {
      fail(file, 'its head', 'noindex', 'no robots tag on this document refuses the links');
    }

    // The policy governs only what the parser meets after it, so its position
    // is the whole of whether it works. `scripts/harden-export.ts` moves it and
    // this is what notices when a Next upgrade defeats the move.
    const head = /<head[^>]*>/.exec(html);
    const policy = /<meta http-equiv="Content-Security-Policy"/.exec(html);
    if (head === null || policy === null) {
      fail(file, 'its head', 'policy-first', 'a document is published with no security policy');
    } else if (policy.index !== head.index + head[0].length) {
      fail(
        file,
        'its head',
        'policy-first',
        'the security policy is not the first thing in the head',
      );
    }

    // Phase 0 fetches nothing it does not ship, and a document is the only
    // surface where an absolute address is a request rather than a namespace
    // declaration, which is why the sitemap's schema URL is not held to this.
    for (const match of html.matchAll(/https?:\/\/[^"'\s<>]+/g)) {
      if (!match[0].startsWith(expected.origin)) {
        fail(
          file,
          `line ${lineOf(html, match.index)}`,
          'external-reference',
          'a document reaches for an origin that is not this site',
        );
      }
    }
  }

  const robots = readable.get('robots.txt');
  if (robots === undefined) {
    fail('robots.txt', 'the whole file', 'robots', 'the export publishes no robots file');
  } else {
    // A refusal binds only the group it is written under, so the question is
    // not whether `Disallow: /` appears anywhere in the file but whether it
    // appears under `User-agent: *`. A file whose only refusal sits under one
    // named crawler reads as a closed site and is an open one to everybody
    // else, and matching the line on its own would call that closed.
    if (!refusesEveryCrawler(robots)) {
      fail('robots.txt', 'its rules', 'robots', 'the robots file does not refuse the whole site');
    }
    // A single `Allow:` beside the refusal is how a crawler is let back in
    // without the `Disallow: /` line ever being touched.
    if (/^Allow:/im.test(robots)) {
      fail('robots.txt', 'its rules', 'robots', 'the robots file readmits a crawler it refused');
    }
    if (!robots.includes(`Sitemap: ${expected.origin}/sitemap.xml`)) {
      fail('robots.txt', 'its rules', 'robots', 'the robots file names no sitemap at this origin');
    }
    if (!robots.includes(`Host: ${expected.origin}`)) {
      fail('robots.txt', 'its rules', 'robots', 'the robots file names another host as canonical');
    }
  }

  const advertised = readable.get('sitemap.xml');
  if (advertised === undefined) {
    fail('sitemap.xml', 'the whole file', 'sitemap', 'the export publishes no sitemap');
  } else {
    const addresses = advertisedAddresses(advertised);
    if (addresses.join('\n') !== expected.sitemapAddresses.join('\n')) {
      fail(
        'sitemap.xml',
        'its entries',
        'sitemap',
        'the published sitemap and the route that produces it advertise different addresses',
      );
    }
    for (const address of addresses) {
      if (!address.startsWith(`${expected.origin}/`)) {
        fail('sitemap.xml', 'its entries', 'sitemap', 'the sitemap advertises another origin');
        continue;
      }
      // An address offered to a crawler that the export does not contain is a
      // 404 with an invitation attached.
      const path = new URL(address).pathname;
      const document = path.endsWith('/') ? `${path.slice(1)}index.html` : `${path.slice(1)}.html`;
      if (!readable.has(document)) {
        fail('sitemap.xml', 'its entries', 'sitemap', 'the sitemap advertises an unexported page');
      }
    }
  }

  const home = readable.get('index.html');
  if (home === undefined) {
    fail('index.html', 'the whole file', 'preview-card', 'the export publishes no home page');
  } else {
    for (const property of REQUIRED_PREVIEW_TAGS) {
      const values = propertied(home, property);
      if (values.length !== 1 || values[0] === '') {
        fail('index.html', 'its head', 'preview-card', `the card publishes no ${property}`);
      }
    }
    for (const name of REQUIRED_TWITTER_TAGS) {
      const values = named(home, name);
      if (values.length !== 1 || values[0] === '') {
        fail('index.html', 'its head', 'preview-card', `the card publishes no ${name}`);
      }
    }

    // A preview is fetched by a stranger's server from the address in the tag,
    // so an image advertised at a path the export does not contain is a card
    // that renders blank everywhere the link is posted. Both tags are held to
    // this and not only the Open Graph one: they are written from the same
    // metadata today, which is exactly why a divergence would go unnoticed, and
    // `twitter:image` is the tag that renders the card on X.
    const checkAdvertisedImage = (tag: string, image: string): void => {
      if (image === '') return;
      if (!image.startsWith(`${expected.origin}/`)) {
        fail(
          'index.html',
          'its head',
          'preview-card',
          `the card advertises a ${tag} on another origin`,
        );
        return;
      }
      if (!files.some((path) => relativeTo(path) === new URL(image).pathname.slice(1))) {
        fail(
          'index.html',
          'its head',
          'preview-card',
          `the card advertises a ${tag} the export does not contain`,
        );
      }
    };

    checkAdvertisedImage('og:image', propertied(home, 'og:image')[0] ?? '');
    checkAdvertisedImage('twitter:image', named(home, 'twitter:image')[0] ?? '');

    // `og:url` is the permanent identity a link preview records, and every
    // reshare of the card carries whatever it says. The origin is what is held
    // here rather than the exact address, because the two differ today: Next
    // drops the trailing slash from a metadata URL, so the tag goes out as the
    // bare origin while the canonical link beside it keeps the slash. That is a
    // real defect and it has a gate of its own in
    // `tests/e2e/exported-site.e2e.ts`, written for the address the site says
    // is its own and left red until the product agrees with it. Repeating the
    // strict form here would only stop the build.
    const advertisedSelf = propertied(home, 'og:url')[0] ?? '';
    if (advertisedSelf !== '' && !advertisedSelf.startsWith(expected.origin)) {
      fail(
        'index.html',
        'its head',
        'preview-card',
        'the card names another origin as the permanent address of this page',
      );
    }

    const canonical = /<link rel="canonical" href="([^"]*)"/.exec(home)?.[1] ?? '';
    if (canonical !== expected.canonical) {
      fail(
        'index.html',
        'its head',
        'canonical',
        'the home page claims an address that is not the agreed one',
      );
    }
  }

  // A missing or rewritten CNAME silently drops the custom domain, and the site
  // reappears at the organisation's github.io address, which nothing points at.
  const domain = readable.get('CNAME')?.trim();
  if (domain === undefined) {
    fail('CNAME', 'the whole file', 'custom-domain', 'the export carries no custom domain');
  } else if (domain !== expected.customDomain) {
    fail('CNAME', 'its one line', 'custom-domain', 'the export would publish to another domain');
  }

  return findings;
}

/* --------------------------------------------------- the Phase 0 subject -- */

/**
 * Account names that belong to a shared machine rather than to a person.
 *
 * A CI runner logs in as one of these, and `runner` or `build` appearing inside
 * a minified chunk would fail every deploy for saying nothing about anybody. A
 * path *through* one of these accounts is still caught, by the absolute-path
 * rule, which is the part that actually identifies a machine.
 */
const SHARED_ACCOUNTS: readonly string[] = [
  'root',
  'runner',
  'user',
  'users',
  'admin',
  'administrator',
  'ubuntu',
  'ci',
  'build',
  'builder',
  'node',
  'docker',
  'vagrant',
  'jenkins',
  'actions',
];

/**
 * Who and what built this, taken from the running machine.
 *
 * Read at run time rather than written down, because the name that must not be
 * published is whichever one belongs to the person running the command, and a
 * list in the repository would only ever protect the person who wrote it. Terms
 * shorter than four characters are dropped: they match inside minified
 * identifiers, and a gate that cries wolf on every build is a gate that gets
 * removed.
 */
export const builderTerms = (): readonly string[] => {
  const machine = hostname().replace(/\.(local|lan|internal)$/i, '');
  const candidates = [userInfo().username, basename(homedir()), machine, ...machine.split('.')];

  return [
    ...new Set(
      candidates
        .map((term) => term.trim())
        .filter((term) => term.length >= 4 && !SHARED_ACCOUNTS.includes(term.toLowerCase())),
    ),
  ];
};

/**
 * Every address the page publishes on purpose.
 *
 * The run instructions quote a clone command, which carries an address shaped
 * exactly like the leak this gate exists to find. Reading it out of the content
 * modules rather than repeating it here means the exemption covers what the
 * page actually says: change the copy and the exemption changes with it, delete
 * the copy and the exemption disappears rather than lingering as permission for
 * an address nobody publishes any more.
 */
export const publishedAddresses = (): readonly string[] => [
  ...new Set([...JSON.stringify(content).matchAll(EMAIL)].map((match) => match[0])),
];

export const phaseZero = (): ExportExpectations => ({
  origin: content.site.origin,
  canonical: content.site.canonical,
  customDomain: new URL(content.site.origin).host,
  sitemapAddresses: sitemap().map((entry) => String(entry.url)),
  publishedAddresses: publishedAddresses(),
  builderTerms: builderTerms(),
});

const isDirectRun =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(import.meta.dirname, 'check-export-privacy.ts');

if (isDirectRun) {
  const directory = join(ROOT, 'out');
  const findings = auditExport(directory, phaseZero());

  if (findings.length === 0) {
    process.stdout.write(
      `privacy:check found nothing identifying in ${filesUnder(directory).length} published file(s)\n`,
    );
  } else {
    for (const finding of findings) {
      process.stderr.write(
        `out/${finding.file}  ${finding.at}  [${finding.rule}] ${finding.message}\n`,
      );
    }
    process.stderr.write(
      `\nprivacy:check failed with ${findings.length} problem(s). ` +
        'The values are deliberately not printed; open the named file at the named position.\n',
    );
    process.exit(1);
  }
}
