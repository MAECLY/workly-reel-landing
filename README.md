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
| `pnpm privacy:check`                | The export privacy gate, over `out/`. See below            |
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

| Suite                                | Covers                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/page.test.tsx`                | The five sections and the run block, the hero copy, both actions, the six stages, alt text drawn from the manifest, the caption and build label on every figure, the export at true proportion, every in-page anchor resolving, no empty href, no download or form or waitlist, the window rules, the not-shipped list, and the run commands |
| `tests/metadata.test.ts`             | Title and description leading with Developer Proof-of-Work, `robots: { index: false, follow: false }`, the real export as the Open Graph image at its true size, the canonical with its trailing slash, the one-entry sitemap, and `robots.txt`                                                                                              |
| `tests/content.test.ts`              | No banned word, no em dash, no unshipped platform, no implied publishing, the proof-of-concept label, the Day / Week / Custom Range copy, no fabricated metric, the derived window values, and the SHA-256 of every asset against the bytes on disk                                                                                          |
| `tests/theme.test.tsx`               | Dark by default, the same markup under light, the toggle's accessible name, and no hardcoded colour in `app/landing.css`                                                                                                                                                                                                                     |
| `tests/check-content.test.ts`        | The linter passes the page as it stands, and each rule still rejects its own violation and accepts the honest phrasing                                                                                                                                                                                                                       |
| `tests/check-export-privacy.test.ts` | Every rule of the export privacy gate, shown catching an invented leak in an invented export, and shown letting a clean one through                                                                                                                                                                                                          |
| `tests/not-found.test.tsx`           | The 404 route uses the same visual system, refuses indexing, and offers one way back to a route that exists                                                                                                                                                                                                                                  |
| `tests/landing-css.test.ts`          | Every declaration in `app/landing.css`, one at a time: no colour written out in any notation, and every colour-bearing property taking its value from a custom property                                                                                                                                                                      |

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

| Spec                             | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/e2e/page.e2e.ts`          | 200 from `next start`, the five sections and the run block by their real ids, every workflow stage anchored, the primary action scrolling the run instructions into view and moving focus with it, and every manifest image decoding at the size the manifest records                                                                                                                                                                                                                                                                                                                                                                                                        |
| `tests/e2e/metadata.e2e.ts`      | The canonical with its trailing slash, `noindex, nofollow` in the meta tag and in the `X-Robots-Tag` header, the Open Graph image resolving to the real export byte for byte, and `/sitemap.xml` and `/robots.txt` rooted at the agreed origin                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `tests/e2e/responsive.e2e.ts`    | At 390, 768, 1280, and 1680: no horizontal scroll, no element past the viewport, the headline in four lines or fewer, and every interactive target at least 24 by 24                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `tests/e2e/a11y.e2e.ts`          | axe-core reporting nothing serious or critical in either theme, on every page the router renders, plus one `h1`, no skipped heading level, a skip link that moves the tab sequence into `<main>`, and a non-empty `alt` on every image                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `tests/e2e/keyboard.e2e.ts`      | A declared inventory of every control the page owes a keyboard, each one present and rendered, then the whole tab sequence walked forwards and back against that inventory, with the design system's focus ring painted on every stop and both sideways-scrolling registers reachable                                                                                                                                                                                                                                                                                                                                                                                        |
| `tests/e2e/motion.e2e.ts`        | Both sides of `prefers-reduced-motion`: every element and both of its generated boxes swept for a declared or running animation under `reduce`, on every page the router renders and in every state the shipped stylesheets declare a rule for, and an instant jump to the run block, against a page that genuinely rises, reveals, and glides under `no-preference`                                                                                                                                                                                                                                                                                                         |
| `tests/e2e/no-script.e2e.ts`     | The page with scripting off: the copy, the sections, and the theme arrive in the first response, the in-page actions are followed by the browser alone, and nothing stays hidden waiting for an observer                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `tests/e2e/theme.e2e.ts`         | Every colour the page paints, swept from the document rather than from a list of surfaces, on every page the router renders, in every state a reader can reach and on the generated boxes as well as the elements: background colours and background images both, each repainting on the toggle unless a shared token is what feeds it, each coming back on the way home, and the whole page indifferent to the reader's system colour scheme because its own attribute has already decided                                                                                                                                                                                  |
| `tests/e2e/contracts.e2e.ts`     | The seams between the documents this page publishes: the headers `next.config.ts` promises reaching every surface including the image optimiser and an unpublished address, a policy naming no origin but this one and no request breaking it, the sitemap advertising only addresses that answer and claim that canonical, the robots file pointing at a sitemap that is really served, a 404 that is a 404, the post copy quoted exactly as the export wrote it, the design system commit the footer publishes matching the one the lockfile installed, and no pseudo-class or media condition declared in the shipped stylesheets that no sweep in this suite ever enters |
| `tests/e2e/not-found.e2e.ts`     | The route that answers when something is wrong: a real 404 rather than an apology served as a page, already in its theme, publishing everything about itself the landing page does, one way out that reaches a page that answers, three controls a keyboard reaches in order with a focus ring on each, a file the site does not have refused rather than served as HTML, and a fragment naming nothing - stale, mangled, or shaped like markup - leaving the page working                                                                                                                                                                                                   |
| `tests/e2e/headers.e2e.ts`       | The permissions, pinned rather than derived: every directive of the policy written out and compared with the served one on every page, the guards beside it and the absent `X-Powered-By`, a `noindex` in the markup of every page, the refusal to be framed asked of the browser rather than of the header, the image optimiser refusing a foreign origin, and no request leaving this origin - watched on the network and on the console, with every state entered, every registered lifecycle event fired, and the page then left                                                                                                                                         |
| `tests/e2e/overflow.e2e.ts`      | Every region on every page that clips content wider than itself, at a phone width: user-scrollable rather than merely hidden, able to travel the whole distance it is hiding, and reachable by a keyboard                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `tests/e2e/exported-site.e2e.ts` | The bytes that get uploaded rather than the page that gets rendered: the whole export privacy gate run over `out/`, a leak planted under every file extension the export actually contains so that no kind of file is walked past, and the address the preview card claims for this page. The last of those is red on purpose, see below                                                                                                                                                                                                                                                                                                                                     |

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

