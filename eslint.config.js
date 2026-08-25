import js from '@eslint/js';

/**
 * The scaffold declares `pnpm lint` but shipped no flat config, so `pnpm verify`
 * could not complete. This is what can honestly run today.
 *
 * TypeScript and TSX are **not** linted, and that is a dependency problem
 * rather than a choice. `eslint@10.9.1` is pinned here, while
 * `eslint-config-next@16.3.2` brings `@typescript-eslint/*@8.67` and
 * `eslint-plugin-react@7.37`, both of which read rule and scope-manager APIs
 * that ESLint 10 removed. Enabling them fails with
 * `scopeManager.addGlobals is not a function` on the first `.tsx` file. The
 * fix is a dependency bump in `package.json`, not a rule change here, so the
 * gap is recorded rather than papered over with an ignore list that looks
 * deliberate.
 *
 * In the meantime the TypeScript surface is covered by `pnpm typecheck` under
 * `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
 * `noUnusedLocals`, and `noUnusedParameters`, by `pnpm content:check`, and by
 * `pnpm test`.
 */
export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      'public/**',
      // Build output and test artefacts, all of them bundled JavaScript written
      // by a tool rather than by anyone here. `out/` is the exported site; the
      // rest are written by Playwright and Vitest. Without these, whether
      // `pnpm lint` passes depends on whether anyone has run the tests since
      // the last clean, which is not a property a gate should have.
      'out/**',
      'playwright-report/**',
      'blob-report/**',
      'test-results/**',
      'coverage/**',
      // See the note above. Not a preference.
      '**/*.ts',
      '**/*.tsx',
      '**/*.mts',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
  },
];
