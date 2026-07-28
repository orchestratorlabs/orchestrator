# Moderator script — Protocol B · Accessibility experts

**30 min · moderated · screen share · think-aloud**
Covers RQ2 (friction) and RQ4 (content validity).
**Not a source of RQ3 comprehension data** — experts already know what Unknown
means, so their answers can't tell you whether a target user understands it.
Full rationale: [layers-session.md](layers-session.md) Session 3.

> **Before you start:** Flask running? `curl 127.0.0.1:5001`.
> Recording on. Capture sheet open. Rule list ready to show at probe 5.

---

## 0–3 · Setup

Read aloud:

> "Thanks for doing this. This is a proof of concept I built — I'm testing it,
> not you. I'm after two things: where the interface gets in your way, and
> whether the findings are actually right. Please be blunt about the second one.
>
> Think out loud as much as you can. And it only evaluates buttons — deliberate
> limit, not something you've missed."

Confirm recording consent.

---

## 3–6 · Current practice

Brief — this calibrates their later answers, it isn't a research question.

> "When you audit a component today, what do you actually use?"
> "What does a finding have to include before you'd act on it?"

⏱ **Hard stop at 6:00.** This is the block most likely to overrun.

---

## 6–15 · RQ2 · Task, unaided

Hand over screen control. Say only:

> "Find out whether this button is accessible enough to ship."

Do not mention the panel. **No help for the first 90 seconds of any stall.**

They'll finish faster than engineers — that's expected. **What matters is where
an expert hesitates anyway.** Subject-matter confusion is ruled out by who they
are, so any stall here is a pure interface problem. This is your cleanest RQ2
signal in the whole study; capture it in detail even if it feels minor.

Watch for → capture sheet:
- Did they find the panel trigger unaided? How long?
- Did they run DoubleCheck without being told it exists?
- Every hesitation + what was on screen
- Anything they expected to find and couldn't

---

## 15–27 · RQ4 · Content validity

Walk **three or four findings** — include at least one Fail and one Unknown.

Per finding:
1. "Is this finding correct?"
2. "Is the evidence it gives sufficient to justify that verdict?"
3. "Is the recommended fix what you'd advise?"

Then:

4. **"Anything it should have caught and didn't?"**
   ← the most important question in this protocol. False negatives matter far
   more than false positives for a tool claiming ship-readiness. Ask it even if
   you're running late.

5. *(show the nine-rule list)* "Are these the right nine? What's missing?"

6. "Would you trust this in a review? What would have to change first?"

---

## 27–30 · Close

> "Is there anything I haven't asked that would help me understand this better?"

Thank them. Stop recording.