Four more were planted after that, and each was a sweep reading the right thing
in the wrong condition, or reading the file types its author had in mind. A
webfont pulled in with `@import` from a stylesheet, and a remote texture in a
`:hover` rule, were both invisible: the export privacy gate asked "does this
reach another origin" of `.html` and of nothing else, so the stylesheets - the
classic place a font CDN arrives - were never read for it, and no browser in
this suite had ever entered a state. That question is now asked of every file in
the export, whatever its extension, and `exported-site.e2e.ts` plants a leak
under each extension the export really contains so that no kind of file can be
walked past. A `navigator.sendBeacon` in a `pagehide` handler was invisible too,
because the network recording was read while the page was still open; it is now
read after every registered lifecycle event has been fired and the page has been
left, and it watches the console as well as the network, because a request the
policy refuses never becomes a request. A file named `notes.png` that was not a
PNG was published entirely unread, because the image branch was keyed on the
extension rather than on the signature.

What still passes, so a green run is not read as covering it: a section heading
demoted from `h2` to `h4` where the heading before it is an `h3`, which
`a11y.e2e.ts` and axe both consider legal enough not to block on. And the header
check in `contracts.e2e.ts` still reads its expectation from `next.config.ts`,
so deleting a promise there deletes the expectation with it; what anchors that
from the other side is `metadata.e2e.ts`, which pins `noindex, nofollow`
literally, `headers.e2e.ts`, which pins every directive of the policy and tries
to frame the page, and the policy check, which refuses any origin but this one
however the config is written.

