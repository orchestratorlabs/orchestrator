# OrchestratoR™ — Backlog

Running list of fixes, ideas, and decisions not yet acted on. Newest thinking at
the top of each section. Companion to the deployment runbook, which is kept local rather than published
(`docs/design/vercel-demo-deploy-runbook.md`, gitignored — it contains hosting and
DNS steps).

Last updated: 2026-08-11

---

## 1. Blocking the demo launch — COMPLETE 2026-08-04

The demo is live at <https://demo.orchestratorlabs.ai>, on HTTPS with a Let's
Encrypt certificate, linked from the README, and its link preview is verified and
cached. Nothing in this section is outstanding.

| # | Item | Owner | Status |
| --- | --- | --- | --- |
| 1.1 | A11Y DoubleCheck / Ask OrchestratoR show an intentional "needs local service" message instead of a failure when hosted | Claude | **Done** — `9be7cd2` |
| 1.2 | `index.html` metadata — title, description, Open Graph, favicons | Claude | **Done** — `71d30be` |
| 1.3 | Embed workspace screenshots in the README | Claude | **Done** — `dabdbf2` |
| 1.4 | ~~Deploy to Vercel~~ | Craig | **Done 2026-08-04** — `orchestrator-chi-inky.vercel.app` |
| 1.5 | ~~Add `demo.orchestratorlabs.ai` CNAME in Squarespace~~ | Craig | **Done 2026-08-04** — live on HTTPS, Let's Encrypt cert issued |
| 1.6 | ~~Add the live demo link to the top of the README~~ | Claude | **Done 2026-08-04** |
| 1.7 | ~~Run LinkedIn Post Inspector on the live demo URL to prime the cache~~ | Craig | **Done 2026-08-04** — card, title and canonical URL all correct |

**On 1.4 — no server is needed, and no domain either.** This was mistaken for a
hosting purchase. It is not:

- **Vercel is the server.** It clones the repo, runs `npm run build`, and serves
  `dist/` on its CDN. Free on the Hobby tier. Nothing to provision or maintain.
- **A working URL arrives immediately.** Deploying gives a live HTTPS address such
  as `orchestrator-demo.vercel.app` with **no DNS involved**. That is entirely
  adequate for an interview link, so 1.4 is not blocked on 1.5.
- **The custom subdomain is polish, done second.** It reads better on the case
  study, and the `og:image` tags in `index.html` point at
  `demo.orchestratorlabs.ai`, so link previews need it eventually — but it is one
  CNAME record on a domain already owned, not a server.

Order: deploy first, share the `*.vercel.app` URL if useful, then add the CNAME.
See §4 of the local deployment runbook for the project setup. The one common blocker is granting Vercel access to the
**`orchestratorlabs` organisation**, or the repo will not appear in the import
list.

**On 1.7 — why it matters.** LinkedIn, Slack and iMessage cache link previews per
URL for roughly a week. Sharing the demo before its Open Graph tags resolve means
a broken preview gets cached and kept. `linkedin.com/post-inspector` forces a
re-scrape and needs no post to be published.

---

## 2. Product positioning and commercial model

**The funnel.** Landing page → free demo (deterministic rules) → paid tier (AI
double-check, more component types). The hosted demo's limitation stops being an
apology and becomes the free-tier boundary. This is the same shape most developer
tools use.

Consequences of that decision:

- **Keep the All Rights Reserved licence.** Do **not** add a personal-use or
  self-hosting permission. Self-hosting would compete with the paid tier, so
  withholding that right is deliberate, not an oversight.
- **Reframe the README's self-host instructions** if a paid tier launches. They
  currently read as "run it yourself," which will no longer be the intent.
- **Hosting the Flask service becomes a cost centre**, not a local convenience.
- **Claude API spend is per-user**, so pricing has to cover inference.
- **Add a line to the case study's Next Steps** — "free demo, paid AI tier."
  Shows commercial thinking rather than a prototype for its own sake.

### Landing page ideas (`orchestratorlabs.ai`, built in Squarespace)

