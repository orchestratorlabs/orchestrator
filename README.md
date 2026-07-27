# OrchestratoR™

**Your accessibility co-pilot — Detect. Fix. Ship.**

OrchestratoR aligns teams across design, product, engineering, and compliance —
detecting, fixing, and shipping accessible experiences faster.

Every accessibility issue caught upstream saves hours downstream, turning
compliance into measurable time and cost savings.

---

> ### ⚠️ Portfolio project — please read
>
> This repository is published **for portfolio and demonstration purposes only**.
> It is a proof of concept, not a product, and not an open source project.
>
> - **All rights reserved.** No license to use, modify, or redistribute is
>   granted — see [LICENSE](LICENSE).
> - **Not accepting contributions.** Issues and pull requests are not being
>   monitored.
> - **No support or warranty.** Provided as-is.
>
> It is shared so the approach and implementation can be *read*, not adopted.

---

## What it does

Paste a button component's React and CSS into the workspace and OrchestratoR
evaluates it against nine accessibility rules, returning a health score with
per-rule findings that link back to the exact lines responsible.

- **Rule engine** — semantic markup, accessible name, keyboard operability,
  focus visibility, text contrast, non-text contrast, target size, disabled
  state, and state coverage
- **Live preview** — renders the component in a shadow root across five states
  (default, hover, active, disabled, focused) in both light and dark mode
- **A11Y DoubleCheck** — an optional second pass using Claude to sanity-check
  the deterministic findings
- **Inline annotations** — each finding highlights the CSS or TSX lines it came
  from

### Scope of the proof of concept

Being candid about the boundaries:

- Evaluates **buttons only**
- Locates CSS by matching a known selector (`.btn`, falling back to `button`),
  so arbitrary CSS may not be fully analysed
- No automated test suite

## Tech stack

**Frontend** — React 18, TypeScript, Vite
**Backend** — Python, Flask, Anthropic SDK

## Running it locally

Both halves need to be running. The frontend calls the backend on
`http://127.0.0.1:5001`.

### 1. Backend

```bash
pip install -r requirements.txt
cp .env.example .env        # then add your Anthropic API key
python app.py               # serves on http://127.0.0.1:5001
```

Your `.env` needs:

```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
```

The key is read server-side only and is never exposed to the browser. `.env` is
gitignored — do not commit it.

### 2. Frontend

```bash
npm install
npm run dev
```

Then open the URL Vite prints, click **Load Component Code**, and run the
evaluation.

> **Without the backend running**, the workspace, rule engine, scoring, and live
> preview all work. The three Claude-backed features — A11Y DoubleCheck, RAG
> query, and echo — will fail, since they require the Flask service.

## Documentation

See [docs/](docs/) for the evaluation rules, scoring policy, RAG registry, and
wireframe specifications.

## Notes

The seeded sample scores **85 in light mode and 100 in dark mode**. That is not
a bug: the light theme's disabled tokens (`--Text-Disabled: #8C8C8C` on
`--Bg-Disabled: #BDBDBD`) sit at roughly 1.9:1, below the 4.5:1 threshold, so
the text-contrast rule correctly fails. The dark theme's equivalents pass.

---

Copyright © 2026 orchestratorlabs. All rights reserved.
