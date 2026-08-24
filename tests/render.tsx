import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

import { ThemeRoot } from '../components/ThemeRoot';

/**
 * Render inside the theme provider the page depends on.
 *
 * Every section is a server component, but each one is a plain synchronous
 * function, so the same tree renders in jsdom. Only the theme toggle and the
 * scroll actions are genuinely client-side, and both need this provider.
 */
export const renderPage = (ui: ReactElement) => render(<ThemeRoot>{ui}</ThemeRoot>);