Axe running on the landing page and nowhere else used to be listed here. It now
runs once per page `pages.ts` discovers, in both themes, and it settles the page
first: measured, three runs in six on the not-found page reported the footer pins
at a contrast of 2.06, painted a colour half way through the theme transition
that no reader ever sees.

What replaces it as the thing worth naming is a limit rather than an omission.
A script is read by the export privacy gate for stylesheet syntax only, because
the framework's own chunks quote a dozen documentation addresses inside the
errors they throw and a gate that called those leaks would be removed within a
week. What a script fetches when it runs is answered in a browser instead, by
`headers.e2e.ts`, in every state and across the page's own unloading - and that
answer, unlike a sweep of bytes, is only as complete as the states and events
the page has been put through.

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

The site is exported as static files, so what a reader receives is exactly what
is in `out/`. Serve it the way the host does and look:

```bash
pnpm build
pnpm start          # http://127.0.0.1:4311, using Pages' own resolution rules
```

### What the static host cannot send

`next.config.ts` used to set five response headers. GitHub Pages serves files
and offers no header configuration, so they are gone, and Next ignores a
`headers()` block under `output: 'export'` silently — which is why the block was
removed rather than left to read as protection that is not there.

| Promise                           | Now                                                         |
| --------------------------------- | ----------------------------------------------------------- |
| `noindex, nofollow`               | Unchanged. Always sent twice; the meta tag is what remains  |
| Content-Security-Policy           | `<meta http-equiv>`, hoisted to the front of every document |
| `Referrer-Policy`                 | `<meta name="referrer">`                                    |
| `frame-ancestors 'none'`          | **Lost.** Ignored in a meta tag by specification            |
| `X-Content-Type-Options: nosniff` | **Lost.** No meta equivalent exists                         |

The page can therefore be framed by anybody. `tests/e2e/headers.e2e.ts` carries a
test that says so, marked expected-to-fail, so restoring the header turns it
green and demands the annotation come off.

`maecly.com` already resolves through Cloudflare, so proxying the Pages origin
and adding a transform rule would restore both as real headers. That is a
setting, not a migration.

### Why the policy is hoisted

A policy delivered by meta tag governs only what the parser meets after it. Next
decides the order of its own `<head>` and puts preloads, stylesheets and its
bootstrap scripts first: on a real build the tag landed at position 15 with seven
`<script>` tags already ahead of it. `scripts/harden-export.ts` runs as part of
`pnpm build` and moves it to the front of every exported document; the
`policy-first` rule of the gate below fails if it ever stops working.

### What must never be in `out/`

```bash
pnpm privacy:check      # or let pnpm build run it, which it does
```

`out/` is uploaded wholesale, so a file nothing links to is published as
completely as the home page. `scripts/check-export-privacy.ts` reads every byte
of it after each build and refuses six things:

| Refused                        | Because                                                                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| A source map, or a link to one | See below                                                                                                                                |
| An identity                    | An absolute path, a home directory, an account or machine name, an address                                                               |
| A credential                   | Nothing here needs one, so the day one appears nobody will be looking                                                                    |
| Identifying image metadata     | A screenshot carries whatever the capture tool wrote into its EXIF and XMP                                                               |
| A file nobody meant to publish | See below                                                                                                                                |
| A reference to somewhere else  | Phase 0 fetches nothing it does not ship, and the moment it does, the reader's browser tells a third party who is reading and from where |

The last of those is the newest and was the widest hole in this gate. It used to
be asked of `.html` and of nothing else, which left the stylesheets — the
classic place a webfont or a background texture arrives from a CDN — entirely
unread, and a `url()` inside a `:hover` rule doubly so, because it is in the
file type the sweep skipped and in a state no browser in this suite ever
entered. It is now asked of every file the export contains, whatever its
extension, which is the only form of the question a file type nobody has thought
of yet cannot walk past. A script is the one exception and is read for
stylesheet fetch syntax alone: the framework's own chunks quote a dozen
documentation addresses inside the errors they throw, and a gate that called
those leaks would be removed within a week. What a script fetches when it runs
is answered in a browser instead, by `tests/e2e/headers.e2e.ts`.

