# workly-reel-landing

The Phase 0 landing page for **WorklyReel by MAECLY**.

|                      |                                                      |
| -------------------- | ---------------------------------------------------- |
| **Product**          | WorklyReel                                           |
| **Endorsement**      | by MAECLY                                            |
| **Category**         | Developer Proof-of-Work                              |
| **Workflow**         | Evidence-to-Brand                                    |
| **Canonical origin** | `https://workly-reel.maecly.com/`                    |
| **Framework**        | Next.js 16, App Router, strict TypeScript            |
| **Design system**    | `@maecly/workly-reel-ui`, pinned to commit `837a08b` |

> **Phase 0: functional proof of concept.**
> One English route with five sections and a run block. It describes only what
> the desktop repository actually ships, it collects nothing, it links to no
> download, and it is deliberately not indexable. Everything else is recorded in
> [`docs/phased-roadmap.md`](docs/phased-roadmap.md) as backlog, not as work.

## From a clean checkout

Requires Node 22.12 or newer and pnpm 11. `pnpm install` resolves
`@maecly/workly-reel-ui` over SSH from a private repository, so it needs an SSH
key with read access to `MAECLY/workly-reel-ui`.

```bash
git clone git@github.com:MAECLY/workly-reel-landing.git
cd workly-reel-landing

pnpm install
pnpm dev            # http://localhost:3000
```

The design system commits its `dist/`, so no build step runs inside
`node_modules` and the page renders identically on a machine that has never
built the package.

## Scripts

| Command                             | What it does                                               |
| ----------------------------------- | ---------------------------------------------------------- |
| `pnpm dev`                          | Development server                                         |
| `pnpm build`                        | Production build. Every route prerenders as static content |
| `pnpm start`                        | Serve the production build                                 |
| `pnpm typecheck`                    | `tsc --noEmit`                                             |
| `pnpm content:check`                | The content linter. See below                              |
| `pnpm test`                         | Vitest, including the linter's own regression suite        |
| `pnpm format` / `pnpm format:check` | Prettier                                                   |
| `pnpm lint`                         | ESLint. **Partial.** See the note under Tests              |
| `pnpm verify`                       | Everything above, in the order CI runs it                  |

## Editing the content

**Every rendered string lives in `content/`.** Nothing is written inline in a
component, so a translator can be handed that one directory and a later
localisation pass swaps the modules behind `content/index.ts` rather than
editing JSX.

| File                         | Owns                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| `content/site.ts`            | Identity, metadata, section ids, and the theme colours read from the token document |
| `content/hero.ts`            | Section 1                                                                           |
| `content/workflow.ts`        | Section 2, the six Phase 0 stages                                                   |
| `content/activity-window.ts` | Section 3. **Derived**, see below                                                   |
| `content/proof.ts`           | Section 4, including the quoted post copy                                           |
| `content/privacy.ts`         | Section 5, including the not-shipped register                                       |
| `content/run.ts`             | The run block, copied from the desktop README                                       |
| `content/assets.ts`          | The manifest reader. The only place an asset path is resolved                       |
| `content/types.ts`           | The shape of all of the above                                                       |

Two modules are **derived rather than written**, and editing them by hand is a
mistake:

- `content/activity-window.ts` calls the shipped `buildActivityWindow`,
  `rangeForKind`, `inclusiveDayCount`, and `isWeekend` from
  `@maecly/workly-reel-ui/domain` at build time. Every range, every day count,
  and every refusal message on the page is what the contract actually returns.
  If a rule changes in the design system, this copy changes with it, and the
  module throws at build time if the contract ever accepts something the page
  claims it refuses.
- `content/proof.ts` reads `signalPortrait` and `socialCanvases` from
  `@maecly/workly-reel-ui/social-templates` and `/tokens`, so the canvas size,
  the layout version, the palette, and the text-region count are read from the
  same definition the Rust compositor deserialises.

Both entry points are pure data and pure functions, documented as safe to import
from a React Server Component. **The package root is a client boundary.** A
server component may render `Button` or `ThemeProvider`, but it may not call a
function from `@maecly/workly-reel-ui`; use `/domain`, `/tokens`, or
`/social-templates` instead.

### Colour

