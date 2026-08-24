import { ThemeProvider } from '@maecly/workly-reel-ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import Page from '../app/page';
import { hero } from '../content';
import { renderPage } from './render';

/**
 * The page paints entirely from `--wr-*` properties, and the package redefines
 * those under `[data-theme]`. So a theme test is a test that the attribute is
 * written and that the same markup survives both values: there is no
 * dark-only markup and no light-only markup anywhere on the page.
 */
describe('both themes', () => {
  it('defaults to dark and writes it where the token stylesheet expects it', () => {
    renderPage(<Page />);
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('renders the same content under the light theme', () => {
    const { container } = render(
      <ThemeProvider defaultPreference="light">
        <Page />
      </ThemeProvider>,
    );

    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(container.querySelectorAll('main > section')).toHaveLength(6);
    expect(container.textContent).toContain(hero.headline);
    expect(container.querySelectorAll('img')).toHaveLength(4);
  });

  it('offers a control that says what pressing it will do', async () => {
    renderPage(<Page />);

    const toggle = screen.getByRole('button', { name: 'Switch to the light theme' });
    await userEvent.click(toggle);

    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(screen.getByRole('button', { name: 'Switch to the dark theme' })).toBeInTheDocument();
  });

  it('never hardcodes a colour in the landing stylesheet', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const css = readFileSync(join(process.cwd(), 'app', 'landing.css'), 'utf8');

    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\brgba?\(/i);
    expect(css).not.toMatch(/\boklch\(/i);
    expect(css).toMatch(/var\(--wr-color-canvas\)/);
  });
});
