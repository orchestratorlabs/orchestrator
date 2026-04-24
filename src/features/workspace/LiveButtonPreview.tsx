import { useLayoutEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";

/** Shadow :host replaces document :root so design tokens apply inside the preview without touching app :root. */
function scopePreviewCss(css: string): string {
  return css.replace(/:root\b/g, ":host");
}

const PREVIEW_SHELL_CSS = `
:host {
  display: block;
  box-sizing: border-box;
  color-scheme: dark;
  background: #0f141d;
  color: #d6deeb;
  font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
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
}
.preview-empty {
  min-height: 120px;
  padding: 16px;
  color: #9aa6ba;
  font-size: 12px;
  display: flex;
  align-items: center;
}
`;

function hasRenderableButton(reactCode: string): boolean {
  return /<button\b/i.test(reactCode);
}

function PreviewContent({ reactCode }: { reactCode: string }) {
  if (!hasRenderableButton(reactCode)) {
    return (
      <div className="preview-empty">
        No renderable <code>&lt;button&gt;</code> found in current React editor content.
      </div>
    );
  }

  return (
    <div className="preview-canvas">
      <button type="button" className="icon-btn" onClick={() => {}}>
        <span aria-hidden="true" className="icon-btn__icon">
          ✕
        </span>
        <span className="icon-btn__label">Close</span>
      </button>
    </div>
  );
}

export interface LiveButtonPreviewProps {
  cssCode: string;
  reactCode: string;
}

/**
 * Renders the MVP button preview in an open shadow root so edited `.icon-btn` / token CSS
 * does not collide with the host app, while keeping a real native button in normal tab order.
 */
export function LiveButtonPreview({ cssCode, reactCode }: LiveButtonPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const userStyleRef = useRef<HTMLStyleElement | null>(null);
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
      const mount = document.createElement("div");
      mount.setAttribute("data-preview-mount", "");
      shadow.append(shell, userStyle, mount);
      userStyleRef.current = userStyle;
      reactRootRef.current = createRoot(mount);
    }

    return () => {
      reactRootRef.current?.unmount();
      reactRootRef.current = null;
      userStyleRef.current = null;
      shadow.replaceChildren();
    };
  }, []);

  useLayoutEffect(() => {
    if (userStyleRef.current) {
      userStyleRef.current.textContent = scopePreviewCss(cssCode);
    }
  }, [cssCode]);

  useLayoutEffect(() => {
    reactRootRef.current?.render(<PreviewContent reactCode={reactCode} />);
  }, [reactCode]);

  return <div ref={hostRef} className="live-button-preview-host" />;
}
