/**
 * The content linter.
 *
 * It runs over three things: the typed content module that every rendered
 * string comes from, the TSX that renders it, and the HTML `next build`
 * produced. Each rule below exists because breaking it would put a claim on a
 * public page that the desktop repository cannot support.
 *
 * Run with `pnpm content:check`. Build first if you want the HTML layer
 * checked as well; the source and content-module layers need no build.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import * as content from '../content';
import manifest from '../public/assets/manifest.json';

const ROOT = resolve(import.meta.dirname, '..');

interface Failure {
  readonly file: string;
  readonly line: number;
  readonly rule: string;
  readonly message: string;
}

const failures: Failure[] = [];

const fail = (file: string, line: number, rule: string, message: string): void => {
  failures.push({ file, line, rule, message });
};

/* -------------------------------------------------------------- inputs -- */

const walkFiles = (dir: string, extensions: readonly string[]): string[] => {
  const absolute = join(ROOT, dir);
  let entries: string[];
  try {
    entries = readdirSync(absolute);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const path = join(absolute, entry);
    if (statSync(path).isDirectory()) {
      return walkFiles(join(dir, entry), extensions);
    }
    return extensions.some((extension) => entry.endsWith(extension)) ? [join(dir, entry)] : [];
  });
};

/** The source of everything a visitor can read. Docs and the README are not copy. */
const sourceFiles = [
  ...walkFiles('content', ['.ts']),
  ...walkFiles('components', ['.tsx']),
  ...walkFiles('app', ['.tsx']),
];

const htmlFiles = walkFiles(join('.next', 'server', 'app'), ['.html']).filter(
  (file) => !file.includes('_global-error'),
);

/** Every string the content module exposes, with the path that reaches it. */
const contentStrings: { path: string; value: string }[] = [];

const collectStrings = (node: unknown, path: string): void => {
  if (typeof node === 'string') {
    contentStrings.push({ path, value: node });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((entry, index) => collectStrings(entry, `${path}[${index}]`));
    return;
  }
  if (typeof node === 'object' && node !== null) {
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'function') {
        continue;
      }
      collectStrings(value, `${path}.${key}`);
    }
  }
};

collectStrings(content, 'content');

const contentText = contentStrings.map((entry) => entry.value).join('\n');

const readText = (file: string): string => readFileSync(join(ROOT, file), 'utf8');

/**
 * Blank out comment lines while preserving line numbers.
 *
 * A comment explains a decision to the next maintainer and is not visible
 * copy, so the marketing rules do not apply to it. Line-initial matching keeps
 * a `https://` inside a real string from being mistaken for a comment.
 */
const withoutComments = (source: string): string =>
  source
    .split('\n')
    .map((line) => {
      const trimmed = line.trimStart();
      const isComment =
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*/') ||
        trimmed.startsWith('* ') ||
        trimmed === '*';
      return isComment ? '' : line;
    })
    .join('\n');

const lineOf = (text: string, index: number): number => text.slice(0, index).split('\n').length;

/** Text nodes only. Attribute values and class names are not visible copy. */
const visibleText = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ');

/* --------------------------------------------------------------- rules -- */

interface TextRule {
  readonly id: string;
  readonly pattern: RegExp;
  readonly message: string;
  /** A match is allowed when its surrounding sentence matches this. */
  readonly unless?: RegExp;
}

const BANNED_MARKETING: readonly TextRule[] = [
  {
    id: 'banned-word',
    pattern: /\brevolutionary\b/gi,
    message: 'the word "revolutionary" is banned',
  },
  {
    id: 'banned-word',
    pattern: /\beffortless(ly)?\b/gi,
    message: 'the word "effortless" is banned',
  },
  { id: 'banned-word', pattern: /\b10x\b/gi, message: 'the phrase "10x" is banned' },
  {
    id: 'banned-word',
    pattern: /\bthought leader(ship)?\b/gi,
    message: 'the phrase "thought leader" is banned',
  },
  {
    id: 'banned-word',
    pattern: /personal brand on autopilot/gi,
    message: 'the phrase "personal brand on autopilot" is banned',
  },
  {
    id: 'banned-word',
    pattern: /never share (your )?data/gi,
    message: 'the phrase "never share data" is banned',
  },
  { id: 'em-dash', pattern: /—/g, message: 'an em dash is not allowed in visible copy' },
];

/**
 * None of these is shipped or tested, so naming one on the page reads as
 * support for it. The check is a plain word match rather than an attempt to
 * parse intent: the safe way to describe an unverified platform on a marketing
 * page is not to name it at all.
 */