Ranked by impact:

1. **A looping demo video or GIF above the fold** — muted, autoplaying. Most
   visitors will not click through to a live app; nearly all will watch a few
   seconds of motion. Highest-leverage asset available, and it still works if the
   live demo has problems.
2. **Reuse the existing architecture diagrams** —
   `docs/visual-reference/orchestrator-architecture-diagram.svg` and
   `docs/digital-twin-ai-agent.html` are already in the repo and unused publicly.
   Supports the "designs systems, not screens" positioning.
3. **Lead with the 85 vs 100 result, not a feature list.** Same component scoring
   differently across themes, with the offending token named. Demonstrates
   insight rather than software.
4. **A short "How it works" section** — deterministic rules produce the score; AI
   explains, recommends, and validates. Differentiated, since most AI demos let
   the model decide everything.
5. **A roadmap / "What's next" section** — signals product increments.
6. **An email capture** — e.g. "Get notified when card and input components
   ship." Signals a product with a trajectory.

### Product video — YouTube, landing page, LinkedIn *(start 2026-09-01)*

Record a short product video and publish it to the YouTube channel:
<https://www.youtube.com/@CraigMaherAIUX>

**Two assets, not one** — they have different jobs:

| Asset | Length | Sound | Used for |
| --- | --- | --- | --- |
| **Short clip / GIF** | 10–15s | Silent, looping | Landing page above the fold, LinkedIn native upload, case study |
| **Walkthrough** | 60–90s | Narrated | YouTube, linked from the case study and the repo README |

**Storyboard — lead with the insight, not a feature tour:**

1. Show the two code panes — real React and CSS, not a mockup
2. Run the evaluation → **85/100**, 8 pass, 1 fail
3. Click the failing finding → jumps to the exact CSS line, marking
   `color: var(--Text-Disabled)`
4. Switch to dark mode, re-run → **100/100**
5. Land the point: *same component, same code, one theme passes and one does
   not — and it names the exact token at fault*
6. Cycle the five preview states
7. A11Y DoubleCheck last, for the walkthrough version only (needs `app.py`
   running, so it cannot be filmed against the hosted demo)

Steps 4–5 are the hook. Everything else is supporting detail.

**Publishing notes:**

- **Upload to LinkedIn natively.** LinkedIn deprioritises posts containing
  outbound links, including YouTube ones. Native video plus the demo URL in the
  post text or first comment reaches further than a YouTube link.
- **Squarespace can embed the YouTube version** on the landing page, but an
  autoplaying silent loop of the short clip works better above the fold.
- Film it locally with `app.py` running so the Claude summary populates —
  the hosted demo cannot show the agentic double-check.
- **Then share it with Greg Nudelman.** Worth having the demo URL and the case
  study finished first, so the video is an entry point rather than the whole
  artefact.

### Medium article *(start 2026-09-01)*

Write and publish a Medium piece, cross-linked to the demo, the case study and
the YouTube walkthrough.

**Candidate angles, strongest first:**

1. **"My own AI layer told me my accessibility rule was wrong."** The
   deterministic rule flags the disabled-state contrast as a failure; the Claude
   summary replies that WCAG 1.4.3 *exempts* disabled controls, reframes it as a
   design-system recommendation, and names a replacement token. Specific, honest,
   and unlike most AI-UX writing it contains a correction rather than a victory
   lap. **Depends on resolving §3.2 first** — the article needs a decided
   position, not an open question.
2. **"Same component, two themes, two scores."** The 85 vs 100 story. Concrete and
   visual, carried by the two screenshots already in the README.
3. **"Deterministic scoring, AI explanation — why the model should not own the
   score."** The architectural argument. Differentiated, since most AI demos let
   the model decide everything.
4. **"Designing with AI, not just for it."** Broadest, and the closest to the
   existing portfolio bio — but the least specific, so the easiest to write and
   the easiest to ignore.

**Assets already available to reuse:**

- `docs/visual-reference/screenshots/workspace-light.png` and `workspace-dark.png`
- The product video, once filmed
- The live demo URL, once deployed
- The case study, for a "full write-up" link