No colour is authored in this repository. `app/landing.css` paints entirely from
the design system's `--wr-*` custom properties, and a test fails the build on a
hex, `rgb()`, or `oklch()` literal in that file. The single exception is the
`theme-color` meta tag, which cannot reference a custom property; it reads
`darkTheme.canvas` and `lightTheme.canvas` from the generated token document.

Dark is the default and is written on `<html data-theme="dark">` during server
rendering, so the first paint and the first client render agree. The toggle
flips the same attribute through the package's `ThemeProvider`.

## Real asset provenance

**Every image on this page is real.** Two are screenshots of the running desktop
application; one is an export the shipped compositor produced. Nothing is a
mock-up and nothing was reconstructed in HTML or in a design tool.

`public/assets/manifest.json` is the only register of what may be rendered. It
records, per file: the caption, the alt text, the true pixel dimensions, the
byte size, the SHA-256, the build it was captured from, and an explicit
`approved` flag. `generatedFrom` records the two commits behind the pictures:

|               |                                            |
| ------------- | ------------------------------------------ |
| Desktop       | `7008c56a45e3a8a750ae508e5fe6d250ebaa17dd` |
| Design system | `837a08bdb4c1a84f4002cd3f38a9e28069965ab2` |

| Asset                            | What it is                                                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `screenshot-evidence-review.png` | Evidence Review, 1280 x 860, showing a source that could not be read reporting its activity as unknown rather than as zero |
| `screenshot-activity-window.png` | The Home screen, 1280 x 860, showing a seven-day Week selection including its Saturday and Sunday                          |
| `export-signal-portrait.png`     | A real 1080 x 1350 export from the deterministic compositor                                                                |

Every asset uses the synthetic Harbour Ledger fixture and the fictional author
A. Rivera, so no real repository, employer, person, path, or credential appears
in a published example.

Three mechanisms keep it that way. `content/assets.ts` refuses an unapproved
entry, an unknown kind, or blank alt text, and throws on a path the manifest does
not describe. `components/AssetFigure.tsx` is the only component that renders an
image, and it draws the alt text, caption, dimensions, byte size, hash prefix,
and originating build from the manifest, so a caller cannot relabel a figure.
`pnpm test` re-hashes each file on disk against the manifest.

The reasoning is recorded in
[`docs/adr-0001-real-assets.md`](docs/adr-0001-real-assets.md).

### Replacing an asset

1. Run the desktop application at a known commit and capture again, or produce a
   new export.
2. Confirm the picture contains no real project, person, path, or credential.
3. Copy it into `public/assets/`.
4. Update its entry in `manifest.json`: `bytes`, `sha256`
   (`shasum -a 256 <file>`), `width`, `height`, `capturedFrom`, `caption`, and
   `alt`. Update `generatedFrom` if the commit changed.
5. `pnpm test` fails if the bytes and the manifest disagree.

## The content linter

`pnpm content:check` runs `scripts/check-content.ts` over three layers: the typed
content module, the TSX that renders it, and the HTML `next build` produced.
Comments are excluded, because a comment explains a decision and is not visible
copy. It prints `file:line  [rule] message` for each failure and exits non-zero.

It fails on:

| Rule                   | What it rejects                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `banned-word`          | revolutionary, effortless, 10x, thought leader, personal brand on autopilot, never share data                                              |
| `em-dash`              | an em dash anywhere in visible copy                                                                                                        |
| `unshipped-platform`   | Windows, Linux, CUDA, Metal, AMD, NVIDIA, Intel, llama.cpp, stable-diffusion.cpp                                                           |
| `implied-publishing`   | any phrasing implying the product posts or publishes to LinkedIn, a LinkedIn integration, automatic posting, or one-click publishing       |
| `no-funnel`            | waitlist, newsletter, signup list, pricing, free trial, demo booking, testimonial, customer logos                                          |
| `fabricated-metric`    | a percentage, an "n times faster" claim, a star count, an adoption figure                                                                  |
| `empty-href`           | `href=""` or `href="#"`                                                                                                                    |
| `dangling-anchor`      | `href="#x"` with no element carrying `id="x"` in the same document                                                                         |
| `missing-alt`          | an `<img>` or `<Image>` with no alt text                                                                                                   |
| `unlisted-asset`       | a `/assets/…` media reference the manifest does not describe                                                                               |
| `no-forms`             | `<form>`, `<input>`, `<textarea>`, `<select>`                                                                                              |
| `no-download`          | a `download` attribute on an anchor                                                                                                        |
| `no-analytics`         | a known analytics marker in the built HTML                                                                                                 |
| `missing-status-label` | the absence of the visible `proof of concept` label                                                                                        |
| `missing-window-copy`  | the absence of Day, Week, Custom Range, the seven-consecutive-dates rule, the one-to-seven rule, the weekend rule, or the future-date rule |