const UNSHIPPED_PLATFORMS: readonly TextRule[] = [
  {
    id: 'unshipped-platform',
    pattern: /\bwindows\b/gi,
    message: 'Windows is unverified and must not be named',
  },
  {
    id: 'unshipped-platform',
    pattern: /\blinux\b/gi,
    message: 'Linux is unverified and must not be named',
  },
  {
    id: 'unshipped-platform',
    pattern: /\bcuda\b/gi,
    message: 'CUDA is not shipped and must not be named',
  },
  {
    id: 'unshipped-platform',
    pattern: /\bmetal\b/gi,
    message: 'Metal is not shipped and must not be named',
  },
  {
    id: 'unshipped-platform',
    pattern: /\bamd\b/gi,
    message: 'AMD is not shipped and must not be named',
  },
  {
    id: 'unshipped-platform',
    pattern: /\bnvidia\b/gi,
    message: 'NVIDIA is not shipped and must not be named',
  },
  {
    id: 'unshipped-platform',
    pattern: /\bintel\b/gi,
    message: 'Intel macOS is unverified and must not be named',
  },
  {
    id: 'unshipped-platform',
    pattern: /llama\.cpp/gi,
    message: 'llama.cpp is not shipped and must not be named',
  },
  {
    id: 'unshipped-platform',
    pattern: /stable[- ]diffusion\.cpp/gi,
    message: 'stable-diffusion.cpp is not shipped and must not be named',
  },
];

/**
 * The product exports files. It never posts them.
 *
 * A match is forgiven when the sentence around it carries an explicit denial or
 * hands the action back to the reader, which is how the honest form of this
 * sentence is written: "no direct publishing to LinkedIn", "you post it
 * yourself".
 */
const DENIAL = /\b(no|not|never|without|cannot|can not|refuses?|yourself|instead of)\b/i;

const PUBLISHING: readonly TextRule[] = [
  {
    id: 'implied-publishing',
    pattern:
      /\b(post|posts|posted|posting|publish|publishes|published|publishing|share|shares|sharing|upload|uploads|uploading|schedule|schedules|scheduling|send|sends|sending)\b[^.!?]{0,60}\bto LinkedIn\b/gi,
    message: 'this implies the product posts to LinkedIn',
    unless: DENIAL,
  },
  {
    id: 'implied-publishing',
    pattern: /\bLinkedIn\b[^.!?]{0,40}\b(integration|api|account|oauth|credentials|connection)\b/gi,
    message: 'this implies a LinkedIn integration, which does not exist',
    unless: DENIAL,
  },
  {
    id: 'implied-publishing',
    pattern: /\bauto[- ]?post(s|ing|ed)?\b/gi,
    message: 'automatic posting does not exist',
  },
  {
    id: 'implied-publishing',
    pattern: /\bone[- ]click\b[^.!?]{0,30}\b(post|publish|share)/gi,
    message: 'one-click publishing does not exist',
  },
  {
    id: 'implied-publishing',
    pattern: /\b(posts?|publishes|shares) (it|them|your work|for you)\b/gi,
    message: 'this implies the product publishes on the reader’s behalf',
    unless: DENIAL,
  },
];

/** The page collects nothing and sells nothing, so none of this may appear. */
const NO_FUNNEL: readonly TextRule[] = [
  { id: 'no-funnel', pattern: /\bwaitlist\b/gi, message: 'there is no waitlist' },
  { id: 'no-funnel', pattern: /\bnewsletter\b/gi, message: 'there is no newsletter' },
  { id: 'no-funnel', pattern: /\bearly access list\b/gi, message: 'there is no signup list' },
  { id: 'no-funnel', pattern: /\bfree trial\b/gi, message: 'there is no pricing of any kind' },
  { id: 'no-funnel', pattern: /\bpricing\b/gi, message: 'there is no pricing of any kind' },
  { id: 'no-funnel', pattern: /\bbook a demo\b/gi, message: 'there is no demo booking' },
  { id: 'no-funnel', pattern: /\btestimonial\b/gi, message: 'there are no testimonials' },
  { id: 'no-funnel', pattern: /\btrusted by\b/gi, message: 'there are no customer logos' },
];

/** No number on this page may be a claim the repository cannot support. */
const NO_FABRICATED_METRIC: readonly TextRule[] = [
  {
    id: 'fabricated-metric',
    pattern: /\b\d+(\.\d+)?\s?%/g,
    message: 'a percentage reads as a performance claim, and none is measured',
  },
  {
    id: 'fabricated-metric',
    pattern: /\b\d+x (faster|quicker|more)\b/gi,
    message: 'this is an unmeasured claim',
  },
  {
    id: 'fabricated-metric',
    pattern: /\b\d[\d,.]*k?\+? (github )?stars\b/gi,
    message: 'no star count is published',
  },
  {
    id: 'fabricated-metric',
    pattern: /\b\d[\d,.]*k?\+? (developers|users|teams|customers)\b/gi,
    message: 'no adoption figure is published',
  },
];