The image branch is chosen by the file's eight-byte signature rather than by its
name, which is what a browser does too. Keyed on the extension, a file _named_
`notes.png` that was not a PNG was read for image metadata, found none because
there is none, and was published without any other rule ever seeing its bytes.

It then holds the documents the site publishes about itself to what Phase 0
intends: `Disallow: /` written under the group that binds every crawler and no
`Allow:` beside it, a sitemap that advertises only exported pages at this
origin, a `noindex` in every document, the security policy first in every
`<head>`, a complete preview card whose two images the export actually contains
and whose `og:url` is at this origin, the agreed canonical, and the custom
domain.

A finding names the kind, the file and the position, and never the value. This
gate's output reaches a public CI log, and a message that quoted the leak would
publish it a second time in the course of reporting it.

**It is asked four times, and that is deliberate rather than untidy.** A gate
about disclosure is the one that most needs to run on the build nobody is
watching, so it is wired in the places where each of the others could be edited
away:

| Where                                              | Why there                                                                                                                                                                                 |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inside `pnpm build`                                | So `out/` cannot exist anywhere — here, on a laptop, or on the deploy — without having passed. This is the only one of the four that cannot be removed without changing what a build _is_ |
| `Export privacy` in `.github/workflows/verify.yml` | So a reader of a run sees it as a step, and so the question is still asked the day somebody edits the `build` script                                                                      |
| `Export privacy` in `.github/workflows/pages.yml`  | The publish path. Everything after that step hands `out/` to Pages, and it carries no `if:`                                                                                               |
| `tests/e2e/exported-site.e2e.ts`                   | So the answer lands in a test report the workflow keeps as an artefact, rather than in a build log that scrolls past                                                                      |

The one place it does not run is a pull request from a fork, along with every
other gate in the verify workflow: GitHub withholds the design-system key from
forks by design, without it nothing installs, and without an install there is no
`out/` to read. The workflow says so by name rather than leaving it to be
inferred, and a maintainer has to run the chain before merging.

**Source maps are never published from this repository, and turning
`productionBrowserSourceMaps` on would be a mistake rather than a convenience.**
Turbopack fills in `sourcesContent`, so a map is not a pointer to source, it is
the source. Measured by turning the setting on and reading what came out: the
build wrote 12 maps totalling 4.5 MB, and between them they carried the complete
text of 29 modules of `@maecly/workly-reel-ui`, which is a private package.
Publishing browser maps would republish a private design system to the open web
in order to make a proof of concept easier to debug in a stranger's browser. The
source of this repository is already readable at the commit the page was built
from; the map adds nothing a reader is owed and one thing they are not.

The same measurement withdrew half of what this section used to claim. It said
the maps carried the absolute paths of whoever ran the build. They do not:
Turbopack rewrites every source to `turbopack:///ROOT/...`, and there was not
one home directory anywhere in the 4.5 MB. The maps are refused for the private
source they contain, not for a path they turned out never to hold.

**Nothing may be published that nobody put there on purpose.** Next copies
`public/` into `out/` without reading it, and `actions/upload-pages-artifact`
uploads `out/` whole, so a file that a file manager or an editor left beside the
screenshots is served at its own address to anyone who guesses the name. Both
halves were measured: a `.DS_Store` and a stray `.env` dropped into `public/`
arrived in `out/` on a real build, and every other rule in the gate passed them,
because a Finder index is binary noise with no path in it and an environment
file only trips a credential shape if the value it holds happens to be one. The
rule is therefore the name rather than the contents, and the honest answer to
finding one of these in the export is to fail the build rather than to read it
and decide.

### What the build itself sends

