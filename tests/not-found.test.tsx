import { describe, expect, it } from 'vitest';

import NotFound, { metadata } from '../app/not-found';
import { notFound } from '../content';
import { renderPage } from './render';

describe('the not-found route', () => {
  it('uses the same visual system and refuses indexing', () => {
    const { container } = renderPage(<NotFound />);

    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(container.querySelector('.lp-masthead')).not.toBeNull();
    expect(container.querySelector('.lp-footer')).not.toBeNull();
    expect(container.textContent).toContain(notFound.heading);
  });

  it('offers one way back, to a route that exists', () => {
    const { container } = renderPage(<NotFound />);

    const links = [...container.querySelectorAll('main a')];
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/');
  });

  it('has no dangling in-page anchor', () => {
    const { container } = renderPage(<NotFound />);
    for (const anchor of container.querySelectorAll('a[href^="#"]')) {
      const id = (anchor.getAttribute('href') ?? '').slice(1);
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
  });
});