const TEXT_RULES: readonly TextRule[] = [
  ...BANNED_MARKETING,
  ...UNSHIPPED_PLATFORMS,
  ...PUBLISHING,
  ...NO_FUNNEL,
  ...NO_FABRICATED_METRIC,
];

const sentenceAround = (text: string, index: number): string => {
  const start = Math.max(0, text.lastIndexOf('.', index) + 1);
  const rawEnd = text.indexOf('.', index);
  const end = rawEnd === -1 ? text.length : rawEnd;
  return text.slice(Math.max(start - 80, 0), end + 1);
};

const applyTextRules = (file: string, text: string): void => {
  for (const rule of TEXT_RULES) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (rule.unless !== undefined && rule.unless.test(sentenceAround(text, match.index))) {
        continue;
      }
      fail(file, lineOf(text, match.index), rule.id, `${rule.message}: "${match[0].trim()}"`);
    }
  }
};

/* ------------------------------------------------------ required copy -- */

interface RequiredPhrase {
  readonly id: string;
  readonly pattern: RegExp;
  readonly message: string;
}

const REQUIRED: readonly RequiredPhrase[] = [
  {
    id: 'missing-status-label',
    pattern: /proof of concept/i,
    message: 'the honest "proof of concept" label is missing',
  },
  {
    id: 'missing-window-copy',
    pattern: /\bDay\b/,
    message: 'the Day selection mode is not described',
  },
  {
    id: 'missing-window-copy',
    pattern: /\bWeek\b/,
    message: 'the Week selection mode is not described',
  },
  {
    id: 'missing-window-copy',
    pattern: /Custom Range/,
    message: 'the Custom Range selection mode is not described',
  },
  {
    id: 'missing-window-copy',
    pattern: /seven consecutive dates/i,
    message: 'the seven-day rule for Week is not stated',
  },
  {
    id: 'missing-window-copy',
    pattern: /one to seven inclusive dates/i,
    message: 'the one-to-seven rule for Custom Range is not stated',
  },
  {
    id: 'missing-window-copy',
    pattern: /weekends? count/i,
    message: 'the weekend rule is not stated',
  },
  {
    id: 'missing-window-copy',
    pattern: /future dates are disabled/i,
    message: 'the future-date rule is not stated',
  },
];

const checkRequired = (label: string, text: string): void => {
  for (const phrase of REQUIRED) {
    if (!phrase.pattern.test(text)) {
      fail(label, 0, phrase.id, phrase.message);
    }
  }
};

/* ------------------------------------------------------------- assets -- */

const manifestFiles = new Set(manifest.assets.map((asset) => asset.file));

/**
 * Only a renderable file counts as an asset.
 *
 * The manifest itself and the sidecar text files an export writes are read
 * about on this page, never rendered by it, so naming one in a comment is not
 * a claim that a picture exists.
 */
const MEDIA = /\.(png|jpe?g|webp|avif|gif|svg|mp4|webm)$/i;

const checkAssetReferences = (file: string, text: string): void => {
  const decoded = text.replace(/%2F/gi, '/');
  const pattern = /\/assets\/[A-Za-z0-9._/-]+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(decoded)) !== null) {
    if (!MEDIA.test(match[0])) {
      continue;
    }
    if (!manifestFiles.has(match[0])) {
      fail(
        file,
        lineOf(decoded, match.index),
        'unlisted-asset',
        `"${match[0]}" is not in public/assets/manifest.json`,
      );
    }
  }
};

/* -------------------------------------------------------------- markup -- */

const checkHtml = (file: string, html: string): void => {
  const ids = new Set<string>();
  const idPattern = /\sid="([^"]+)"/g;
  let idMatch: RegExpExecArray | null;
  while ((idMatch = idPattern.exec(html)) !== null) {
    ids.add(idMatch[1] ?? '');
  }

  const hrefPattern = /href="([^"]*)"/g;
  let hrefMatch: RegExpExecArray | null;
  while ((hrefMatch = hrefPattern.exec(html)) !== null) {
    const href = hrefMatch[1] ?? '';
    const line = lineOf(html, hrefMatch.index);
    if (href.trim() === '') {
      fail(file, line, 'empty-href', 'an href is empty');
      continue;
    }
    if (href === '#') {
      fail(file, line, 'empty-href', 'an href is "#", which goes nowhere');
      continue;
    }
    if (href.startsWith('#') && !ids.has(href.slice(1))) {
      fail(file, line, 'dangling-anchor', `"${href}" has no matching element id`);
    }
  }

  const imgPattern = /<img\b[^>]*>/g;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgPattern.exec(html)) !== null) {
    const tag = imgMatch[0];
    const alt = /\salt="([^"]*)"/.exec(tag);
    if (alt === null || (alt[1] ?? '').trim() === '') {
      fail(file, lineOf(html, imgMatch.index), 'missing-alt', 'an <img> has no alt text');
    }
  }

  for (const element of ['<form', '<input', '<textarea', '<select']) {
    const index = html.indexOf(element);
    if (index !== -1) {
      fail(
        file,
        lineOf(html, index),
        'no-forms',
        `the page collects nothing, so "${element}" may not appear`,
      );
    }
  }

  const downloadAttribute = /<a\b[^>]*\sdownload[\s=>]/.exec(html);
  if (downloadAttribute !== null) {
    fail(
      file,
      lineOf(html, downloadAttribute.index),
      'no-download',
      'there is no download in Phase 0',
    );
  }

  for (const marker of [
    'gtag(',
    'googletagmanager',
    'plausible.io',
    'posthog',
    'segment.com',
    'hotjar',
  ]) {
    const index = html.toLowerCase().indexOf(marker);
    if (index !== -1) {
      fail(file, lineOf(html, index), 'no-analytics', `analytics marker "${marker}" found`);
    }
  }
};