**Sequencing:** demo deployed → video filmed → article written last, so it can
link to both and end with a working call to action rather than a promise.

### Where to put the demo URL — now that it is live

`demo.orchestratorlabs.ai` — short enough to read aloud, type from a printed page,
and drop into a sentence. That is the payoff for using a real subdomain rather
than a `*.vercel.app` address.

| # | Place | Notes |
| --- | --- | --- |
| 2.7 | **Case study page** — "Try the live demo" as the **primary** link near the top | Highest impact. Was blocked on the URL existing |
| 2.8 | **Cover letters** | Bare domain, no `https://` — reads cleanly in prose and in print |
| 2.9 | **Résumé / CV** | One line under the OrchestratoR entry |
| 2.10 | **LinkedIn Featured section** | Renders with the OG card; preview cache already primed |
| 2.11 | **Job application forms** | The "portfolio" or "website" field |
| 2.12 | **Interview follow-up emails** | Alongside the repo link for anyone technical |

**Ordering on any page that has both:** demo first, repo second. The demo shows the
product; the repo is where a technical reader verifies you built it. See the link
conventions below.

**One practical note for print and plain text:** write it as
`demo.orchestratorlabs.ai`, not the full `https://` form. It stays clickable in
most clients and reads better in a sentence.

### Link conventions (settled)

- Bio and case study link to the **story**, never the repo.
- GitHub is a secondary "View source" link inside the case study's Technical
  Approach section.
- Once the demo is live: **Try the live demo** primary, **View source**
  secondary.

### Social preview assets — scheduled for week of 2026-08-03

The source card is `public/og-image.png` (1200×630, brand card with logo,
tagline, and a `#0540AB → #8DB6FF` gradient bar). It is already wired into
`index.html` for the demo's own link previews. These items reuse it elsewhere.

| # | Task | Where |
| --- | --- | --- |
| 2.1 | ~~Upload as the **GitHub repo social preview**~~ | **Done 2026-08-04** — `public/github-social-preview.png` (1280×640) uploaded, About text updated, wording aligned on "agentic double-check", verified via LinkedIn Post Inspector |
| 2.2 | Set the **case study page** social image | Squarespace → Page Settings → Social Image |
| 2.3 | Set the **orchestratorlabs.ai** social image | Squarespace → Page Settings → Social Image |
| 2.4 | Use as the **LinkedIn post** image when announcing | LinkedIn |
| 2.5 | Add the demo to the **LinkedIn Featured** section | LinkedIn profile |
| 2.6 | Use as the **deck title slide** | OrchestratoR™ deck |

**2.1 verification gotcha.** `opengraph.githubassets.com/<n>/<owner>/<repo>`
always renders GitHub's **auto-generated** card and is unaffected by an upload —
it is not a way to check the result. Confirm instead that the `og:image` meta tag
on the repo page points at `repository-images.githubusercontent.com`, or use
`linkedin.com/post-inspector`, which also primes LinkedIn's cache.

GitHub's documented spec is 1280×640 (2:1), which is why
`public/github-social-preview.png` exists separately from `public/og-image.png`
(1200×630, matching the dimensions declared in the `index.html` Open Graph tags).

**Settled 2026-08-04 — the About text.** GitHub composes the social title as
`GitHub - orchestratorlabs/orchestrator: ` plus the About field, and LinkedIn
truncates at roughly 100 characters — so the 40-character prefix leaves only ~60
characters of the description visible, and the trailing `© 2026` is never seen in
a feed. Leading the About with `OrchestratoR™` is therefore redundant. Now in
use, with that prefix dropped:

> Accessibility co-pilot POC — WCAG evaluation for buttons, with live light/dark
> preview and agentic double-check. Portfolio demo. © 2026 orchestratorlabs.

The card graphics and all three `index.html` description tags carry the matching
sub-line, so the card, the description and the product's own button label all say
"agentic double-check".

