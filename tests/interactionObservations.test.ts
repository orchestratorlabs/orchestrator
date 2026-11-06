// Run with: npm test
//
// Covers the optional interaction preview's observation state and its export
// section: every check starts Untested, a note never completes a check, stamps
// appear only where something was recorded, and the dark-mode CSS source is named.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_REVIEWER_LABEL } from "../src/features/orchestrator/demoReviewer";
import {
  INTERACTION_CHECKS,
  createObservationState,
  formatObservationsSection,
  interactionChipText,
  setNote,
  setOutcome,
  untestedCount,
} from "../src/features/orchestrator/interactionObservations";

const NOW = new Date(2026, 10, 6, 9, 14);

describe("initial state", () => {
  it("starts every check Untested with nothing recorded", () => {
    const state = createObservationState();
    for (const check of INTERACTION_CHECKS) {
      assert.equal(state[check.id].outcome, "untested");
      assert.equal(state[check.id].note, "");
      assert.equal(state[check.id].outcomeRecordedAt, null);
      assert.equal(state[check.id].noteRecordedAt, null);
    }
    assert.equal(untestedCount(state), 2);
    assert.equal(interactionChipText(state), "Interaction preview: 2 checks untested");
  });

  it("uses the radio-group headings and note labels that match the options", () => {
    assert.deepEqual(
      INTERACTION_CHECKS.map((c) => c.heading),
      ["Keyboard focus after activation", "Screen-reader announcement after saving"]
    );
    assert.deepEqual(
      INTERACTION_CHECKS.map((c) => c.noteLabel),
      ["Where did focus go? (optional)", "What did you hear? (optional)"]
    );
  });
});

describe("notes are separate from outcomes", () => {
  it('saves "Screen reader unavailable" without completing the check', () => {
    const state = setNote(createObservationState(), "announcement", "Screen reader unavailable", NOW);
    assert.equal(state.announcement.note, "Screen reader unavailable");
    assert.equal(state.announcement.outcome, "untested");
    assert.equal(state.announcement.outcomeRecordedAt, null);
    assert.ok(state.announcement.noteRecordedAt);
    assert.equal(untestedCount(state), 2);
    assert.equal(interactionChipText(state), "Interaction preview: 2 checks untested");
  });

  it("lowers the untested count only for an explicit outcome", () => {
    let state = setOutcome(createObservationState(), "focus", "no-issue", NOW);
    assert.equal(untestedCount(state), 1);
    assert.equal(interactionChipText(state), "Interaction preview: 1 check untested");
    state = setOutcome(state, "announcement", "problem", NOW);
    assert.equal(untestedCount(state), 0);
    assert.equal(interactionChipText(state), "Interaction preview: 2 checks recorded");
  });

  it("clears the outcome stamp when the reviewer returns to Untested", () => {
    let state = setOutcome(createObservationState(), "focus", "no-issue", NOW);
    state = setOutcome(state, "focus", "untested", NOW);
    assert.equal(state.focus.outcomeRecordedAt, null);
    assert.equal(untestedCount(state), 2);
  });

  it("clears the note stamp when the note is emptied", () => {
    let state = setNote(createObservationState(), "focus", "hello", NOW);
    state = setNote(state, "focus", "   ", NOW);
    assert.equal(state.focus.noteRecordedAt, null);
  });

  it("does not mutate the previous state", () => {
    const before = createObservationState();
    setOutcome(before, "focus", "problem", NOW);
    assert.equal(before.focus.outcome, "untested");
  });
});

describe("export section", () => {
  it("always appears, with both checks Untested and no attribution, when nothing was recorded", () => {
    const text = formatObservationsSection({ state: createObservationState(), theme: "light" });
    assert.match(text, /^## Interaction observations \(manual, simulated\)/);
    assert.match(text, /Not included in the Health Score or component approval\./);
    assert.equal(text.split("Status: Untested").length - 1, 2);
    assert.doesNotMatch(text, /recorded by/i);
    assert.doesNotMatch(text, /Note added by/);
    assert.doesNotMatch(text, /Note \(/);
  });

  it("shows a note on an Untested check, attributed as a note and not as an outcome", () => {
    const state = setNote(createObservationState(), "announcement", "Screen reader unavailable", NOW);
    const text = formatObservationsSection({ state, theme: "light" });
    assert.match(text, /Status: Untested\n\s+Note \(What did you hear\?\): Screen reader unavailable/);
    assert.match(text, new RegExp(`Note added by ${DEMO_REVIEWER_LABEL.replace(/[()]/g, "\\$&")}`));
    assert.doesNotMatch(text, /Outcome recorded by/);
  });

  it("attributes an explicit outcome to the demo placeholder reviewer", () => {
    const state = setOutcome(createObservationState(), "focus", "problem", NOW);
    const text = formatObservationsSection({ state, theme: "light" });
    assert.match(text, /Status: Problem observed/);
    assert.match(text, /Outcome recorded by John Doe · Developer \(demo placeholder\)/);
  });

  it("titles each check with its heading", () => {
    const text = formatObservationsSection({ state: createObservationState(), theme: "light" });
    assert.match(text, /1\. Keyboard focus after activation/);
    assert.match(text, /2\. Screen-reader announcement after saving/);
  });

  it("names the stand-in and the demo's behavior, so observations are not read as being about the component", () => {
    const text = formatObservationsSection({ state: createObservationState(), theme: "light" });
    assert.match(text, /stand-in Button, simulated save/);
    assert.match(text, /no live region/);
    assert.match(text, /never moves focus/);
  });

  it("labels the CSS source accurately in each theme", () => {
    const dark = formatObservationsSection({ state: createObservationState(), theme: "dark" });
    const light = formatObservationsSection({ state: createObservationState(), theme: "light" });
    assert.match(dark, /Dark mode\): built-in sample dark CSS/);
    assert.match(light, /Light mode\): the CSS in the editor/);
  });
});
