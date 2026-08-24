import { describe, expect, it } from 'vitest';

import { REQUIRED, TEXT_RULES, lint } from '../scripts/check-content';

/**
 * The linter's own regression suite.
 *
 * A rule table this large fails silently the moment one pattern is mistyped:
 * the page still passes, and nothing says the check stopped working. Each rule
 * is therefore given the phrasing it exists to reject.
 */
const rejects = (sample: string): boolean =>
  TEXT_RULES.some((rule) => new RegExp(rule.pattern.source, rule.pattern.flags).test(sample));

describe('scripts/check-content.ts', () => {
  it('passes the page as it stands', () => {
    const report = lint();
    expect(report.failures).toEqual([]);
    expect(report.sourceFileCount).toBeGreaterThan(10);
  });

  it.each([
    ['a revolutionary way to ship'],
    ['effortless posts, every week'],
    ['a 10x engineer writes here'],
    ['become a thought leader'],
    ['personal brand on autopilot'],
    ['we never share data with anyone'],
    ['evidence, then a story, then a card'.replace('then a card', 'a card — exported')],
    ['also available on Windows'],
    ['runs on Linux too'],
    ['CUDA acceleration included'],
    ['Metal acceleration included'],
    ['AMD cards are supported'],
    ['NVIDIA cards are supported'],
    ['macOS on Intel is supported'],
    ['powered by llama.cpp'],
    ['artwork from stable-diffusion.cpp'],
    ['it publishes to LinkedIn for you'],
    ['connect your LinkedIn account to begin'],
    ['auto-post your weekly recap'],
    ['one-click publish to your feed'],
    ['join the waitlist'],
    ['sign up for our newsletter'],
    ['see pricing'],
    ['start your free trial'],
    ['read a testimonial'],
    ['trusted by engineering teams'],
    ['40% faster reviews'],
    ['3x faster than writing it yourself'],
    ['4.2k stars on GitHub'],
    ['used by 12000 developers'],
  ])('rejects %j', (sample) => {
    expect(rejects(sample)).toBe(true);
  });

  it.each([
    ['export a LinkedIn-ready visual'],
    ['No direct publishing to LinkedIn. You post it yourself.'],
    ['Deterministic offline output works without an account.'],
    ['Week is seven consecutive dates.'],
  ])('accepts the honest phrasing %j', (sample) => {
    const flagged = TEXT_RULES.filter((rule) => {
      const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
      const match = pattern.exec(sample);
      if (match === null) {
        return false;
      }
      return rule.unless === undefined || !rule.unless.test(sample);
    });
    expect(flagged).toEqual([]);
  });

  it('requires the status label and every window rule', () => {
    const ids = REQUIRED.map((phrase) => phrase.id);
    expect(ids).toContain('missing-status-label');
    expect(REQUIRED.filter((phrase) => phrase.id === 'missing-window-copy')).toHaveLength(7);

    for (const phrase of REQUIRED) {
      expect(phrase.pattern.test('nothing relevant here')).toBe(false);
    }
  });
});