Also note: "agentic" describes a single RAG-plus-Claude validation call rather
than a multi-step agent loop. `AI-assisted validation` is the precise phrasing;
"agentic" is the aspirational one, and may invite a technical question.

**Design call on 2.2.** For the *case study*, the workspace screenshot is
probably the better social image than the brand card: a logo card says "this is
a brand," while `docs/visual-reference/screenshots/workspace-light.png` showing
85/100 with live findings says "this is a working product." Suggested split —
screenshot for the case study, brand card for the org and landing page.

**Size variants to generate** (all derivable from the existing source; ask
Claude):

- **1280×640** — GitHub's documented spec for social previews. The current
  1200×630 works but GitHub will crop slightly.
- **1200×1200** — square, occupies more vertical space in the LinkedIn feed
  than a 1.91:1 image.
- **A screenshot-based 1200×630** — for 2.2, per the design call above.

---

## 3. Engineering quality

### 3.1 No test suite — the gap that keeps this a POC

Zero `.test.*` / `.spec.*` files. Every verification so far has been a manual
smoke test. Highest-value engineering work available, and the honest answer to
"how do you know it works."

Interim recipe (see also the project memory):

```ts
// _smoke.ts at project root, run with: npx --yes tsx ./_smoke.ts
import { evaluateButtonAccessibility } from "./src/features/orchestrator/evaluator/buttonEvaluator";
import { SAMPLE_BUTTON_TSX, SAMPLE_BUTTON_CSS, SAMPLE_BUTTON_CSS_DARK } from "./src/features/workspace/WorkspacePane";
```

Known-good baseline: **light `healthScore=85`** (8 pass, 1 fail) /
**dark `healthScore=100`** (9 pass, 0 fail), with **zero Unknown findings**.
Any `Unknown` in the output means an incomplete edit somewhere.

### 3.2 Light mode caps at 85

`--Text-Disabled: #8C8C8C` on `--Bg-Disabled: #BDBDBD` is roughly **1.9:1**,
below the 4.5:1 threshold, so `rule-5-text-contrast` correctly fails. The dark
theme's `#595959` on `#D5D5D5` passes. Fixing that one token pair would give
100/100 in both themes — decide whether a clean sweep or a demonstrated real
failure is the better demo.

**Open decision: is `rule-5-text-contrast` too strict?** WCAG 1.4.3 exempts
disabled controls from the contrast minimum, so the light-mode failure may not be
a WCAG violation at all. The project's own AI layer says as much — the Claude
summary captured in `workspace-light.png` reads: *"Not a WCAG failure — disabled
controls are exempt. OrchestratoR flags this as a design-system readability
recommendation. Recommended token: #494949."*

Two coherent resolutions, and the current state is neither:

1. **Exempt disabled states** in the rule, and light mode scores 100.
2. **Keep it**, and label it explicitly as a stricter-than-WCAG house rule in the
   README, the case study, and ideally the finding's own text.

Worth resolving because it changes the answer to "why isn't it 100?" — and
because "our AI layer caught our own rule being conservative" is a strong
interview anecdote, but only if the position is deliberate.

### 3.3 Evaluator scope

- Handles **buttons only**.
- Locates CSS by matching a known selector (`.btn`, falling back to `button`), so
  arbitrary pasted CSS may not be fully analysed. Generalising selector detection
  is the prerequisite for supporting other component types.
- All selector strings are centralised in
  `src/features/orchestrator/evaluator/targetSelector.ts` — change the class name
  there and only there.

### 3.4 Smaller cleanups

- `evaluationStateMessage` is threaded from `App.tsx` through `WorkspacePane` to
  `OrchestratorPanel` but is **never rendered** — it only feeds a request body.
  The name suggests it was once meant for display.
- Optional: copyright headers in `app.py`, `src/App.tsx`, `buttonEvaluator.ts`.
  These travel with the file if copied, unlike repo metadata.

### 3.5 Interface Appearance toggle — approved, not yet built

Let engineers theme the **application chrome** independently of the component
preview canvas. Default to their OS setting; let them switch. Discussed and
agreed 2026-08-03; deferred, not dropped.

