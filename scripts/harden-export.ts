/**
 * Move the Content-Security-Policy to the front of every exported document.
 *
 * A policy delivered by meta tag governs only what the parser meets *after* it.
 * Next decides the order of its own head, and it puts its preloads, stylesheets
 * and script tags first: measured on a real build, the policy landed at head
 * position 15 with seven `<script>` tags already ahead of it. A policy that does
 * not cover the scripts on the page is decoration, and decoration that looks
 * like protection is worse than none, because it reads as covered.
 *
 * There is no supported way to make the App Router emit a tag first, so the
 * document is rewritten once, after export. This runs as part of `pnpm build`,
 * so what is tested and what is published are the same bytes.
 *
 * `tests/exported-html.test.ts` fails if the policy is ever not first, which is
 * what stops this script from silently doing nothing after a Next upgrade
 * changes the markup it matches.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const OUT_DIR = resolve(import.meta.dirname, '..', 'out');

/** The tag as React serialises it. Matched, never rebuilt, so the two cannot drift. */
const CSP_TAG = /<meta http-equiv="Content-Security-Policy" content="[^"]*"\s*\/?>/;
const HEAD_OPEN = /<head[^>]*>/;

const htmlFilesIn = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return htmlFilesIn(path);
    return path.endsWith('.html') ? [path] : [];
  });

const hoist = (html: string): string | null => {
  const tag = CSP_TAG.exec(html);
  const head = HEAD_OPEN.exec(html);
  if (tag === null || head === null) return null;

  const alreadyFirst = tag.index === head.index + head[0].length;
  if (alreadyFirst) return null;

  const withoutTag = html.slice(0, tag.index) + html.slice(tag.index + tag[0].length);
  const insertAt = withoutTag.search(HEAD_OPEN) + head[0].length;
  return withoutTag.slice(0, insertAt) + tag[0] + withoutTag.slice(insertAt);
};

const files = htmlFilesIn(OUT_DIR);
if (files.length === 0) {
  console.error('No exported HTML found. Run `next build` first.');
  process.exit(1);
}

let moved = 0;
let missing = 0;

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  if (!CSP_TAG.test(html)) {
    console.error(`  no policy in ${file.slice(OUT_DIR.length + 1)}`);
    missing += 1;
    continue;
  }
  const hoisted = hoist(html);
  if (hoisted !== null) {
    writeFileSync(file, hoisted);
    moved += 1;
  }
}

if (missing > 0) {
  console.error(`${missing} exported document(s) carry no policy at all.`);
  process.exit(1);
}

console.log(`Policy hoisted in ${moved} of ${files.length} exported document(s).`);
