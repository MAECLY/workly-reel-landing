'use client';

import { Button, useTheme } from '@maecly/workly-reel-ui';

const LABELS = {
  dark: { action: 'Switch to the light theme', state: 'Dark' },
  light: { action: 'Switch to the dark theme', state: 'Light' },
} as const;

/**
 * Flips the page between the two themes the design system ships.
 *
 * The state is announced in text rather than by an icon alone, and the
 * accessible name says what pressing it will do rather than what is currently
 * true, which is the difference between a control and a status readout.
 */
export function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const label = LABELS[resolvedTheme];

  return (
    <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label={label.action}>
      <span aria-hidden="true">{label.state}</span>
    </Button>
  );
}
