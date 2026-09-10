import { useLayoutEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { resolveCssCustomProperties } from "../orchestrator/cssVariables";
import {
  FALLBACK_SELECTOR,
  TARGET_SELECTOR,
  escapeForRegExp,
} from "../orchestrator/evaluator/targetSelector";

export type ButtonPreviewState = "default" | "hover" | "active" | "disabled" | "focused";

function scopePreviewCss(css: string): string {
  return css.replace(/:root\b/g, ":host");
}

function matchFocusVisibleBlock(css: string, selector: string): string | null {
  const match = css.match(
    new RegExp(`${escapeForRegExp(`${selector}:focus-visible`)}\\s*\\{([\\s\\S]*?)\\}`, "m")
  );
  return match ? match[1] : null;
}

/**
 * True only when the submitted CSS carries a `:focus-visible` rule with a real
 * indicator property — mirroring the evaluator's Rule 4 "Pass" condition. When
 * this is false the evaluator returns Unknown for Focus Visibility, so the
 * preview must not draw a focus ring the submitted code does not define.
 *
 * Intentionally a read-only check: it inspects CSS, changes no scoring, findings,
 * or evaluation behaviour, and is used purely to keep the Focused-state preview
 * and its helper message honest.
 */
export function hasVerifiableFocusVisible(cssCode: string): boolean {
  const resolved = resolveCssCustomProperties(cssCode);
  const block =
    matchFocusVisibleBlock(resolved, TARGET_SELECTOR) ??
    matchFocusVisibleBlock(resolved, FALLBACK_SELECTOR);
  if (!block) {
    return false;
  }
  if (/outline\s*:\s*none/.test(block)) {
    return false;
  }
  return /outline|box-shadow|border/.test(block);
}

const PREVIEW_SHELL_CSS = `
@import url("https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700&display=swap");

:host {
  display: block;
  box-sizing: border-box;
  min-height: 120px;
  width: 100%;
}
.preview-canvas {
  min-height: 120px;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  overflow: visible;
  background: #E6E6E6;
}
.preview-empty {
  min-height: 120px;
  padding: 16px;
  color: #1a1a1a;
  font-size: 16px;
  font-weight: 700;
  font-family: Inter, system-ui, sans-serif;
  display: flex;
  align-items: center;
  background: #E6E6E6;
}
.btn {
  min-width: 44px;
  min-height: 44px;
  padding: 10px 20px;
  border: none;
  border-radius: 0.5rem;
  background: #0540AB;
  color: #FFFFFF;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: "Atkinson Hyperlegible Next", Arial, sans-serif;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.2;
}
.btn__label {
  display: inline;
  font-family: inherit;
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
  color: inherit;
}
.preview-stack {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
/* Absolutely positioned so it never adds to the stack's height — the button
   keeps the exact vertical position it has in every other preview state. */
.preview-focus-warning {
  position: absolute;
  top: 100%;
  left: 0;
  margin: 8px 0 0;
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: Inter, system-ui, sans-serif;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
  color: #5A5A5A;
}
.preview-focus-warning__icon {
  font-size: 12px;
  line-height: 1;
}
`;

/* Inserted after user CSS so these modifier classes always win the cascade. */
/**
 * Reads a colour from the disabled rule *after* custom-property resolution, so
 * the preview shows the value a browser would use — the declared token, not the
 * `var()` fallback. This has to resolve the same way the evaluator does, or the
 * rendered button and the score would disagree.
 */
function extractDisabledColor(resolvedCss: string, propertyName: string, fallback: string): string {
  const block = resolvedCss.match(
    new RegExp(`${TARGET_SELECTOR.replace(".", "\\.")}:disabled\\s*\\{([\\s\\S]*?)\\}`, "m")
  );
  const hex = block?.[1].match(new RegExp(`${propertyName}\\s*:\\s*(#[0-9a-fA-F]{3,8})`));
  return hex?.[1] ?? fallback;
}

function buildPreviewStateCss(cssCode: string): string {
  const resolvedCss = resolveCssCustomProperties(cssCode);
  const disabledBackground = extractDisabledColor(resolvedCss, "background", "#BDBDBD");
  const disabledText = extractDisabledColor(resolvedCss, "color", "#494949");

  // Only simulate the focus ring when the submitted CSS actually defines a
  // verifiable `:focus-visible` indicator. Without one the evaluator returns
  // Unknown, and the preview must render the button as the code renders it —
  // no synthetic ring.
  const focusedOutline = hasVerifiableFocusVisible(cssCode)
    ? "outline: 3px solid #011D53;\n  outline-offset: 2px;"
    : "outline: none;";

  return `
.btn.btn--default {
  background: #0540AB;
  color: #FFFFFF;
  outline: none;
  cursor: pointer;
}

.btn.btn--hover {
  background: #022D7F;
  color: #FFFFFF;
  outline: none;
  cursor: pointer;
}

.btn.btn--active {
  background: #011D53;
  color: #FFFFFF;
  outline: none;
  cursor: pointer;
}

.btn.btn--disabled {
  background: ${disabledBackground};
  color: ${disabledText};
  cursor: not-allowed;
  opacity: 1;
  outline: none;
}

.btn.btn--focused {
  background: #0540AB;
  color: #FFFFFF;
  ${focusedOutline}
  cursor: pointer;
}
`;
}

function hasRenderableButton(reactCode: string): boolean {
  return /<button\b/i.test(reactCode);
}

function PreviewContent({
  reactCode,
  selectedState,
  hasLoadedCode,
  showFocusWarning,
}: {
  reactCode: string;
  selectedState: ButtonPreviewState;
  hasLoadedCode: boolean;
  showFocusWarning: boolean;
}) {
  if (!hasLoadedCode) {
    return (
      <div className="preview-empty">
        Select "Load Component Code" to preview and inspect the component.
      </div>
    );
  }

  if (!hasRenderableButton(reactCode)) {
    return (
      <div className="preview-empty">
        No renderable <code>&lt;button&gt;</code> found in current React editor content.
      </div>
    );
  }

  return (
    <div className="preview-canvas">
      <div className="preview-stack">
        <button
          type="button"
          className={`btn btn--${selectedState}`}
          disabled={selectedState === "disabled"}
          onClick={() => {}}
        >
          <span className="btn__label">Button large</span>
        </button>
        {showFocusWarning && (
          <p className="preview-focus-warning" role="status">
            <span className="preview-focus-warning__icon" aria-hidden="true">⚠</span>
            Missing focus-visible styling
          </p>
        )}
      </div>
    </div>
  );
}

export interface LiveButtonPreviewProps {
  cssCode: string;
  reactCode: string;
  selectedState?: ButtonPreviewState;
  hasLoadedCode?: boolean;
  previewTheme?: "light" | "dark";
}

function buildThemeCss(theme: "light" | "dark", cssCode: string): string {
  const bg = theme === "dark" ? "#1A1A1A" : "#E6E6E6";
  // Light keeps the shell's dark-on-light empty-state text; dark needs a light
  // colour or the message is invisible against the dark canvas.
  const emptyRule =
    theme === "dark"
      ? `.preview-empty { background: ${bg}; color: #E6E6E6; }`
      : `.preview-empty { background: ${bg}; }`;
  const base = `.preview-canvas { background: ${bg}; } ${emptyRule}`;

  if (theme !== "dark") {
    return base;
  }

  // Match the light-theme behaviour: no synthetic focus ring unless the
  // submitted CSS defines a verifiable `:focus-visible` indicator.
  const focusedOutline = hasVerifiableFocusVisible(cssCode)
    ? "outline: 3px solid #367BF9;\n  outline-offset: 2px;"
    : "outline: none;";

  return `${base}

.preview-canvas .btn.btn--default {
  background: #8DB6FF;
  color: #1A1A1A;
}

.preview-canvas .btn.btn--hover {
  background: #5E97FF;
  color: #1A1A1A;
}

.preview-canvas .btn.btn--active {
  background: #367BF9;
  color: #1A1A1A;
}

.preview-canvas .btn.btn--disabled {
  background: #D5D5D5;
  color: #595959;
}

.preview-canvas .btn.btn--focused {
  background: #8DB6FF;
  color: #1A1A1A;
  ${focusedOutline}
}

.preview-canvas .preview-focus-warning {
  color: #9A9A9A;
}`;
}

/**
 * Renders the MVP button preview in an open shadow root so edited `.btn` / token CSS
 * does not collide with the host app, while keeping a real native button in normal tab order.
 *
 * Shadow DOM order: shell → user CSS → state overrides → theme → React mount.
 * State override CSS sits after user CSS so modifier classes always win the cascade.
 */
export function LiveButtonPreview({
  cssCode,
  reactCode,
  selectedState = "default",
  hasLoadedCode = false,
  previewTheme = "light",
}: LiveButtonPreviewProps) {
  // The Focused state is selected but the submitted CSS defines no verifiable
  // `:focus-visible` indicator — the same gap the evaluator reports as Unknown.
  // Shown inside the preview, next to the button; never changes evaluation.
  const showFocusWarning =
    selectedState === "focused" &&
    hasLoadedCode &&
    hasRenderableButton(reactCode) &&
    !hasVerifiableFocusVisible(cssCode);

const hostRef = useRef<HTMLDivElement>(null);
const userStyleRef = useRef<HTMLStyleElement | null>(null);
const stateStyleRef = useRef<HTMLStyleElement | null>(null);
const themeStyleRef = useRef<HTMLStyleElement | null>(null);
const reactRootRef = useRef<Root | null>(null);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) {
      return;
    }

    const shadow = el.shadowRoot ?? el.attachShadow({ mode: "open" });

    if (!shadow.querySelector("[data-preview-mount]")) {
      const shell = document.createElement("style");
      shell.setAttribute("data-preview-shell", "");
      shell.textContent = PREVIEW_SHELL_CSS;

      const userStyle = document.createElement("style");
      userStyle.setAttribute("data-preview-user", "");

      const stateOverride = document.createElement("style");
      stateOverride.setAttribute("data-preview-state", "");
      stateOverride.textContent = buildPreviewStateCss(cssCode);
      stateStyleRef.current = stateOverride;

      const themeStyle = document.createElement("style");
      themeStyle.setAttribute("data-preview-theme", "");
      themeStyle.textContent = buildThemeCss(previewTheme, cssCode);
      themeStyleRef.current = themeStyle;

      const mount = document.createElement("div");
      mount.setAttribute("data-preview-mount", "");

      shadow.append(shell, userStyle, stateOverride, themeStyle, mount);
      userStyleRef.current = userStyle;
      reactRootRef.current = createRoot(mount);
    }

    return () => {
      reactRootRef.current?.unmount();
      reactRootRef.current = null;
      userStyleRef.current = null;
      stateStyleRef.current = null;
      themeStyleRef.current = null;
      shadow.replaceChildren();
    };
  }, []);

useLayoutEffect(() => {
  if (userStyleRef.current) {
    userStyleRef.current.textContent = scopePreviewCss(cssCode);
  }

  if (stateStyleRef.current) {
    stateStyleRef.current.textContent = buildPreviewStateCss(cssCode);
  }

  if (themeStyleRef.current) {
    themeStyleRef.current.textContent = buildThemeCss(previewTheme, cssCode);
  }
}, [cssCode, previewTheme]);

  useLayoutEffect(() => {
    reactRootRef.current?.render(
      <PreviewContent
        reactCode={reactCode}
        selectedState={selectedState}
        hasLoadedCode={hasLoadedCode}
        showFocusWarning={showFocusWarning}
      />
    );
  }, [reactCode, selectedState, hasLoadedCode, showFocusWarning]);

  return <div ref={hostRef} className="live-button-preview-host" />;
}
