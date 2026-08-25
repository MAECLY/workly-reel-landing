import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The promise the landing layer opens with, held to the file itself.
 *
 * `app/landing.css` says at the top that every colour comes from a `--wr-*`
 * custom property the design system emits, and that the only values authored
 * here are layout geometry and a display type scale. Everything downstream
 * depends on it: the light theme exists because the package redefines those
 * properties, so a colour written as a literal is a surface that will not
 * follow the theme, and one that no longer answers to the design system at all.
 *
 * `theme.test.tsx` has asked a narrower version of this since the file existed:
 * it greps the whole stylesheet for a hex, an `rgb()`, or an `oklch()`. That
 * knows three of the ways a colour can be written - a gradient in `hsl()`, a
 * `color-mix()` of two named colours, and a `lab()` all walk past it - and,
 * reading the file as one string, it can say only that one is somewhere.
 *
 * This asks it of each declaration, so a failure names the line, and it is
 * keyed on the *property* rather than on the value: a colour-bearing
 * declaration that refers to no token at all is a defect however it is
 * spelled, and whether or not the colour it names happens to be one the token
 * document already contains. The browser is asked the same question from the
 * other side in `theme.e2e.ts`, by overriding the tokens and watching which
 * surfaces move.
 */

const ROOT = resolve(import.meta.dirname, '..');
const STYLESHEET = join(ROOT, 'app', 'landing.css');

/**
 * Properties that put a colour on the screen.
 *
 * The shorthands are here as well as the longhands, because a gradient is a
 * `background` and a hairline is a `border`, and both are usually written the
 * short way.
 */
const PAINTS_A_COLOUR = new Set([
  'color',
  'background',
  'background-color',
  'background-image',
  'border',
  'border-color',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-block',
  'border-inline',
  'border-block-start',
  'border-block-end',
  'border-inline-start',
  'border-inline-end',
  'outline',
  'outline-color',
  'box-shadow',
  'text-shadow',
  'text-decoration',
  'text-decoration-color',
  'column-rule',
  'column-rule-color',
  'caret-color',
  'accent-color',
  'fill',
  'stroke',
]);

/**
 * A colour written out rather than referred to: a hex, a colour function, or
 * one of the names CSS ships. Matched in values only, so `white-space` is a
 * property and not a colour.
 */
const COLOUR_LITERAL =
  /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\s*\(|\b(?:white|black|red|green|blue|yellow|orange|purple|pink|brown|gray|grey|silver|gold|navy|teal|olive|maroon|aqua|fuchsia|lime|beige|ivory|coral|crimson|indigo|violet|salmon|plum|orchid|azure|snow|linen|wheat|tomato|darkgray|darkgrey|lightgray|lightgrey)\b/;

/** Values that name no colour at all, and so have nothing to derive from a token. */
const NAMES_NO_COLOUR = new Set([
  'none',
  'transparent',
  'currentcolor',
  'inherit',
  'initial',
  'unset',
  'revert',
  '0',
]);

interface Declaration {
  readonly property: string;
  readonly value: string;
  readonly line: number;
}

/**
 * Every declaration in the file, with the line it is on.
 *
 * Comments are stripped first, since they describe colours in prose. At-rule
 * preludes cannot be mistaken for declarations because a value here may not
 * cross a brace.
 */
const declarationsOf = (css: string): readonly Declaration[] => {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));

  return [...source.matchAll(/(--[\w-]+|[a-z-]+)\s*:\s*([^;{}]+)[;}]/g)].map((match) => ({
    property: (match[1] ?? '').toLowerCase(),
    value: (match[2] ?? '').trim(),
    line: source.slice(0, match.index).split('\n').length,
  }));
};

const stylesheet = readFileSync(STYLESHEET, 'utf8');
const declarations = declarationsOf(stylesheet);

describe('the landing stylesheet', () => {
  it('is being read as a stylesheet at all', () => {
    // Everything below is a filter over this list, and a filter over nothing
    // passes. The counts say the parser is still finding the file it thinks it
    // is; they are floors rather than totals, so ordinary editing cannot fail
    // them.
    expect(declarations.length, 'no declarations were found in the landing layer').toBeGreaterThan(
      200,
    );
    expect(
      declarations.filter((declaration) => PAINTS_A_COLOUR.has(declaration.property)).length,
      'nothing in the landing layer paints a colour any more',
    ).toBeGreaterThan(20);
  });

  it('writes no colour of its own, anywhere', () => {
    const literals = declarations
      .filter((declaration) => COLOUR_LITERAL.test(declaration.value))
      .map(
        (declaration) =>
          `line ${declaration.line}: ${declaration.property} is written as ${declaration.value}`,
      );

    expect(
      literals,
      'a colour is written into the landing layer instead of being taken from a token',
    ).toEqual([]);
  });

  it('takes every colour it paints from a custom property', () => {
    const authored = declarations
      .filter((declaration) => PAINTS_A_COLOUR.has(declaration.property))
      .filter((declaration) => !declaration.value.includes('var(--'))
      .filter((declaration) => !NAMES_NO_COLOUR.has(declaration.value.toLowerCase()))
      .map(
        (declaration) =>
          `line ${declaration.line}: ${declaration.property}: ${declaration.value} refers to no token`,
      );

    expect(authored, 'a surface is painted from something other than the design system').toEqual(
      [],
    );
  });
});