**Working prototype:**
[`design/appearance-toggle-prototype.html`](design/appearance-toggle-prototype.html)
— self-contained, open it directly in a browser. Demonstrates the control, the
theme switching, keyboard behaviour, and a canvas that stays put.

**Settled decisions:**

- **Scope A**, not a full theming pass. Theme only the seven existing `:root`
  tokens — chrome surfaces, borders, text. Leave the code editors and status
  pills dark. Light chrome with dark code panes is what VS Code and GitHub ship,
  so it reads as deliberate rather than half-finished. Roughly an hour, against
  half a day for the full audit of all 101 hardcoded hexes.
- **Call it "Appearance"**, never "Light mode / Dark mode". Those words belong to
  the preview toggle.
- **Put it in the top bar beside `Admin`**, not near the canvas.
- **Three options: Light / Dark / System**, with System the default via
  `prefers-color-scheme`.
- **Segmented pill, built on native radios** that are visually hidden with
  styled labels. Gets arrow-key navigation and single-selection semantics free.
  **The focus ring must be drawn on the label** (`input:focus-visible + label`),
  since the input itself is invisible.

**Why the canvas is already safe:** the preview renders in a **shadow root**, so
application CSS physically cannot reach it. The isolation is architectural, not
something to build.

**The main risk is UX, not code.** Two Light/Dark controls on screen meaning
different things. The preview toggle is *load-bearing* — it changes which CSS
gets evaluated (`App.tsx` swaps `SAMPLE_BUTTON_CSS` for `SAMPLE_BUTTON_CSS_DARK`)
— whereas Appearance is a cosmetic preference. Distinct labels and placement are
required, not optional.

**Two new tokens the prototype adds, both from real contrast failures:**

- `--on-accent` — white on the existing `--accent: #4f8cff` is only **3.22:1**,
  below AA. Dark text on the accent gives 5.87:1, matching the pattern the POC
  already uses in dark mode.
- `--border-strong` — for borders that identify a control, where WCAG 1.4.11
  wants 3:1. Decorative dividers can stay subtle.

All 14 pairings in the prototype pass. **Verify contrast programmatically before
shipping** — a light theme with failing contrast would be the most quotable flaw
in the project, and the evaluator cannot check its own chrome since it only reads
buttons.

**Pre-existing, separate decision:** the current dark `--border: #2a3240` on
`--surface: #161b23` is **1.34:1**. Subtle borders are already the norm in the
live app, so this is a standing question rather than a regression introduced by
the light theme.

### 3.6 Custom properties are now resolved — FIXED 2026-08-04

Both the evaluator and the preview read the `var()` fallback rather than the
declared token, so editing the design token changed nothing while editing a dead
fallback moved the score.

**Fixed** by `src/features/orchestrator/cssVariables.ts`:
`resolveCssCustomProperties` substitutes `var()` references before any rule or
preview extraction runs. The declared token wins; a fallback applies only when the
token is genuinely undeclared; an undeclared token with no fallback is left
unresolved rather than silently becoming something else.

Applied in three places, deliberately together so the score and the rendered
button cannot disagree:

- `buttonEvaluator` resolves once at entry, so every existing rule reads real
  values with no other change
- `buildPreviewStateCss` resolves before extracting the disabled colours
- the rule-5 annotation now points at the **token declaration**, derived from the
  failing declaration via `tokenNameForDeclaration` rather than hardcoded to the
  sample's naming

Verified: light 85 and dark 100 unchanged; editing the token reaches 100; editing
only the fallback correctly does nothing; the preview colour follows the token
(`rgb(140,140,140)` → `rgb(73,73,73)`); the marker lands on line 12.

**Demo flow changed.** The fix is now made on the **token line (12)**, not the
`var()` usage (48). The annotation points there, so anyone following the highlight
is sent to the right line.

Removed two now-dead helpers from `LiveButtonPreview`: `extractCssTokenValue` and
`extractCssVarFallback`.