const checkSource = (file: string, source: string): void => {
  for (const pattern of [/href=""/g, /href="#"/g, /href=\{''\}/g, /href=\{``\}/g]) {
    let match: RegExpExecArray | null;
    const compiled = new RegExp(pattern.source, pattern.flags);
    while ((match = compiled.exec(source)) !== null) {
      fail(file, lineOf(source, match.index), 'empty-href', `"${match[0]}" goes nowhere`);
    }
  }

  const imagePattern = /<Image\b[\s\S]*?\/>/g;
  let imageMatch: RegExpExecArray | null;
  while ((imageMatch = imagePattern.exec(source)) !== null) {
    if (!/\balt=/.test(imageMatch[0])) {
      fail(
        file,
        lineOf(source, imageMatch.index),
        'missing-alt',
        'an <Image> is rendered without alt',
      );
    }
  }
};

/* ----------------------------------------------------------------- run -- */

export interface LintReport {
  readonly failures: readonly Failure[];
  readonly sourceFileCount: number;
  readonly contentStringCount: number;
  readonly htmlFiles: readonly string[];
  readonly scanned: readonly string[];
  readonly ruleCount: number;
}

/**
 * Run every rule and return what failed.
 *
 * Exported so the test suite can assert that each rule still catches the thing
 * it was written for. A linter that quietly matches nothing is worse than no
 * linter, because it reports a clean page either way.
 */
export function lint(): LintReport {
  failures.length = 0;

  for (const file of sourceFiles) {
    const source = readText(file);
    const copy = withoutComments(source);
    applyTextRules(file, copy);
    checkAssetReferences(file, copy);
    checkSource(file, source);
  }

  checkRequired('content/index.ts', contentText);
  checkAssetReferences('content/index.ts', contentText);

  for (const file of htmlFiles) {
    const html = readText(file);
    applyTextRules(file, visibleText(html));
    checkAssetReferences(file, html);
    checkHtml(file, html);
    if (file.endsWith(join('app', 'index.html'))) {
      checkRequired(file, visibleText(html));
    }
  }

  return {
    failures: [...failures],
    sourceFileCount: sourceFiles.length,
    contentStringCount: contentStrings.length,
    htmlFiles,
    scanned: [...sourceFiles, ...htmlFiles].map((file) => relative('.', file)),
    ruleCount: TEXT_RULES.length + REQUIRED.length + MARKUP_RULE_COUNT,
  };
}

/** Rules enforced against markup rather than against a phrase list. */
const MARKUP_RULE_COUNT = 7;

const isDirectRun =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(import.meta.dirname, 'check-content.ts');

if (isDirectRun) {
  const report = lint();

  if (report.htmlFiles.length === 0) {
    process.stdout.write(
      'note: no built HTML found. Run `pnpm build` first to check the rendered markup layer.\n',
    );
  }

  process.stdout.write(
    `content:check scanned ${report.sourceFileCount} source files, ` +
      `${report.contentStringCount} content strings, ` +
      `and ${report.htmlFiles.length} rendered documents\n`,
  );

  if (report.failures.length === 0) {
    process.stdout.write(`content:check passed ${report.ruleCount} rules\n`);
    process.stdout.write(`  files: ${report.scanned.join(', ')}\n`);
  } else {
    for (const failure of report.failures) {
      process.stderr.write(
        `${failure.file}:${failure.line}  [${failure.rule}] ${failure.message}\n`,
      );
    }
    process.stderr.write(`\ncontent:check failed with ${report.failures.length} problem(s)\n`);
    process.exit(1);
  }
}

export { REQUIRED, TEXT_RULES };
export type { Failure, RequiredPhrase, TextRule };
