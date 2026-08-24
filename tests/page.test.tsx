import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Page from '../app/page';
import {
  activityWindow,
  hero,
  privacy,
  proof,
  realAssets,
  run,
  sectionIds,
  workflow,
} from '../content';
import { renderPage } from './render';

describe('the Phase 0 page', () => {
  it('renders exactly the five sections and the run block', () => {
    const { container } = renderPage(<Page />);

    const sections = [...container.querySelectorAll('main > section')];
    expect(sections.map((section) => section.id)).toEqual([
      sectionIds.hero,
      sectionIds.workflow,
      sectionIds.window,
      sectionIds.proof,
      sectionIds.scope,
      sectionIds.run,
    ]);
  });

  it('leads with the agreed hero copy and both actions', () => {
    renderPage(<Page />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(hero.headline);
    expect(screen.getByText(hero.supporting)).toBeInTheDocument();
    expect(screen.getByText(hero.trustLine)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: hero.primaryAction.label })).toHaveAttribute(
      'href',
      `#${hero.primaryAction.targetId}`,
    );
    expect(screen.getByRole('link', { name: hero.secondaryAction.label })).toHaveAttribute(
      'href',
      `#${hero.secondaryAction.targetId}`,
    );
  });

  it('shows the honest proof-of-concept label in the page body', () => {
    const { container } = renderPage(<Page />);
    expect(container.textContent).toContain('Functional proof of concept');
  });

  it('names every one of the six workflow stages', () => {
    const { container } = renderPage(<Page />);
    for (const stage of workflow.stages) {
      expect(container.textContent).toContain(stage.name);
      expect(container.textContent).toContain(stage.detail);
    }
  });

  it('draws every image alt from the manifest and never renders an empty one', () => {
    const { container } = renderPage(<Page />);

    const images = [...container.querySelectorAll('img')];
    expect(images.length).toBeGreaterThan(0);

    const approvedAlts = new Set(realAssets.map((asset) => asset.alt));
    for (const image of images) {
      const alt = image.getAttribute('alt');
      expect(alt).toBeTruthy();
      expect(approvedAlts.has(alt ?? '')).toBe(true);
    }
  });

  it('labels every image with what it shows and which build it came from', () => {
    const { container } = renderPage(<Page />);
    const captions = [...container.querySelectorAll('figcaption')];
    expect(captions).toHaveLength(4);
    for (const caption of captions) {
      expect(caption.textContent).toContain('WorklyReel 0.1.0 on macOS');
    }
  });

  it('shows the export at its true 1080 by 1350 proportion', () => {
    const { container } = renderPage(<Page />);
    const exportImage = container.querySelector('.lp-figure--export img');
    expect(exportImage).not.toBeNull();
    expect(exportImage).toHaveAttribute('width', '1080');
    expect(exportImage).toHaveAttribute('height', '1350');
  });

  it('resolves every in-page anchor to an element that exists', () => {
    const { container } = renderPage(<Page />);

    const anchors = [...container.querySelectorAll('a[href^="#"]')];
    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) {
      const id = (anchor.getAttribute('href') ?? '').slice(1);
      expect(id).not.toBe('');
      expect(document.getElementById(id) ?? container.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it('has no empty href anywhere', () => {
    const { container } = renderPage(<Page />);
    for (const anchor of container.querySelectorAll('a')) {
      const href = anchor.getAttribute('href') ?? '';
      expect(href.trim()).not.toBe('');
      expect(href).not.toBe('#');
    }
  });

  it('offers no download, no form, and no waitlist', () => {
    const { container } = renderPage(<Page />);

    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector('textarea')).toBeNull();
    expect(container.querySelector('select')).toBeNull();
    expect(container.querySelector('a[download]')).toBeNull();
    expect(container.textContent?.toLowerCase()).not.toContain('waitlist');
    expect(container.textContent?.toLowerCase()).not.toContain('newsletter');
    expect(container.textContent?.toLowerCase()).not.toContain('pricing');
  });

  it('states the activity-window rules the linter also enforces', () => {
    const { container } = renderPage(<Page />);
    const text = container.textContent ?? '';

    expect(text).toContain('Day is one date');
    expect(text).toContain('Week is seven consecutive dates');
    expect(text).toContain('Custom Range is one to seven inclusive dates');
    expect(text).toContain('Weekends count');
    expect(text).toContain('future dates are disabled');
    for (const mode of activityWindow.modes) {
      expect(text).toContain(mode.startDate);
      expect(text).toContain(mode.endDate);
    }
  });

  it('lists everything Phase 0 does not ship', () => {
    const { container } = renderPage(<Page />);
    const text = container.textContent ?? '';
    for (const item of privacy.notShipped) {
      expect(text).toContain(item.label);
    }
    expect(text).toContain('No direct publishing to LinkedIn');
  });

  it('explains the compositor, the image model, and the immutable fork', () => {
    const { container } = renderPage(<Page />);
    const text = container.textContent ?? '';
    for (const claim of proof.claims) {
      expect(text).toContain(claim.title);
    }
  });

  it('gives the real clean-checkout commands as the scroll target', () => {
    const { container } = renderPage(<Page />);
    const target = container.querySelector(`#${sectionIds.run}`);
    expect(target).not.toBeNull();
    for (const step of run.steps) {
      expect(target?.textContent).toContain(step.command);
    }
  });
});
