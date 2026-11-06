import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PREVIEW_SHELL_CSS, scopePreviewCss } from "../../workspace/LiveButtonPreview";
import { DEMO_REVIEWER_LABEL } from "../demoReviewer";
import { THEME_LABEL, describeCssSource, type ThemeMode } from "../doubleCheckReadiness";
import {
  INTERACTION_CHECKS,
  OUTCOME_LABEL,
  SIMULATION_BEHAVIOR_LINES,
  type CheckId,
  type CheckOutcome,
  type ObservationState,
} from "../interactionObservations";

/**
 * Local interaction preview: "Interaction preview — Button / Save changes".
 *
 * This is a SIMULATED save on a STAND-IN Button. OrchestratoR does not execute the
 * pasted component, so the button here is a plain native <button> styled with the
 * CSS the evaluator actually used. Every behavior (what happens to focus, what is
 * announced) belongs to this demo, not to the developer's component. Opening the
 * preview or finishing the simulated save never records anything: outcomes change
 * only when the reviewer selects one.
 *
 * Built on the native <dialog> element opened with showModal(), so the browser
 * supplies the focus trap, Escape handling and inert background — including for
 * the stand-in button inside its shadow root.
 */

type Phase = "idle" | "saving" | "saved";

const PHASE_LABEL: Record<Phase, string> = {
  idle: "Save changes",
  saving: "Saving…",
  saved: "Changes saved",
};

const SAVE_DURATION_MS = 1500;
const OUTCOME_OPTIONS: CheckOutcome[] = ["untested", "no-issue", "problem"];

function canvasCss(theme: ThemeMode): string {
  // No focus-ring override on purpose: the focus indicator reviewers see is whatever
  // the submitted CSS (or the browser default) really produces.
  const background = theme === "dark" ? "#1A1A1A" : "#E6E6E6";
  return `.preview-canvas { background: ${background}; }
.btn[aria-disabled="true"] { cursor: default; }`;
}

function StandInSaveButton({
  cssCode,
  theme,
  phase,
  onActivate,
}: {
  cssCode: string;
  theme: ThemeMode;
  phase: Phase;
  onActivate: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const onActivateRef = useRef(onActivate);
  onActivateRef.current = onActivate;

  // Built imperatively in an open shadow root, like the live preview, so the
  // submitted CSS cannot reach the application chrome.
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `${PREVIEW_SHELL_CSS}\n${scopePreviewCss(cssCode)}\n${canvasCss(theme)}`;

    const canvas = document.createElement("div");
    canvas.className = "preview-canvas";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.textContent = PHASE_LABEL.idle;
    button.addEventListener("click", () => onActivateRef.current());

    canvas.append(button);
    shadow.replaceChildren(style, canvas);
    buttonRef.current = button;

    return () => {
      shadow.replaceChildren();
      buttonRef.current = null;
    };
  }, [cssCode, theme]);

  // The label changes in place and aria-disabled (never `disabled`) is set while
  // saving, so the button keeps keyboard focus. No live region is added.
  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!button) return;
    button.textContent = PHASE_LABEL[phase];
    if (phase === "idle") {
      button.removeAttribute("aria-disabled");
    } else {
      button.setAttribute("aria-disabled", "true");
    }
  }, [phase, cssCode, theme]);

  return <div ref={hostRef} className="interaction-standin-host" data-testid="standin-host" />;
}

interface DialogBodyProps {
  theme: ThemeMode;
  effectiveCss: string;
  observations: ObservationState;
  onOutcomeChange: (id: CheckId, outcome: CheckOutcome) => void;
  onNoteChange: (id: CheckId, note: string) => void;
  onClose: () => void;
}

