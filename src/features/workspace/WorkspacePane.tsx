import { useEffect, useMemo, useRef, useState } from "react";
import type { EvaluationResult, RuleResult } from "../orchestrator/types/evaluation";

const SAMPLE_TSX = `import React from "react";
import "./MixedIconButton.css";

type IconButtonProps = {
  onClick?: () => void;
  disabled?: boolean;
};

export function MixedIconButton({
  onClick,
  disabled = false,
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="icon-btn"
      disabled={disabled}
    >
      <span aria-hidden="true" className="icon-btn__icon">✕</span>
      <span className="icon-btn__label">Close</span>
    </button>
  );
}`;

const SAMPLE_CSS = `@import url("https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;500;600;700&display=swap");

:root {
  --Corner-M: 0.5rem;
  --Bg-Brand: #0540ab;
  --Bg-Brand-Hover: #043892;
  --Bg-Brand-Active: #032d75;
  --Text-On-Brand: #ffffff;
  --Focus-Ring: #111827;
  --Bg-Disabled: #cbd5e1;
  --Text-Disabled: #475569;
}

.icon-btn {
  min-width: 44px;
  min-height: 44px;
  padding: 10px 14px;
  border: none;
  border-radius: var(--Corner-M, 0.5rem);
  background: var(--Bg-Brand, #0540ab);
  color: var(--Text-On-Brand, #ffffff);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: "Atkinson Hyperlegible Next", Arial, sans-serif;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.2;
}

.icon-btn:focus-visible {
  outline: 3px solid var(--Focus-Ring, #111827);
  outline-offset: 2px;
}

.icon-btn:hover {
  background: var(--Bg-Brand-Hover, #043892);
}

.icon-btn:active {
  background: var(--Bg-Brand-Active, #032d75);
}

.icon-btn:disabled {
  background: var(--Bg-Disabled, #cbd5e1);
  color: var(--Text-Disabled, #475569);
  cursor: not-allowed;
  opacity: 1;
}

.icon-btn__icon {
  font-size: 16px;
  line-height: 1;
}`;

interface WorkspacePaneProps {
  reactCode: string;
  cssCode: string;
  evaluationResult: EvaluationResult | null;
  selectedFindingRuleId: string | null;
  isEvaluating: boolean;
  onReactCodeChange: (value: string) => void;
  onCssCodeChange: (value: string) => void;
  onLoadSample: () => void;
  onEvaluate: () => void;
}

type AnnotationStatus = Extract<RuleResult["status"], "Fail" | "Unknown">;
type AnnotationTarget = "tsx" | "css";

interface CodeAnnotation {
  id: string;
  startLine: number;
  endLine: number;
  focusLine: number;
  label: string;
  status: AnnotationStatus;
  target: AnnotationTarget;
}

interface LineRange {
  startLine: number;
  endLine: number;
}

const TEXTAREA_LINE_HEIGHT = 20;
const TEXTAREA_TOP_PADDING = 12;

function lineFromIndex(code: string, index: number): number {
  return code.slice(0, Math.max(index, 0)).split("\n").length;
}

function rangeFromPattern(code: string, pattern: RegExp): LineRange | null {
  const match = code.match(pattern);
  if (!match || match.index === undefined) {
    return null;
  }
  const startLine = lineFromIndex(code, match.index);
  const endLine = lineFromIndex(code, match.index + Math.max(match[0].length - 1, 0));
  return { startLine, endLine: Math.max(startLine, endLine) };
}

function firstRangeFromPatterns(
  code: string,
  patterns: RegExp[],
  fallbackRange: LineRange
): LineRange {
  for (const pattern of patterns) {
    const range = rangeFromPattern(code, pattern);
    if (range) {
      return range;
    }
  }
  return fallbackRange;
}

function firstSingleLineRangeFromPatterns(
  code: string,
  patterns: RegExp[],
  fallbackLine: number
): LineRange {
  const range = firstRangeFromPatterns(code, patterns, {
    startLine: fallbackLine,
    endLine: fallbackLine
  });
  return { startLine: range.startLine, endLine: range.startLine };
}

function firstMatchingLineFromPatterns(
  code: string,
  patterns: RegExp[],
  fallbackLine: number
): number {
  const range = firstRangeFromPatterns(
    code,
    patterns,
    { startLine: fallbackLine, endLine: fallbackLine }
  );
  return range.startLine;
}

