'use client';

import { ThemeProvider } from '@maecly/workly-reel-ui';
import type { ReactNode } from 'react';

/**
 * Supplies the theme context the toggle reads.
 *
 * Dark is the default for this page, and the same value is written on `<html>`
 * during server rendering, so the first paint and the first client render
 * agree and nothing flashes. Light is a real theme here rather than an
 * afterthought: the page paints entirely from `--wr-*` properties, which the
 * package redefines under `[data-theme="light"]`.
 */
export function ThemeRoot({ children }: { readonly children: ReactNode }) {
  return <ThemeProvider defaultPreference="dark">{children}</ThemeProvider>;
}
