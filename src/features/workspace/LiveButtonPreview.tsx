import { useLayoutEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";

export type ButtonPreviewState = "default" | "hover" | "active" | "disabled" | "focused";

function scopePreviewCss(css: string): string {
  return css.replace(/:root\b/g, ":host");
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
.icon-btn {
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
.icon-btn__icon {
  display: none;
}
.icon-btn__label {
  display: inline;
  font-family: inherit;
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
  color: inherit;
}
`;

/* Inserted after user CSS so these modifier classes always win the cascade. */
function extractCssTokenValue(cssCode: string, tokenName: string, fallback: string): string {
  const escapedToken = tokenName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = cssCode.match(new RegExp(`${escapedToken}\\s*:\\s*(#[0-9a-fA-F]{3,8})\\s*;`));

  return match?.[1] ?? fallback;
}

function extractCssVarFallback(cssCode: string, propertyName: string, tokenName: string): string | null {
  const escapedProperty = propertyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedToken = tokenName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const match = cssCode.match(
    new RegExp(`${escapedProperty}\\s*:\\s*var\\(${escapedToken}\\s*,\\s*(#[0-9a-fA-F]{3,8})\\s*\\)\\s*;`)
  );

  return match?.[1] ?? null;
}

function buildPreviewStateCss(cssCode: string): string {
  const disabledBackground =
    extractCssVarFallback(cssCode, "background", "--Bg-Disabled") ??
    extractCssTokenValue(cssCode, "--Bg-Disabled", "#BDBDBD");

  const disabledText =
    extractCssVarFallback(cssCode, "color", "--Text-Disabled") ??
    extractCssTokenValue(cssCode, "--Text-Disabled", "#494949");

  return `
.icon-btn.icon-btn--default {
  background: #0540AB;
  color: #FFFFFF;
  outline: none;
  cursor: pointer;
}

.icon-btn.icon-btn--hover {
  background: #022D7F;
  color: #FFFFFF;
  outline: none;
  cursor: pointer;
}

.icon-btn.icon-btn--active {
  background: #011D53;
  color: #FFFFFF;
  outline: none;
  cursor: pointer;
}

.icon-btn.icon-btn--disabled {
  background: ${disabledBackground};
  color: ${disabledText};
  cursor: not-allowed;
  opacity: 1;
  outline: none;
}

.icon-btn.icon-btn--focused {
  background: #0540AB;
  color: #FFFFFF;
  outline: 3px solid #011D53;
  outline-offset: 2px;
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
}: {
  reactCode: string;
  selectedState: ButtonPreviewState;
  hasLoadedCode: boolean;
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
      <button
        type="button"
        className={`icon-btn icon-btn--${selectedState}`}
        disabled={selectedState === "disabled"}
        onClick={() => {}}
      >
        <span className="icon-btn__label">Button large</span>
      </button>
    </div>
  );
}

export interface LiveButtonPreviewProps {
  cssCode: string;
  reactCode: string;
  selectedState?: ButtonPreviewState;
  hasLoadedCode?: boolean;
}

/**
 * Renders the MVP button preview in an open shadow root so edited `.icon-btn` / token CSS
 * does not collide with the host app, while keeping a real native button in normal tab order.
 *
 * Shadow DOM order: shell → user CSS → state overrides → React mount.
 * State override CSS sits after user CSS so modifier classes always win the cascade.
 */
export function LiveButtonPreview({
  cssCode,
  reactCode,
  selectedState = "default",
  hasLoadedCode = false,
}: LiveButtonPreviewProps) {
const hostRef = useRef<HTMLDivElement>(null);
const userStyleRef = useRef<HTMLStyleElement | null>(null);
const stateStyleRef = useRef<HTMLStyleElement | null>(null);
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

      const mount = document.createElement("div");
      mount.setAttribute("data-preview-mount", "");

      shadow.append(shell, userStyle, stateOverride, mount);
      userStyleRef.current = userStyle;
      reactRootRef.current = createRoot(mount);
    }

    return () => {
      reactRootRef.current?.unmount();
      reactRootRef.current = null;
      userStyleRef.current = null;
      stateStyleRef.current = null;
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
}, [cssCode]);

  useLayoutEffect(() => {
    reactRootRef.current?.render(
      <PreviewContent reactCode={reactCode} selectedState={selectedState} hasLoadedCode={hasLoadedCode} />
    );
  }, [reactCode, selectedState, hasLoadedCode]);

  return <div ref={hostRef} className="live-button-preview-host" />;
}