`implied-publishing` forgives a match whose sentence carries an explicit denial
or hands the action to the reader, which is how the honest form is written: "No
direct publishing to LinkedIn", "you post it yourself". "LinkedIn-ready" is a
size and a shape, not a promise, so it passes.

The rule tables are exported and `tests/check-content.test.ts` feeds each one the
phrasing it exists to reject, because a rule table that silently matches nothing
reports a clean page either way.

The HTML layer is checked only when `.next` output exists. Run `pnpm build`
first, or accept the printed note that the markup layer was skipped.

## Tests

```bash
pnpm test
```

| Suite                         | Covers                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/page.test.tsx`         | The five sections and the run block, the hero copy, both actions, the six stages, alt text drawn from the manifest, the caption and build label on every figure, the export at true proportion, every in-page anchor resolving, no empty href, no download or form or waitlist, the window rules, the not-shipped list, and the run commands |
| `tests/metadata.test.ts`      | Title and description leading with Developer Proof-of-Work, `robots: { index: false, follow: false }`, the real export as the Open Graph image at its true size, the canonical with its trailing slash, the one-entry sitemap, and `robots.txt`                                                                                              |
| `tests/content.test.ts`       | No banned word, no em dash, no unshipped platform, no implied publishing, the proof-of-concept label, the Day / Week / Custom Range copy, no fabricated metric, the derived window values, and the SHA-256 of every asset against the bytes on disk                                                                                          |
| `tests/theme.test.tsx`        | Dark by default, the same markup under light, the toggle's accessible name, and no hardcoded colour in `app/landing.css`                                                                                                                                                                                                                     |
| `tests/check-content.test.ts` | The linter passes the page as it stands, and each rule still rejects its own violation and accepts the honest phrasing                                                                                                                                                                                                                       |
| `tests/not-found.test.tsx`    | The 404 route uses the same visual system, refuses indexing, and offers one way back to a route that exists                                                                                                                                                                                                                                  |

**`pnpm lint` is partial, and that is a dependency problem rather than a
choice.** `eslint@10.9.1` is pinned while `eslint-config-next@16.3.2` brings
`@typescript-eslint/*@8.67` and `eslint-plugin-react@7.37`, both of which read
rule and scope-manager APIs that ESLint 10 removed; enabling them fails with
`scopeManager.addGlobals is not a function` on the first `.tsx` file. Until those
versions move, `eslint.config.js` lints the plain-JavaScript surface only and
records the reason in a comment. The TypeScript surface is covered by
`pnpm typecheck` under `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noUnusedLocals`, and `noUnusedParameters`, and by
the suites above.

## Production build

```bash
pnpm build
pnpm start          # http://localhost:3000
```

Every route prerenders as static content: `/`, `/_not-found`, `/icon.png`,
`/icon1.png`, `/robots.txt`, and `/sitemap.xml`. Client JavaScript is limited to
the theme provider, the theme toggle, and the two scroll actions.

`next.config.ts` sends `X-Robots-Tag: noindex, nofollow`,
`X-Content-Type-Options: nosniff`, a `strict-origin-when-cross-origin` referrer
policy, and a Content Security Policy with `form-action 'none'` and
`frame-ancestors 'none'`. Confirm them on a real response before deploying:

```bash
curl -sI http://localhost:3000/ | grep -i 'x-robots-tag\|content-security-policy'
```

## Deployment

**Not yet deployed.** Phase 0 has not been linked to a Vercel project, so nothing
below describes a configuration that currently exists. It is the documented
procedure, to be followed once and then recorded here with the real project id.

### Linking the Vercel project

```bash
pnpm dlx vercel@latest login
pnpm dlx vercel@latest link          # MAECLY scope, project `workly-reel-landing`
pnpm dlx vercel@latest pull          # writes .vercel/, which is gitignored
```

Settings to confirm in the project, once:

Most of this is already committed in `vercel.json`, so the dashboard should
need no manual configuration:

| Setting           | Value                            | Where it is set |
| ----------------- | -------------------------------- | --------------- |
| Framework preset  | Next.js                          | `vercel.json`   |
| Install command   | `bash scripts/vercel-install.sh` | `vercel.json`   |
| Build command     | `pnpm run build`                 | `vercel.json`   |
| Output directory  | `.next`                          | `vercel.json`   |
| Node version      | 22.x or newer                    | dashboard       |
| Production branch | `main`                           | dashboard       |

One environment variable is required, for both Production and Preview:

| Variable                    | What it is                                                            |
| --------------------------- | --------------------------------------------------------------------- |
| `WORKLY_REEL_UI_DEPLOY_KEY` | The private half of a read-only deploy key on `MAECLY/workly-reel-ui` |

The page itself reads nothing at runtime. That variable exists only so the
build can fetch the private design system.

### Why the install command is a script

The design system is a private repository consumed as a pinned git dependency. A
local machine resolves it through the developer's own SSH agent. A Vercel build
has neither an agent nor a key, so a plain `pnpm install` fails at the git fetch
with a permission error that reads like a missing package.

`scripts/vercel-install.sh` writes the deploy key from the build environment,
restricts SSH to it, and then installs normally. With no key set it falls back to
the ambient SSH configuration, so the same script is what runs locally.

Generate the pair once:

```bash
ssh-keygen -t ed25519 -C "vercel@workly-reel-landing" -f ./deploy-key -N ""
```

Add `deploy-key.pub` to `MAECLY/workly-reel-ui` under Settings, Deploy keys,
**without** write access. Paste the contents of `deploy-key` into the Vercel
variable. Then delete both local files.

Deploy a preview first, then promote:

```bash
pnpm dlx vercel@latest deploy                 # preview URL
pnpm dlx vercel@latest deploy --prod          # production
```

### Verifying the custom domain

1. Add `workly-reel.maecly.com` to the project's domains.
2. Create the `CNAME` record Vercel prints, at the DNS provider for
   `maecly.com`. Do not guess the target; copy it from the dashboard.
3. Wait for the certificate to be issued, then check both the address and the
   posture:

```bash
dig +short workly-reel.maecly.com
curl -sI https://workly-reel.maecly.com/ | grep -i 'x-robots-tag\|location'
curl -s  https://workly-reel.maecly.com/ | grep -o '<link rel="canonical"[^>]*>'
curl -s  https://workly-reel.maecly.com/robots.txt
```

The canonical must read `https://workly-reel.maecly.com/`, with the trailing
slash, and appear exactly once. `robots.txt` must disallow everything. The
deployment URL must redirect to the custom domain rather than serving a second
copy of the page at a second address.

### Rolling back

A deployment is immutable, so a rollback is a promotion of the previous one and
not a rebuild.

```bash
pnpm dlx vercel@latest ls workly-reel-landing         # find the last good deployment
pnpm dlx vercel@latest promote <deployment-url>
```

Then re-check the canonical and `robots.txt` on the custom domain, because a
rollback moves the domain to older markup.

If the problem is a claim rather than a defect, roll back first and correct the
copy afterwards. A wrong capability claim on a public page is not a bug to fix
forward.

## Claim review

Run [`docs/phase-0-checklist.md`](docs/phase-0-checklist.md) before any
deployment and again after any copy change. It is nine sections: claims,
accessibility, screenshots, asset privacy, links, metadata, tests, performance,
and local execution, with the command that proves each automated item.

Every capability sentence on this page must be checkable against the desktop
repository, at the commit the manifest names:

- `workly-reel/README.md` for what the application does.
- `workly-reel/docs/platform-support.md` for the one environment it has been run
  in. Every other platform is unverified, and the page names none of them.
- `workly-reel/docs/phased-roadmap.md` for what is backlog. The not-shipped
  register in section 5 must stay in step with it.
- `workly-reel/docs/evidence-model.md` for the naming policies and the source
  outcomes.
- `workly-reel/docs/compositor.md` and `docs/export-and-provenance.md` for the
  claims in section 4.

If a sentence cannot be traced to one of those, it does not belong on the page.

## Documents

- [`docs/adr-0001-real-assets.md`](docs/adr-0001-real-assets.md)
- [`docs/phased-roadmap.md`](docs/phased-roadmap.md)
- [`docs/phase-0-checklist.md`](docs/phase-0-checklist.md)

## Licence

`UNLICENSED`. Private during Phase 0.
