# Raw research data — not tracked

Completed capture sheets go here. **Everything in this folder except this
README is gitignored, deliberately.**

## Why

This repository is public, and pushed git history is permanent — deleting a file
later does not remove it from history or from anything that has already cloned
or indexed it. Completed capture sheets contain:

- participant identifiers
- verbatim quotes
- in the expert sessions, named professionals' critical assessments of the
  product

None of that belongs in a public repo, and consent to be recorded for research
is not consent to be published on GitHub.

## Back it up somewhere else

Being untracked is not the same as being safe. This data is irreplaceable — a
first encounter with a participant cannot be re-run, so a lost capture sheet is
a lost session rather than a lost file.

Keep it somewhere private *with redundancy*: a private repo, encrypted cloud
storage, or at minimum a verified Time Machine backup. Local-only is the worst
combination — no disclosure risk, maximum loss risk.

## What does go back into the repo

Synthesised findings, added to [../layers-session.md](../layers-session.md) as a
new append-only session: patterns, candidate job stories with confidence
ratings, and anonymised quotes. Aggregate and de-identify before it crosses back
over.

## Naming

`P01-engineer-2026-07-28.md` · `P02-expert-2026-07-28.md`

Use participant IDs, not names, even in the untracked files — so that if one is
ever moved or pasted somewhere by accident, it carries less.