The gate above answers "what does the published site send". It is not the answer
to "what does building the published site send", and until now nothing was.

Next.js collects telemetry by default and posts it during `next build`. On a
product whose stated posture is that nothing leaves the machine, that meant
every build — on a contributor's laptop, in Verify, and on the deploy — reported
itself to a third party, and no rule in `scripts/check-export-privacy.ts`, no
assertion in the browser suite and no reading of `out/` could ever have noticed,
because the request is made by the build tool rather than by the site.

`pnpm dev` and `pnpm build` now set `NEXT_TELEMETRY_DISABLED=1`, and
`tests/check-export-privacy.test.ts` holds them to it. The claim is written
against `package.json` rather than against the current environment on purpose:
`next telemetry disable` writes to a per-user config outside this repository, so
it fixes one machine and no others, while the scripts are what every machine
runs. The rule enumerates — any script whose command invokes `next` has to carry
the variable — so a script added later is covered by being written.

### One published contract is wrong, and its gate is red rather than rewritten

**This page claims two different addresses as its own.** `app/layout.tsx` sets
`openGraph.url` to `site.canonical`, and `tests/metadata.test.ts` agrees that it
does; both are true of the metadata object. What is served is not. Next
normalises a metadata URL by dropping the trailing slash, so every exported
document advertises `https://workly-reel.maecly.com` to a link preview while the
canonical link a few tags later claims `https://workly-reel.maecly.com/`. The
layout already works around this same normalisation once, which is the only
reason the canonical link is hand-written in the body, so the site has decided
which of the two is its address and then publishes the other one as the
permanent identity every reshare of the card carries.

The assertion in `tests/e2e/exported-site.e2e.ts` is written for the address the
site says is its own and marked `test.fail()`, so it turns green the day
`og:url` carries the slash rather than the day somebody reads this paragraph.
Writing it the other way round would have recorded the drift as the agreement.
`scripts/check-export-privacy.ts` holds the weaker claim that survives being a
build gate: `og:url` must at least be at this origin.

## What the gates cover, and what they do not

Six phases of work have produced a lot of green ticks. This section exists so a
reader can tell what those ticks are worth, in terms of the kind of defect that
would reach a visitor to this site unnoticed. It is written for somebody
deciding whether a change is safe, not for somebody counting test files.

### The questions this site's gates actually answer

**Is the published byte the tested byte?** Every end-to-end spec runs against a
freshly built `out/`, served by `scripts/serve-export.ts`, rather than against a
dev server. That distinction was measured rather than assumed: a deliberately
broken `alt` attribute passed 10 of 10 accessibility tests against a stale
server while the source on disk was already wrong.

**Does the export say anything about the machine or the person that built it?**
`scripts/check-export-privacy.ts` reads every byte of `out/`, and it is asked
four times — inside `pnpm build`, as a step in Verify, as a step in the deploy,
and from a test — precisely so no single edit can remove it.

**Does the site publish what it claims about itself?** The canonical, the
preview card, `robots.txt`, the sitemap, the `noindex`, the position of the
security policy and the custom domain are all held against the exported files
and against a running server.

**Does it work for a reader who is not the author?** axe on every page in both
themes, the whole tab sequence walked forwards and back with a painted focus
ring on every stop, no motion under `prefers-reduced-motion`, no sideways
overflow at four widths, and every clipping region reachable by keyboard.

**Does anything leave this origin?** `headers.e2e.ts` watches the network and
the console while every declared state is entered, every registered lifecycle
event is fired, and the page is then left. The console half matters as much as
the network half: a request the security policy refuses never becomes a request,
so it is only ever visible as a console error.

### What would reach a visitor unnoticed

Every item below was produced by changing this repository, running the whole
chain, and watching it stay green. None is hypothetical.

**A state that is a viewport rather than a pseudo-class.** The state driver
forces every pseudo-class the shipped stylesheets declare, but the sweeps run at
the viewports the config lists. An animation, or a contrast-failing colour,
written inside `@media (min-width: 1440px)` is entered by nothing: the motion
sweep does not reach that width and axe runs once per page per theme at one
size.

