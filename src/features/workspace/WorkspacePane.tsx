import { useEffect, useMemo, useRef, useState } from "react";
import type { EvaluationResult, RuleResult } from "../orchestrator/types/evaluation";
import { LiveButtonPreview, type ButtonPreviewState } from "./LiveButtonPreview";

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
  --Bg-Brand: #0540AB;
  --Bg-Brand-Hover: #022D7F;
  --Bg-Brand-Active: #011D53;
  --Text-On-Brand: #FFFFFF;
  --Focus-Ring: #011D53;
  --Bg-Disabled: #BDBDBD;
  --Text-Disabled: #8C8C8C;
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
  outline: 3px solid var(--Focus-Ring, #011D53);
  outline-offset: 2px;
}

.icon-btn:hover {
  background: var(--Bg-Brand-Hover, #022D7F);
}

.icon-btn:active {
  background: var(--Bg-Brand-Active, #011D53);
}

.icon-btn:disabled {
  background: var(--Bg-Disabled, #BDBDBD);
  color: var(--Text-Disabled, #8C8C8C);
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
  hasLoadedComponentCode: boolean;
  loadedComponentName: string | null;
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
  findCssSelectorBlockRange(cssCode, /\.icon-btn\.icon-btn--disabled\s*\{[\s\S]*?\}/m) ??
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
case "rule-5-text-contrast": {
  const isDisabledTextContrast = finding.evidence.includes("disabled-state");

  const targetRange =
    isDisabledTextContrast && disabledRange
      ? disabledRange
      : cssBaseBlockRange;

  return {
    id: finding.ruleId,
    ...targetRange,
    focusLine: firstMatchingLineFromPatterns(
      cssCode,
      isDisabledTextContrast
        ? [/color\s*:\s*var\(--Text-Disabled/, /color\s*:/]
        : [/color\s*:/, /background(?:-color)?\s*:/, /\.icon-btn\s*\{/],
      midpointLine(targetRange)
    ),
    label: finding.ruleName,
    status,
    target: "css"
  };
}
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

export function WorkspacePane({
  reactCode,
  cssCode,
  hasLoadedComponentCode,
  loadedComponentName,
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
  const tsxAnnotations = annotations.filter((annotation) => annotation.target === "tsx");
  const cssAnnotations = annotations.filter((annotation) => annotation.target === "css");
  const selectedAnnotation = selectedFindingRuleId
    ? annotations.find((annotation) => annotation.id === selectedFindingRuleId) ?? null
    : null;

  const [selectedButtonState, setSelectedButtonState] = useState<ButtonPreviewState>("default");
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">("light");

  const stateOptions: { value: ButtonPreviewState; label: string }[] = [
    { value: "default", label: "Default" },
    { value: "hover", label: "Hover" },
    { value: "active", label: "Active" },
    { value: "disabled", label: "Disabled" },
    { value: "focused", label: "Focused" },
  ];
  const hasComponentStates = stateOptions.length > 0;

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
        <button type="button" className="load-component-btn" onClick={onLoadSample}>
          Load Component Code
        </button>
        <button
          type="button"
          className="evaluate-btn"
          onClick={onEvaluate}
          disabled={isEvaluating || !hasLoadedComponentCode}
          title={!hasLoadedComponentCode ? "Load component code first" : undefined}
        >
          {isEvaluating ? "Evaluating..." : "Run Accessibility Check"}
        </button>
      </div>

      <section className="editor-block preview-block">
        <div className="preview-header">
          <p className="preview-title">
            Live Component Preview: {loadedComponentName ?? "No component loaded"}
          </p>
          {hasLoadedComponentCode && loadedComponentName && hasComponentStates && (
            <div className="component-state-switcher">
              <div className="preview-state-control">
                <label htmlFor="button-state-select" className="component-state-switcher__label">
                  {loadedComponentName} state
                </label>
                <select
                  id="button-state-select"
                  className="preview-state-select"
                  value={selectedButtonState}
                  onChange={(e) => setSelectedButtonState(e.target.value as ButtonPreviewState)}
                >
                  {stateOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <div className="preview-theme-toggle" role="group" aria-label="Preview theme">
            <button
              type="button"
              className={`preview-theme-toggle__button${previewTheme === "light" ? " preview-theme-toggle__button--active" : ""}`}
              aria-label="Preview component in light mode"
              aria-pressed={previewTheme === "light"}
              onClick={() => setPreviewTheme("light")}
            >
              <span className="preview-theme-toggle__icon">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4"/>
                  <line x1="12" y1="2" x2="12" y2="6"/>
                  <line x1="12" y1="18" x2="12" y2="22"/>
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
                  <line x1="2" y1="12" x2="6" y2="12"/>
                  <line x1="18" y1="12" x2="22" y2="12"/>
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
                </svg>
              </span>
              Light
            </button>
            <button
              type="button"
              className={`preview-theme-toggle__button${previewTheme === "dark" ? " preview-theme-toggle__button--active" : ""}`}
              aria-label="Preview component in dark mode"
              aria-pressed={previewTheme === "dark"}
              onClick={() => setPreviewTheme("dark")}
            >
              <span className="preview-theme-toggle__icon">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              </span>
              Dark
            </button>
          </div>
        </div>
        <LiveButtonPreview cssCode={cssCode} reactCode={reactCode} selectedState={selectedButtonState} hasLoadedCode={hasLoadedComponentCode} previewTheme={previewTheme} />
      </section>

      {hasLoadedComponentCode && <div className="editor-stack">
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
      </div>}
    </section>
  );
}

export const SAMPLE_BUTTON_TSX = SAMPLE_TSX;
export const SAMPLE_BUTTON_CSS = SAMPLE_CSS;