function DialogBody({
  theme,
  effectiveCss,
  observations,
  onOutcomeChange,
  onNoteChange,
  onClose,
}: DialogBodyProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    []
  );

  const activate = () => {
    if (phaseRef.current !== "idle") return;
    phaseRef.current = "saving";
    setPhase("saving");
    timerRef.current = window.setTimeout(() => {
      phaseRef.current = "saved";
      setPhase("saved");
      timerRef.current = null;
    }, SAVE_DURATION_MS);
  };

  const reset = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    phaseRef.current = "idle";
    setPhase("idle");
  };

  return (
    <div className="interaction-dialog__inner">
      <div className="interaction-dialog__header">
        <h2 id="interaction-dialog-title" className="interaction-dialog__title">
          Interaction preview — Button / Save changes
        </h2>
        <span className="interaction-dialog__badge">Simulated save</span>
      </div>

      <p className="interaction-dialog__disclosure">
        This preview uses a stand-in Button styled with your CSS. Observations apply to this simulated save.
      </p>
      <p className="interaction-dialog__css-source">
        CSS source ({THEME_LABEL[theme]}): {describeCssSource(theme)}.
      </p>

      <StandInSaveButton cssCode={effectiveCss} theme={theme} phase={phase} onActivate={activate} />

      <div className="interaction-dialog__sim-controls">
        <button
          type="button"
          className="interaction-dialog__secondary-btn interaction-dialog__reset-btn"
          onClick={reset}
        >
          {/* Decorative: the visible label is the accessible name. Same inline stroke-icon
              pattern as the theme toggle (counterclockwise arrow, Feather "rotate-ccw"). */}
          <svg
            aria-hidden="true"
            focusable="false"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          Reset simulation
        </button>
      </div>

      <details className="interaction-dialog__how">
        <summary>How this simulation works</summary>
        <ul>
          {SIMULATION_BEHAVIOR_LINES.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>

      {INTERACTION_CHECKS.map((check) => {
        const entry = observations[check.id];
        return (
          <fieldset key={check.id} className="interaction-check">
            <legend className="interaction-check__question">{check.heading}</legend>
            <div className="interaction-check__outcomes">
              {OUTCOME_OPTIONS.map((outcome) => (
                <label key={outcome} className="interaction-check__option">
                  <input
                    type="radio"
                    name={`interaction-outcome-${check.id}`}
                    value={outcome}
                    checked={entry.outcome === outcome}
                    onChange={() => onOutcomeChange(check.id, outcome)}
                  />
                  {OUTCOME_LABEL[outcome]}
                </label>
              ))}
            </div>
            {entry.outcomeRecordedAt && (
              <p className="interaction-check__stamp">
                Outcome recorded by {DEMO_REVIEWER_LABEL} · {entry.outcomeRecordedAt}
              </p>
            )}
            <label className="interaction-check__note-label" htmlFor={`interaction-note-${check.id}`}>
              {check.noteLabel}
            </label>
            <textarea
              id={`interaction-note-${check.id}`}
              className="interaction-check__note"
              rows={2}
              value={entry.note}
              onChange={(event) => onNoteChange(check.id, event.target.value)}
            />
            {entry.noteRecordedAt && (
              <p className="interaction-check__stamp">
                Note added by {DEMO_REVIEWER_LABEL} · {entry.noteRecordedAt}
              </p>
            )}
          </fieldset>
        );
      })}

      <div className="interaction-dialog__footer">
        <button type="button" className="interaction-dialog__secondary-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export interface InteractionPreviewDialogProps extends Omit<DialogBodyProps, "onClose"> {
  isOpen: boolean;
  onClose: () => void;
}

export function InteractionPreviewDialog({ isOpen, onClose, ...bodyProps }: InteractionPreviewDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // The body mounts only while open, so each opening starts a fresh simulation.
  // Notes and outcomes live in the parent and survive closing and reopening.
  return (
    <dialog
      ref={dialogRef}
      className="interaction-dialog"
      aria-labelledby="interaction-dialog-title"
      onClose={onClose}
    >
      {isOpen && <DialogBody {...bodyProps} onClose={onClose} />}
    </dialog>
  );
}