**A generated box that is not `::before` or `::after`.** The paint sweep walks
the element and those two, so a hardcoded `::selection { background: … }` is a
surface a reader sees on every drag-select and no gate looks at.

**An at-rule nobody listed.** `@media print` is excluded from the contract that
refuses an unentered condition, so a print stylesheet can hide a section or
paint it off-token and stay green.

**A listener rather than a rule.** The driver forces CSS states; it does not
dispatch pointer events into the document. A `pointerenter` handler that warms a
remote texture — `new Image().src = 'https://…'` — is reached by neither the
state driver nor the network sweep.

**A page other than the one a claim was written for.** Several claims still open
`/` alone. The same `pagehide` beacon moved into a client component that only
`app/not-found.tsx` renders is outside them.

**A file type moved across the script exemption.** `isScript` is a regular
expression over extensions, and widening it is a one-character change the
surrounding comment invites. Adding `txt` to it moves `out/index.txt` and the
flight-data files from "read whole" to "read for fetch syntax only", which is a
real narrowing of the gate that looks like tidying.

The shape those share is worth naming, because it is the shape the next one will
have too: **a sweep that names its inputs is one step behind the next accident.**
Every gate here that survives contact enumerates — pages from `app/`, states
from the shipped stylesheets, files from the export itself — and every one that
has been walked past was holding a list.

### The two gates that are red on purpose

Both state what this site should do rather than what it does, so each turns
green the day its cause is fixed and demands its annotation come off. Neither is
a flake, and neither may be relaxed to match the code.

| Gate                                                                           | What it is waiting for                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `headers.e2e.ts`, "refuses to be put inside a page belonging to somebody else" | A response header. `frame-ancestors` is ignored in a `<meta http-equiv>` policy by specification, and GitHub Pages sends no configurable headers, so the page can be framed by anybody today. `maecly.com` already resolves through Cloudflare, so proxying the Pages origin and adding a transform rule would restore this and `nosniff` both |
| `exported-site.e2e.ts`, on the preview card's address                          | One character. Next normalises a metadata URL by dropping the trailing slash, so every document advertises `https://workly-reel.maecly.com` to a link preview while the canonical a few tags later claims `https://workly-reel.maecly.com/`. The site has decided which is its address and then publishes the other as its permanent identity  |

While one of these is red it gates nothing of its own: the next defect of the
same shape would land in a test that already fails and the run would look
unchanged. `headers.e2e.ts` pins every other directive of the policy beside the
red one, and `scripts/check-export-privacy.ts` holds the weaker `og:url` claim
that survives being a build gate — the address must at least be at this origin.

### Where a gate can be absent without going red

One path only. On a pull request from a fork, GitHub withholds the design-system
deploy key by design, nothing installs, and every step of the Verify job skips —
so that job reports success having verified nothing. It says so in the run log
and a maintainer has to run the chain before merging. The protection that does
not depend on that branch is the copy of the privacy gate inside `pnpm build`,
which means no `out/` can exist anywhere without having passed it. A fork's run
is short the gate, not the protection.

The deploy workflow has no such branch: `pages.yml` runs only from `main`, where
the key must exist, and none of its steps carries an `if:`.

### What a seventh phase would do here

In the order the value falls out of it.

1. **Make the viewport a state.** Run the motion, theme and accessibility sweeps
   at every breakpoint the shipped stylesheets declare a `@media (min-width: …)`
   for, discovered the way the pseudo-classes already are. That single change
   closes two of the misses above, and it is the only one of them that can hide
   a contrast failure from axe.
2. **Sweep every generated box, not two.** `::selection`, `::marker`,
   `::placeholder` and `::backdrop` all paint, and none is looked at.
