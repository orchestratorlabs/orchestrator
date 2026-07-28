# Moderator script — Protocol A · Engineers

**30 min · moderated · screen share · think-aloud**
Covers RQ1 (triggers), RQ2 (friction), RQ3 (comprehension).
Full rationale: [layers-session.md](layers-session.md) Session 3.

> **Before you start:** Flask running? `curl 127.0.0.1:5001` — if it's down,
> DoubleCheck fails and probes 8–10 need the screenshot fallback.
> Recording on. Capture sheet open.

---

## 0–3 · Setup

Read aloud:

> "Thanks for doing this. This is a proof of concept I built — I'm testing it,
> not you. If something's confusing, that's exactly the finding I need, so
> please don't work around it quietly.
>
> Two things: think out loud as much as you can, even half-formed thoughts. And
> it only evaluates buttons — that's a deliberate limit, not something you've
> missed."

Confirm recording consent.

---

## 3–9 · RQ1 · Retrospective

Open with:

> "Tell me about the last time you shipped, or nearly shipped, a component with
> an accessibility problem. Walk me through what was happening."

Follow their story. Don't lead it.

- "What made you notice?"
- "What did you reach for first?"
- "What did you do when that didn't settle it?"
- "Who else got involved, and when?"

**Listen for:** nouns they use naturally · workarounds they invented.

⏱ **Move on at 9:00 even mid-story.** The task matters more.

---

## 9–21 · RQ2 · Task, unaided

Hand over screen control. Say only:

> "Find out whether this button is accessible enough to ship."

**Say nothing else.** Do not mention the panel. **No help for the first 90
seconds of any stall** — silence is the data.

If they're still stuck past 90s: *"What are you looking for right now?"* — then
wait again. Only rescue if the session is at risk.

Watch for → capture sheet:
- Did they find the panel trigger unaided? How long?
- Time to first completed evaluation
- Did they switch theme unprompted?
- Did they run DoubleCheck without being told it exists?
- Did they reach a ship / don't-ship decision — and on what basis?
- Every hesitation + what was on screen

---

## 21–28 · RQ3 · Comprehension probes

**Never explain before they answer.** Ask, wait, record verbatim.

**Score meaning**
1. *(point at score)* "What does this number tell you?"
2. "What would make it go up?"

**Score subject** — if they didn't switch theme themselves, do it now
3. "Same button. Light mode says 85, dark says 100. What do you make of that?"
4. "So what's this component's score?"

**Evidence gaps** — switch to the **no-CSS fixture**
5. "What does Unknown mean here?"
6. "Is Unknown better or worse than Fail?"
7. **"Would you ship this?"** ← record yes/no exactly

**Verdict subject**
8. *(point at DoubleCheck verdict)* "This says PASS. What is it saying passed?"

**Action**
9. "What would you do next?"
10. *(if Approve is showing)* "What does approving this mean? Who's it for?"

---

## 28–30 · Close

> "Is there anything I haven't asked that would help me understand this better?"

Optional, only if time genuinely remains: let them paste their own component.
Mark anything from it as discounted — the `.btn` selector match means Unknowns
may be artefacts, not real evidence gaps.

Thank them. Stop recording.
