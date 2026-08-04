# OrchestratoR™ — Backlog

Running list of fixes, ideas, and decisions not yet acted on. Newest thinking at
the top of each section. Companion to
[vercel-demo-deploy-runbook.md](design/vercel-demo-deploy-runbook.md).

Last updated: 2026-07-31

---

## 1. Blocking the demo launch

| # | Item | Owner | Status |
| --- | --- | --- | --- |
| 1.1 | A11Y DoubleCheck / Ask OrchestratoR show an intentional "needs local service" message instead of a failure when hosted | Claude | **Done, uncommitted** |
| 1.2 | `index.html` metadata — `<title>`, `<meta name="description">`, `og:title` / `og:description` / `og:image`, favicon | Claude | Open |
| 1.3 | Embed `docs/visual-reference/screenshots/` images in the README | Claude | Open |
| 1.4 | Deploy to Vercel, add `demo.orchestratorlabs.ai` CNAME in Squarespace | Craig | Open |
| 1.5 | Add the live demo link to the top of the README | Claude, after 1.4 | Open |

**On 1.2 — why it matters.** Currently `<title>Orchestrator MVP</title>` with no
description, no social preview, and no favicon. That is what appears when the
demo URL is pasted into LinkedIn, Slack, or an email — "Orchestrator MVP" with no
image. For a product designer sharing a link with recruiters, it is the most
visible polish gap in the project.

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
| 2.1 | Upload as the **GitHub repo social preview** | Repo → Settings → General → Social preview |
| 2.2 | Set the **case study page** social image | Squarespace → Page Settings → Social Image |
| 2.3 | Set the **orchestratorlabs.ai** social image | Squarespace → Page Settings → Social Image |
| 2.4 | Use as the **LinkedIn post** image when announcing | LinkedIn |
| 2.5 | Add the demo to the **LinkedIn Featured** section | LinkedIn profile |
| 2.6 | Use as the **deck title slide** | OrchestratoR™ deck |

**Do 2.1 first** — it takes under a minute, needs no deploy, and without it
GitHub shows an auto-generated grey card with the repo name whenever the repo
link is shared.

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

---

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
