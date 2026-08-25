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
| `pnpm test:e2e`                     | Playwright, Chromium at a desktop and a phone width        |
| `pnpm smoke`                        | Four questions of the production build. See below          |
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
| `tests/landing-css.test.ts`   | Every declaration in `app/landing.css`, one at a time: no colour written out in any notation, and every colour-bearing property taking its value from a custom property                                                                                                                                                                      |

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

### End to end

```bash
pnpm test:e2e
```

Playwright drives the real production server. `playwright.config.ts` runs
`pnpm build && pnpm start -p 3210` and reuses an already running one outside CI.
Two projects, both Chromium: one at 1280 by 900 and one at a 390 by 844 phone
viewport. WebKit is not installed and is not used. The specs live in
`tests/e2e/` behind a `.e2e.ts` suffix, so neither runner can pick up the
other's files.

**`pnpm verify` runs this step as `CI=1 pnpm test:e2e`, and running it by hand
is worth doing the same way.** Server reuse is the reason: with anything already
listening on 3210, `pnpm build` never runs and the suite reports on whatever
that server was built from. A deliberately broken `alt` attribute was measured
passing 10 of 10 accessibility tests against a stale server while the source on
disk was already wrong.

| Spec                          | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/e2e/page.e2e.ts`       | 200 from `next start`, the five sections and the run block by their real ids, every workflow stage anchored, the primary action scrolling the run instructions into view and moving focus with it, and every manifest image decoding at the size the manifest records                                                                                                                                                                                                                                                                                        |
| `tests/e2e/metadata.e2e.ts`   | The canonical with its trailing slash, `noindex, nofollow` in the meta tag and in the `X-Robots-Tag` header, the Open Graph image resolving to the real export byte for byte, and `/sitemap.xml` and `/robots.txt` rooted at the agreed origin                                                                                                                                                                                                                                                                                                               |
| `tests/e2e/responsive.e2e.ts` | At 390, 768, 1280, and 1680: no horizontal scroll, no element past the viewport, the headline in four lines or fewer, and every interactive target at least 24 by 24                                                                                                                                                                                                                                                                                                                                                                                         |
| `tests/e2e/a11y.e2e.ts`       | axe-core reporting nothing serious or critical in either theme, one `h1`, no skipped heading level, a skip link that moves the tab sequence into `<main>`, and a non-empty `alt` on every image                                                                                                                                                                                                                                                                                                                                                              |
| `tests/e2e/keyboard.e2e.ts`   | A declared inventory of every control the page owes a keyboard, each one present and rendered, then the whole tab sequence walked forwards and back against that inventory, with the design system's focus ring painted on every stop and both sideways-scrolling registers reachable                                                                                                                                                                                                                                                                        |
| `tests/e2e/motion.e2e.ts`     | Both sides of `prefers-reduced-motion`: every element and both of its generated boxes swept for a declared or running animation under `reduce`, on every page the router renders, and an instant jump to the run block, against a page that genuinely rises, reveals, and glides under `no-preference`                                                                                                                                                                                                                                                       |
| `tests/e2e/no-script.e2e.ts`  | The page with scripting off: the copy, the sections, and the theme arrive in the first response, the in-page actions are followed by the browser alone, and nothing stays hidden waiting for an observer                                                                                                                                                                                                                                                                                                                                                     |
| `tests/e2e/theme.e2e.ts`      | Every colour the page paints, swept from the document rather than from a list of surfaces, on every page the router renders: background colours and background images both, each repainting on the toggle unless a shared token is what feeds it, and each coming back on the way home                                                                                                                                                                                                                                                                       |
| `tests/e2e/contracts.e2e.ts`  | The seams between the documents this page publishes: the headers `next.config.ts` promises reaching every surface including the image optimiser and an unpublished address, a policy naming no origin but this one and no request breaking it, the sitemap advertising only addresses that answer and claim that canonical, the robots file pointing at a sitemap that is really served, a 404 that is a 404, the post copy quoted exactly as the export wrote it, and the design system commit the footer publishes matching the one the lockfile installed |
| `tests/e2e/not-found.e2e.ts`  | The route that answers when something is wrong: a real 404 rather than an apology served as a page, already in its theme, publishing everything about itself the landing page does, one way out that reaches a page that answers, three controls a keyboard reaches in order with a focus ring on each, a file the site does not have refused rather than served as HTML, and a fragment naming nothing - stale, mangled, or shaped like markup - leaving the page working                                                                                   |
| `tests/e2e/headers.e2e.ts`    | The permissions, pinned rather than derived: every directive of the policy written out and compared with the served one on every page, the guards beside it and the absent `X-Powered-By`, a `noindex` in the markup of every page, the refusal to be framed asked of the browser rather than of the header, the image optimiser refusing a foreign origin, and no request leaving this origin                                                                                                                                                               |
| `tests/e2e/overflow.e2e.ts`   | Every region on every page that clips content wider than itself, at a phone width: user-scrollable rather than merely hidden, able to travel the whole distance it is hiding, and reachable by a keyboard                                                                                                                                                                                                                                                                                                                                                    |

Every expectation is read from `content/` and `public/assets/manifest.json`, so
renaming a section or replacing an asset fails the suite rather than leaving it
asserting a string nobody updated.

Most specs ask for `prefers-reduced-motion: reduce` before measuring anything.
The page reveals its sections on a timer and on a scroll timeline, and a colour
sampled halfway through that fade is one no reader ever sees; axe reported a
different contrast ratio on every run until this was settled. `motion.e2e.ts` is
the exception, and has to be: it is the only spec that asks for motion, because
the reduced rendering means nothing unless the page it is compared against is
really moving.

Three defects used to pass this suite, each confirmed by planting it and
watching every test stay green, and each of them the same mistake: a gate whose
expectation was read from the thing it was checking. `keyboard.e2e.ts` built the
expected tab order from the document, so hiding the skip link removed it from
the walk and from the expectation together. `motion.e2e.ts` sampled `.lp-rise`
and `.lp-reveal`, so an animation on `.lp-status` outside the
`prefers-reduced-motion: no-preference` block was invisible to it.
`theme.e2e.ts` compared five named surfaces, so every specification panel could
have stayed dark in the light theme. All three now take their expectation from
somewhere the page cannot edit: a written inventory drawn from `content/`, a
sweep of every element on the page, and a sweep of every colour it paints. Each
was re-planted afterwards and each is now caught.

Six more were planted later, and each of those was a gate looking at the wrong
thing rather than at the wrong place. `overflow-x: auto` on the specification
table became `hidden`, the usual answer to an unwanted scrollbar, and cut a
hundred pixels of the table off at 390 while every gate stayed green:
`keyboard.e2e.ts` asked which regions _declare_ that they scroll, and nothing
asked whether content that does not fit can still be reached, which
`overflow.e2e.ts` now does by trying to scroll every region that clips. The
panel's background became a gradient of two literals, which `theme.e2e.ts`
could not see because a gradient is a background _image_ and the sweep read
background _colour_; its border was hardcoded to the literal one shared token
happens to hold, and the sweep excused it for that resemblance. The sweep now
reads both halves of a background, and asks which surfaces a token actually
feeds by overriding the tokens and watching what moves, so a colour is excused
for where it comes from rather than for what it looks like.
`frame-ancestors 'none'` was deleted from the policy and the header check, which
reads `next.config.ts`, lost the expectation with the promise; `headers.e2e.ts`
now writes every directive out and asks the browser to try framing the page. An
animation was added to `.lp-notfound__code` outside the reduced-motion guard,
on a class only the 404 uses, and the motion sweep was opening `/` and nothing
else; `pages.ts` now walks `app/` and both sweeps visit every page the router
renders. And the skip link's `transform` was swapped for a `clip-path`, leaving
the `:focus-visible` rule undoing a transform that no longer hid anything: the
box stayed exactly where it was, in the viewport, focused, and invisible.
`a11y.e2e.ts` now hit-tests the link and compares what is painted where it sits
before and after it takes focus, which no hiding technique survives.

What still passes, so a green run is not read as covering it: a section heading
demoted from `h2` to `h4` where the heading before it is an `h3`, which
`a11y.e2e.ts` and axe both consider legal enough not to block on. And the header
check in `contracts.e2e.ts` still reads its expectation from `next.config.ts`,
so deleting a promise there deletes the expectation with it; what anchors that
from the other side is `metadata.e2e.ts`, which pins `noindex, nofollow`
literally, `headers.e2e.ts`, which pins every directive of the policy and tries
to frame the page, and the policy check, which refuses any origin but this one
however the config is written.

One more, and it is the one this work made easiest to assume away: axe still
runs on the landing page and nowhere else. `pages.ts` walks `app/` and feeds
every page it finds to the theme sweep and the reduced-motion sweep, but
`a11y.e2e.ts` opens `/` and only `/`, so the not-found page is never analysed.
`not-found.e2e.ts` holds that page's markup, metadata, theme, way out and three
keyboard stops, and runs no axe at all.

### Smoke

```bash
pnpm build
pnpm smoke
```

Four questions about the artefact rather than about the source: a production
build exists, the server it produces answers 200 with the honest status label in
the body, the manifest and its three approved files are present and still the
bytes and SHA-256 the manifest records, and the content linter passes against
the rendered HTML. It starts its own `next start` on port 4310, so it can never
report on a server someone else left running.

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