**Remaining limitation:** property collection is not scope- or cascade-aware —
every `--name: value` in the stylesheet goes into one map, last winning. Correct
for the single-`:root` stylesheets this evaluates; wrong for CSS that redeclares a
property inside a selector. Revisit if arbitrary pasted CSS becomes supported
(see 3.3).

### 3.7 Unresolvable values scored 100/100 — FIXED 2026-08-04 by 3.6

Stripping the inline fallbacks used to leave the contrast rules unable to read any
colour, returning `Unknown` — and because `Unknown` is excluded from the score
denominator, the result was a **false 100/100** on CSS the tool could not
evaluate. The trigger, `var(--Token)` with no inline fallback, is how real design
systems are written.

Resolution in 3.6 fixes the cause: those values now resolve from `:root`, so the
rules evaluate them properly.

```
before:  no fallbacks, token #8C8C8C  → 100  (rule-5 Unknown, rule-6 Unknown)
after:   no fallbacks, token #8C8C8C  →  85  (rule-5 Fail, 0 unknown)
after:   no fallbacks, token #494949  → 100  (0 fail, 0 unknown)
```

**The underlying scoring question is still open, and worth deciding separately:**
`Unknown` remains excluded from the denominator, so any *future* rule that cannot
evaluate still yields a flattering score. A 100 meaning "we could not tell" is
indistinguishable from a 100 meaning "this is correct." Options: surface an
explicit "not fully evaluated" state instead of a number, or cap the score when a
high-severity rule could not be checked.

## 4. If the Python backend is ever hosted

None of these matter while `app.py` runs on localhost. All of them matter the
moment it is exposed.

- **`app.run(debug=True)`** — enables the Werkzeug interactive debugger, which
  permits **arbitrary code execution** by anyone who can reach it. Must be off
  before hosting.
- **`CORS(app)`** — allows every origin. On a hosted backend, any website could
  call the endpoint and spend the Anthropic credits.
- **API key economics** — per-user inference cost, which is what makes the paid
  tier necessary rather than optional.
- Hosting candidates for Flask: Railway, Render, Fly.io.

---

## 5. Repo housekeeping

- **Delete merged local branches:** `refactor/btn-naming-and-selector-contract`,
  `chore/untrack-build-artifacts`, `chore/all-rights-reserved-license`.
- **`docs/code-command-prompts/`** — five files of personal vibe-coding prompt
  templates, currently public. Decide: publish or untrack. Not sensitive, but
  arguably clutter on a portfolio repo.
- **~61MB of `node_modules` blobs remain in git history** from the initial backup
  commit. A history rewrite was considered and **declined** — the repo was never
  public while they were tracked, and 61MB is well within GitHub's limits. Only
  revisit if clone size becomes a real annoyance.
- The Layers design docs in `docs/design/` are **append-only**. Never overwrite a
  session; the reasoning trail is the value.

---

## 6. Gotchas worth remembering

**`git rm --cached` plus a branch switch will delete files from disk.** Untracking
a directory on a branch, then checking out a branch where it is still tracked and
merging back, makes git delete those files as "tracked files being removed." This
happened twice:

1. `docs/visual-reference/figma-exports/` — the three PNGs were deleted and had to
   be restored from history with `git show`.
2. **`node_modules`** — silently reduced to 3 packages, breaking `npm run dev` and
   the typecheck until `npm install` restored it from the tracked
   `package-lock.json`.

After any merge that removes tracked files, verify the working tree, not just the
branch you were on when you untracked them.

**Vite has no `base` set**, so assets are referenced absolutely (`/assets/...`).
The app must be served from a domain root. A subfolder deploy renders a blank
page unless `base` is configured and the app rebuilt.

**Annotation overlay line height is coupled to CSS.**
`TEXTAREA_LINE_HEIGHT` in `WorkspacePane.tsx` must match the declared
`line-height` on `.code-input` exactly. A fractional value (`1.5` → 19.5px
against a hardcoded 20) drifts roughly 0.5px per line and puts highlights a full
line off by around line 44.

---

Copyright © 2026 orchestratorlabs. All rights reserved.