function findCssSelectorBlockRange(cssCode: string, selectorPattern: RegExp): LineRange | null {
  return rangeFromPattern(cssCode, selectorPattern);
}

function midpointLine(range: LineRange): number {
  return Math.round((range.startLine + range.endLine) / 2);
}

function mapFindingToAnnotation(finding: RuleResult, reactCode: string, cssCode: string): CodeAnnotation {
  const fallbackTsxRange = firstRangeFromPatterns(
    reactCode,
    [/<button\b[\s\S]*?<\/button>/m, /<(div|span)\b[\s\S]*?<\/(div|span)>/m],
    { startLine: 1, endLine: 1 }
  );
  const fallbackCssRange = firstRangeFromPatterns(
    cssCode,
    [/\.icon-btn\s*\{[\s\S]*?\}/m, /button\s*\{[\s\S]*?\}/m, /:root\s*\{[\s\S]*?\}/m],
    { startLine: 1, endLine: 1 }
  );
  const status = finding.status as AnnotationStatus;
  const buttonBlockRange = firstRangeFromPatterns(
    reactCode,
    [/<button\b[\s\S]*?<\/button>/m, /<(div|span)\b[\s\S]*?<\/(div|span)>/m],
    fallbackTsxRange
  );
  const cssBaseBlockRange = firstRangeFromPatterns(
    cssCode,
    [/\.icon-btn\s*\{[\s\S]*?\}/m, /button\s*\{[\s\S]*?\}/m],
    fallbackCssRange
  );
  const focusVisibleRange =
    findCssSelectorBlockRange(cssCode, /\.icon-btn:focus-visible\s*\{[\s\S]*?\}/m) ??
    findCssSelectorBlockRange(cssCode, /button:focus-visible\s*\{[\s\S]*?\}/m);
  const disabledRange =
    findCssSelectorBlockRange(cssCode, /\.icon-btn:disabled\s*\{[\s\S]*?\}/m) ??
    findCssSelectorBlockRange(cssCode, /button:disabled\s*\{[\s\S]*?\}/m);

  switch (finding.ruleId) {
    case "rule-1-semantic-button":
      return {
        id: finding.ruleId,
        ...firstSingleLineRangeFromPatterns(
          reactCode,
          [/<(div|span)\b/, /<button\b/, /onClick/, /className=/],
          buttonBlockRange.startLine
        ),
        focusLine: firstMatchingLineFromPatterns(
          reactCode,
          [/<(div|span)\b/, /<button\b/, /onClick/, /className=/],
          buttonBlockRange.startLine
        ),
        label: finding.ruleName,
        status,
        target: "tsx"
      };
    case "rule-2-accessible-name":
    case "rule-3-keyboard-operability":
      return {
        id: finding.ruleId,
        ...buttonBlockRange,
        focusLine: firstMatchingLineFromPatterns(
          reactCode,
          [/aria-label/, /aria-labelledby/, /<button\b/, /className=/],
          midpointLine(buttonBlockRange)
        ),
        label: finding.ruleName,
        status,
        target: "tsx"
      };
    case "rule-4-focus-visible":
      return {
        id: finding.ruleId,
        ...(focusVisibleRange ?? cssBaseBlockRange),
        focusLine: firstMatchingLineFromPatterns(
          cssCode,
          [/outline\s*:/, /box-shadow\s*:/, /border\s*:/, /:focus-visible/],
          midpointLine(focusVisibleRange ?? cssBaseBlockRange)
        ),
        label: finding.ruleName,
        status,
        target: "css"
      };
    case "rule-6-non-text-contrast":
      return {
        id: finding.ruleId,
        ...(focusVisibleRange ?? cssBaseBlockRange),
        focusLine: firstMatchingLineFromPatterns(
          cssCode,
          [/outline\s*:/, /box-shadow\s*:/, /border\s*:/, /:focus-visible/],
          midpointLine(focusVisibleRange ?? cssBaseBlockRange)
        ),
        label: finding.ruleName,
        status,
        target: "css"
      };
    case "rule-5-text-contrast":
      return {
        id: finding.ruleId,
        ...cssBaseBlockRange,
        focusLine: firstMatchingLineFromPatterns(
          cssCode,
          [/color\s*:/, /background(?:-color)?\s*:/, /\.icon-btn\s*\{/],
          midpointLine(cssBaseBlockRange)
        ),
        label: finding.ruleName,
        status,
        target: "css"
      };
    case "rule-7-target-size":
      return {
        id: finding.ruleId,
        ...firstSingleLineRangeFromPatterns(
          cssCode,
          [/min-width\s*:/, /min-height\s*:/, /\.icon-btn\s*\{/],
          cssBaseBlockRange.startLine
        ),
        focusLine: firstMatchingLineFromPatterns(
          cssCode,
          [/min-width\s*:/, /min-height\s*:/, /\.icon-btn\s*\{/],
          cssBaseBlockRange.startLine
        ),
        label: finding.ruleName,
        status,
        target: "css"
      };
    case "rule-8-disabled-state":
      return {
        id: finding.ruleId,
        ...(disabledRange ??
          firstSingleLineRangeFromPatterns(
            cssCode,
            [/:disabled/, /disabled/, /\.icon-btn\s*\{/],
            cssBaseBlockRange.startLine
          )),
        focusLine: firstMatchingLineFromPatterns(
          cssCode,
          [/cursor\s*:/, /opacity\s*:/, /background\s*:/, /:disabled/],
          midpointLine(disabledRange ?? cssBaseBlockRange)
        ),
        label: finding.ruleName,
        status,
        target: "css"
      };
    case "rule-9-state-coverage":
      return {
        id: finding.ruleId,
        ...firstRangeFromPatterns(
          cssCode,
          [/\.icon-btn\s*\{[\s\S]*?\}/m, /button\s*\{[\s\S]*?\}/m],
          cssBaseBlockRange
        ),
        focusLine: firstMatchingLineFromPatterns(
          cssCode,
          [/:hover/, /:focus-visible/, /:active/, /:disabled/, /\.icon-btn\s*\{/],
          midpointLine(cssBaseBlockRange)
        ),
        label: finding.ruleName,
        status,
        target: "css"
      };
    default:
      return {
        id: finding.ruleId,
        ...fallbackTsxRange,
        focusLine: midpointLine(fallbackTsxRange),
        label: finding.ruleName,
        status,
        target: "tsx"
      };
  }
}

function buildAnnotations(
  evaluationResult: EvaluationResult | null,
  reactCode: string,
  cssCode: string
): CodeAnnotation[] {
  if (!evaluationResult) {
    return [];
  }
  return evaluationResult.findings
    .filter((finding) => finding.status === "Fail" || finding.status === "Unknown")
    .map((finding) => mapFindingToAnnotation(finding, reactCode, cssCode));
}

function normalizeLineRange(range: LineRange, code: string): LineRange {
  const totalLines = Math.max(code.split("\n").length, 1);
  const startLine = Math.min(Math.max(range.startLine, 1), totalLines);
  const endLine = Math.min(Math.max(range.endLine, startLine), totalLines);
  return { startLine, endLine };
}

function lineToPixel(line: number): number {
  return TEXTAREA_TOP_PADDING + (line - 1) * TEXTAREA_LINE_HEIGHT;
}

function rangeHeightPx(range: LineRange): number {
  const lineSpan = Math.max(range.endLine - range.startLine + 1, 1);
  return Math.max(lineSpan * TEXTAREA_LINE_HEIGHT, 24);
}

function annotationRegionStyle(annotation: CodeAnnotation, code: string) {
  const range = normalizeLineRange(annotation, code);
  return {
    top: `${lineToPixel(range.startLine)}px`,
    height: `${rangeHeightPx(range)}px`
  };
}

function markerTopPx(annotation: CodeAnnotation, code: string): number {
  const range = normalizeLineRange(annotation, code);
  return lineToPixel(range.startLine) + rangeHeightPx(range) / 2;
}

function annotationFocusLineOffsetPx(annotation: CodeAnnotation, code: string): number {
  const range = normalizeLineRange(annotation, code);
  const focusLine = Math.min(Math.max(annotation.focusLine, range.startLine), range.endLine);
  const relativeLineIndex = focusLine - range.startLine;
  return relativeLineIndex * TEXTAREA_LINE_HEIGHT + TEXTAREA_LINE_HEIGHT / 2;
}

function scrollTextareaToLine(textarea: HTMLTextAreaElement, line: number) {
  const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20;
  const targetTop = Math.max((line - 1) * lineHeight - textarea.clientHeight * 0.35, 0);
  textarea.scrollTo({ top: targetTop, behavior: "smooth" });
}

function buildPreviewMarkup(reactCode: string): string | null {
  const buttonMatch = reactCode.match(/<button\b[\s\S]*?<\/button>/m);
  if (!buttonMatch) {
    return null;
  }

  return buttonMatch[0]
    .replace(/\bclassName=/g, "class=")
    .replace(/\s+onClick=\{[^}]*\}/g, "")
    .replace(/\s+\w+=\{[^}]*\}/g, "");
}

function buildPreviewDocument(reactCode: string, cssCode: string): string {
  const buttonMarkup = buildPreviewMarkup(reactCode);
  const content = buttonMarkup
    ? `<div class="preview-canvas">${buttonMarkup}</div>`
    : '<div class="preview-empty">No renderable <button> found in current React editor content.</div>';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        background: #0f141d;
        color: #d6deeb;
        font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      }
      .preview-canvas {
        min-height: 120px;
        padding: 16px;
        display: flex;
        align-items: center;
        justify-content: flex-start;
      }
      .preview-empty {
        min-height: 120px;
        padding: 16px;
        color: #9aa6ba;
        font-size: 12px;
        display: flex;
        align-items: center;
      }
      ${cssCode}
    </style>
  </head>
  <body>
    ${content}
    <script>
      (function () {
        const previewButton = document.querySelector("button");
        if (!previewButton) return;
        if (!previewButton.getAttribute("type")) {
          previewButton.setAttribute("type", "button");
        }
        previewButton.addEventListener("click", function (event) {
          event.preventDefault();
        });
      })();
    </script>
  </body>
</html>`;
}

export function WorkspacePane({
  reactCode,
  cssCode,
  evaluationResult,
  selectedFindingRuleId,
  isEvaluating,
  onReactCodeChange,
  onCssCodeChange,
  onLoadSample,
  onEvaluate
}: WorkspacePaneProps) {
  const annotations = useMemo(
    () => buildAnnotations(evaluationResult, reactCode, cssCode),
    [evaluationResult, reactCode, cssCode]
  );
  const previewDocument = useMemo(() => buildPreviewDocument(reactCode, cssCode), [reactCode, cssCode]);
  const tsxAnnotations = annotations.filter((annotation) => annotation.target === "tsx");
  const cssAnnotations = annotations.filter((annotation) => annotation.target === "css");
  const selectedAnnotation = selectedFindingRuleId
    ? annotations.find((annotation) => annotation.id === selectedFindingRuleId) ?? null
    : null;

  const tsxEditorBlockRef = useRef<HTMLDivElement>(null);
  const cssEditorBlockRef = useRef<HTMLDivElement>(null);
  const tsxTextareaRef = useRef<HTMLTextAreaElement>(null);
  const cssTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [tsxScrollTop, setTsxScrollTop] = useState(0);
  const [cssScrollTop, setCssScrollTop] = useState(0);

  useEffect(() => {
    if (!selectedAnnotation) {
      return;
    }

    const targetBlockRef = selectedAnnotation.target === "tsx" ? tsxEditorBlockRef : cssEditorBlockRef;
    const targetTextareaRef = selectedAnnotation.target === "tsx" ? tsxTextareaRef : cssTextareaRef;

    targetBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (targetTextareaRef.current) {
      window.setTimeout(() => {
        if (targetTextareaRef.current) {
          scrollTextareaToLine(targetTextareaRef.current, midpointLine(selectedAnnotation));
        }
      }, 120);
    }
  }, [selectedAnnotation]);

  return (
    <section className="workspace">
      <div className="workspace-tabs">
        <button className="tab active">ButtonCode.tsx</button>
        <button className="tab">ButtonCode.css</button>
        <button className="tab">index.tsx</button>
      </div>

      <div className="workspace-toolbar">
        <button type="button" className="tab active" onClick={onLoadSample}>
          Load Component Code
        </button>
        <button type="button" className="evaluate-btn" onClick={onEvaluate} disabled={isEvaluating}>
          {isEvaluating ? "Evaluating..." : "Run Accessibility Check"}
        </button>
      </div>

      <section className="editor-block preview-block">
        <div className="preview-header">
          <p className="preview-title">Live Component Preview</p>
          <span className="muted">Hover directly, then click and press Tab for focus-visible</span>
        </div>
        <iframe
          title="Live button component preview"
          className="component-preview-frame"
          srcDoc={previewDocument}
          sandbox="allow-scripts"
        />
      </section>

      <div className="editor-stack">
        <div
          ref={tsxEditorBlockRef}
          className={`editor-block ${
            selectedAnnotation?.target === "tsx" ? "editor-block-located" : ""
          }`}
        >
          <label htmlFor="react-code-input">React Button Component (required)</label>
          <div className="code-editor-shell">
            <div className="code-issue-gutter" aria-hidden="true">
              <div
                className="code-gutter-track"
                style={{ transform: `translateY(-${tsxScrollTop}px)` }}
              >
                {tsxAnnotations.map((annotation) => (
                  <span
                    key={annotation.id}
                    className={`code-gutter-marker ${annotation.status.toLowerCase()} ${
                      selectedFindingRuleId === annotation.id ? "selected" : ""
                    }`}
                    style={{ top: `${markerTopPx(annotation, reactCode)}px` }}
                  />
                ))}
              </div>
            </div>
            <div className="code-input-wrap">
              <textarea
                ref={tsxTextareaRef}
                id="react-code-input"
                className="code-input"
                value={reactCode}
                onChange={(event) => onReactCodeChange(event.target.value)}
                onScroll={(event) => setTsxScrollTop(event.currentTarget.scrollTop)}
                placeholder={SAMPLE_TSX}
                spellCheck={false}
              />
              <div className="code-issue-overlay" aria-hidden="true">
                <div
                  className="code-issue-overlay-track"
                  style={{ transform: `translateY(-${tsxScrollTop}px)` }}
                >
                  {tsxAnnotations.map((annotation) => (
                    <div
                      key={annotation.id}
                      className={`code-issue-region ${annotation.status.toLowerCase()} ${
                        selectedFindingRuleId === annotation.id ? "selected" : ""
                      }`}
                      style={annotationRegionStyle(annotation, reactCode)}
                    >
                      <span
                        className={`code-issue-focus-line ${annotation.status.toLowerCase()} ${
                          selectedFindingRuleId === annotation.id ? "selected" : ""
                        }`}
                        style={{ top: `${annotationFocusLineOffsetPx(annotation, reactCode)}px` }}
                      />
                      <span>{annotation.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          ref={cssEditorBlockRef}
          className={`editor-block ${
            selectedAnnotation?.target === "css" ? "editor-block-located" : ""
          }`}
        >
          <label htmlFor="css-code-input">Optional CSS</label>
          <div className="code-editor-shell">
            <div className="code-issue-gutter" aria-hidden="true">
              <div
                className="code-gutter-track"
                style={{ transform: `translateY(-${cssScrollTop}px)` }}
              >
                {cssAnnotations.map((annotation) => (
                  <span
                    key={annotation.id}
                    className={`code-gutter-marker ${annotation.status.toLowerCase()} ${
                      selectedFindingRuleId === annotation.id ? "selected" : ""
                    }`}
                    style={{ top: `${markerTopPx(annotation, cssCode)}px` }}
                  />
                ))}
              </div>
            </div>
            <div className="code-input-wrap">
              <textarea
                ref={cssTextareaRef}
                id="css-code-input"
                className="code-input css"
                value={cssCode}
                onChange={(event) => onCssCodeChange(event.target.value)}
                onScroll={(event) => setCssScrollTop(event.currentTarget.scrollTop)}
                placeholder={SAMPLE_CSS}
                spellCheck={false}
              />
              <div className="code-issue-overlay" aria-hidden="true">
                <div
                  className="code-issue-overlay-track"
                  style={{ transform: `translateY(-${cssScrollTop}px)` }}
                >
                  {cssAnnotations.map((annotation) => (
                    <div
                      key={annotation.id}
                      className={`code-issue-region ${annotation.status.toLowerCase()} ${
                        selectedFindingRuleId === annotation.id ? "selected" : ""
                      }`}
                      style={annotationRegionStyle(annotation, cssCode)}
                    >
                      <span
                        className={`code-issue-focus-line ${annotation.status.toLowerCase()} ${
                          selectedFindingRuleId === annotation.id ? "selected" : ""
                        }`}
                        style={{ top: `${annotationFocusLineOffsetPx(annotation, cssCode)}px` }}
                      />
                      <span>{annotation.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export const SAMPLE_BUTTON_TSX = SAMPLE_TSX;
export const SAMPLE_BUTTON_CSS = SAMPLE_CSS;