3. **Drive events as well as states.** Dispatch a real `pointerenter`,
   `pointerdown` and `keydown` on every element that has a listener, so a fetch
   warmed from script is caught the way a fetch declared in CSS now is.
4. **Give every page-level claim the page inventory.** `pages.ts` exists and
   several specs still open `/`; the network and lifecycle claims in
   `headers.e2e.ts` are the ones that matter most.
5. **Replace the script exemption with a measurement.** Reading a chunk for
   fetch syntax alone is a genuine trade, but it is currently expressed as an
   extension list that a one-character edit can widen. An allowlist of the
   specific documentation origins the framework quotes would let every script be
   read whole and would fail on the day a new address appears.
6. **Restore the two lost headers.** That is a Cloudflare transform rule rather
   than a code change, and it retires one of the two red gates.

## Deployment

Published by GitHub Pages at **https://workly-reel.maecly.com**, from `main`,
by `.github/workflows/pages.yml`.

The repository is public because Pages on a private repository requires a paid
plan and the `MAECLY` organisation is on the free one. Only this repository is
public; the design system and the desktop application remain private.

### What is already configured

| Thing         | Value                                                   |
| ------------- | ------------------------------------------------------- |
| DNS           | `CNAME workly-reel -> maecly.github.io`, proxy disabled |
| Custom domain | The repository's Pages setting. See the note below      |
| Build         | `pnpm build`, then `pnpm smoke` against `out/`          |
| Source        | GitHub Actions, not a branch                            |

The custom domain is a **repository setting**, not the `public/CNAME` file. A
branch-published site reads that file; an Actions-published one ignores it.
Measured on a real deploy: the artefact carried the file and the configured
domain stayed empty until it was set through the API. `public/CNAME` is kept
only so a switch back to branch publishing would not silently lose the domain,
and the deploy workflow asserts the _setting_ rather than the file.

If the domain is ever cleared, the site moves to the `maecly.github.io` address,
where every root-absolute asset path 404s. The page still renders, unstyled -
a failure that looks like a design regression rather than a configuration one.

The Cloudflare record is deliberately **DNS only**. GitHub has to reach the host
directly to issue its certificate; behind the orange cloud it cannot, and the
site is unreachable over HTTPS. Once `Enforce HTTPS` is available in the Pages
settings the record can be proxied if the headers above are wanted back.

One repository secret is required:

| Secret                      | What it is                                                            |
| --------------------------- | --------------------------------------------------------------------- |
| `WORKLY_REEL_UI_DEPLOY_KEY` | The private half of a read-only deploy key on `MAECLY/workly-reel-ui` |

The page reads nothing at runtime. That secret exists only so the build can
fetch the private design system. Unlike the verify workflow, the deploy has no
useful degraded mode — a site built without the design system publishes
unstyled — so it fails loudly rather than skipping.

Generate the pair once:

```bash
ssh-keygen -t ed25519 -C "pages@workly-reel-landing" -f ./deploy-key -N ""
```

Add `deploy-key.pub` to `MAECLY/workly-reel-ui` under Settings, Deploy keys,
**without** write access. Paste the contents of `deploy-key` into the repository
secret. Then delete both local files.

### Verifying a deploy

```bash
dig +short workly-reel.maecly.com
curl -s  https://workly-reel.maecly.com/ | grep -o '<link rel="canonical"[^>]*>'
curl -s  https://workly-reel.maecly.com/ | grep -o 'http-equiv="Content-Security-Policy"'
curl -s  https://workly-reel.maecly.com/robots.txt
curl -so /dev/null -w '%{http_code}\n' https://workly-reel.maecly.com/nothing-here
```

The canonical must read `https://workly-reel.maecly.com/`, with the trailing
slash, and appear exactly once. `robots.txt` must disallow everything. The last
command must answer `404`: GitHub Pages serves `out/404.html` for an address
that was never published, and an answer of `200` means the export is missing
that file and the host is showing its own error page instead of this one.

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
