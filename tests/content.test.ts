import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import * as content from '../content';
import { activityWindow, privacy, proof, realAssets, site } from '../content';

/** Every string the page can render, flattened once and reused by each rule. */
const allStrings = (() => {
  const found: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      found.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === 'object' && node !== null) {
      for (const value of Object.values(node)) {
        if (typeof value !== 'function') {
          walk(value);
        }
      }
    }
  };
  walk(content);
  return found;
})();

const copy = allStrings.join('\n');

describe('the content module', () => {
  it('uses no banned marketing word', () => {
    for (const banned of [
      /revolutionary/i,
      /effortless/i,
      /\b10x\b/i,
      /thought leader/i,
      /personal brand on autopilot/i,
      /never share (your )?data/i,
    ]) {
      expect(copy).not.toMatch(banned);
    }
  });

  it('uses no em dash in visible copy', () => {
    expect(copy).not.toContain('—');
  });

  it('names no platform or runtime that is not shipped or tested', () => {
    for (const unshipped of [
      /\bwindows\b/i,
      /\blinux\b/i,
      /\bcuda\b/i,
      /\bmetal\b/i,
      /\bamd\b/i,
      /\bnvidia\b/i,
      /\bintel\b/i,
      /llama\.cpp/i,
      /stable-diffusion\.cpp/i,
    ]) {
      expect(copy).not.toMatch(unshipped);
    }
  });

  it('never implies the product posts to LinkedIn', () => {
    expect(copy).not.toMatch(/auto-?post/i);
    expect(copy).not.toMatch(/one-click (post|publish|share)/i);
    expect(copy).not.toMatch(/LinkedIn (integration|api|account)/i);

    // LinkedIn may only be named in a sentence that denies the capability or
    // hands the action back to the reader. Every other framing is a promise
    // the desktop repository cannot keep.
    const sentences = allStrings.flatMap((value) => value.split(/(?<=[.!?])\s+/));
    const mentions = sentences.filter((sentence) => /linkedin/i.test(sentence));
    expect(mentions.length).toBeGreaterThan(0);
    for (const sentence of mentions) {
      expect(sentence).toMatch(/\b(no|not|never|without|cannot|yourself|ready)\b/i);
    }
  });

  it('carries the honest status label', () => {
    expect(site.phaseLabel).toBe('Functional proof of concept');
    expect(copy).toMatch(/proof of concept/i);
  });

  it('states the Day, Week, Custom Range, seven-day, and weekend rules', () => {
    expect(activityWindow.standfirst).toContain('Day is one date');
    expect(activityWindow.standfirst).toContain('Week is seven consecutive dates');
    expect(activityWindow.standfirst).toContain('Custom Range is one to seven inclusive dates');
    expect(activityWindow.standfirst).toContain('Weekends count');
    expect(activityWindow.standfirst).toContain('future dates are disabled');
  });

  it('names no price, metric, testimonial, or star count', () => {
    expect(copy).not.toMatch(/\d+\s?%/);
    expect(copy).not.toMatch(/\bpricing\b/i);
    expect(copy).not.toMatch(/\bwaitlist\b/i);
    expect(copy).not.toMatch(/\btestimonial\b/i);
    expect(copy).not.toMatch(/\bstars?\b/i);
  });
});

describe('the window rules, as the shipped contract reports them', () => {
  it('derives one, seven, and a range inside the bounds', () => {
    expect(activityWindow.bounds).toEqual({ min: 1, max: 7 });
    const [day, week, custom] = activityWindow.modes;
    expect(day?.dayCount).toBe(1);
    expect(day?.startDate).toBe(day?.endDate);
    expect(week?.dayCount).toBe(7);
    expect(custom?.dayCount).toBeGreaterThanOrEqual(1);
    expect(custom?.dayCount).toBeLessThanOrEqual(7);
  });

  it('treats Saturday and Sunday as ordinary selectable dates', () => {
    for (const entry of activityWindow.weekendProof.dates) {
      expect(entry.weekend).toBe(true);
    }
  });

  it('quotes real refusals rather than invented ones', () => {
    const codes = activityWindow.refusals.map((refusal) => refusal.code);
    expect(codes).toContain('range-too-long');
    expect(codes).toContain('future-date');
    expect(codes).toContain('reversed-range');
    expect(codes).toContain('week-must-span-seven-days');
    for (const refusal of activityWindow.refusals) {
      expect(refusal.message.length).toBeGreaterThan(0);
    }
  });
});

describe('the real assets', () => {
  it('describes exactly the three approved files', () => {
    expect(realAssets).toHaveLength(3);
    for (const asset of realAssets) {
      expect(asset.approved).toBe(true);
      expect(asset.dataPolicy).toBe('synthetic');
      expect(asset.alt.trim().length).toBeGreaterThan(0);
      expect(asset.caption.trim().length).toBeGreaterThan(0);
    }
  });

  it('matches the bytes on disk, so nothing was reconstructed', () => {
    for (const asset of realAssets) {
      const bytes = readFileSync(join(process.cwd(), 'public', asset.file));
      expect(bytes.byteLength).toBe(asset.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
    }
  });

  it('reads the export at the size the compositor wrote', () => {
    expect(proof.template.width).toBe(1080);
    expect(proof.template.height).toBe(1350);
    expect(proof.template.family).toBe('Signal');
  });
});

describe('the scope list', () => {
  it('names every capability Phase 0 does not have', () => {
    const labels = privacy.notShipped.map((item) => item.label);
    expect(labels).toEqual([
      'No local AI',
      'No cloud AI',
      'No model manager',
      'No additional templates or formats',
      'No scheduler',
      'No updater',
      'No telemetry',
      'No direct publishing to LinkedIn',
    ]);
  });
});
