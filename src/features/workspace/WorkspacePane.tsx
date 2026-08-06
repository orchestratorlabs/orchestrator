import { useEffect, useMemo, useRef, useState } from "react";
import type { EvaluationResult, RuleResult } from "../orchestrator/types/evaluation";
import {
  FALLBACK_SELECTOR,
  TARGET_DISABLED_MODIFIER,
  TARGET_SELECTOR,
  cssBlockPattern,
  cssSelectorOpenPattern
} from "../orchestrator/evaluator/targetSelector";
import { tokenNameForDeclaration } from "../orchestrator/cssVariables";
import { LiveButtonPreview, type ButtonPreviewState } from "./LiveButtonPreview";

/**
 * CSS-editor highlight patterns, derived from the shared selector contract so
 * they cannot drift from the rules in `buttonEvaluator`.
 */
const TARGET_BLOCK = cssBlockPattern(TARGET_SELECTOR);
const TARGET_OPEN = cssSelectorOpenPattern(TARGET_SELECTOR);
const TARGET_FOCUS_BLOCK = cssBlockPattern(`${TARGET_SELECTOR}:focus-visible`);
const TARGET_DISABLED_BLOCK = cssBlockPattern(`${TARGET_SELECTOR}:disabled`);
const TARGET_DISABLED_MODIFIER_BLOCK = cssBlockPattern(TARGET_DISABLED_MODIFIER);
const FALLBACK_BLOCK = cssBlockPattern(FALLBACK_SELECTOR);
const FALLBACK_FOCUS_BLOCK = cssBlockPattern(`${FALLBACK_SELECTOR}:focus-visible`);
const FALLBACK_DISABLED_BLOCK = cssBlockPattern(`${FALLBACK_SELECTOR}:disabled`);

const SAMPLE_TSX = `import React from "react";
import "./Button.css";

type ButtonProps = {
  onClick?: () => void;
  disabled?: boolean;
};

export function Button({
  onClick,
  disabled = false,
}: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn"
      disabled={disabled}
    >
      <span className="btn__label">Button large</span>
    </button>
  );
}`;

const SAMPLE_CSS = `@import url("https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;500;600;700&display=swap");

:root {
  /* Design tokens — the values that ship. Change these to change the button. */
  --Corner-M: 0.5rem;
  --Bg-Brand: #0540AB;
  --Bg-Brand-Hover: #022D7F;
  --Bg-Brand-Active: #011D53;
  --Text-On-Brand: #FFFFFF;
  --Focus-Ring: #011D53;
  --Bg-Disabled: #BDBDBD;
  --Text-Disabled: #8C8C8C;
}

.btn {
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
  font-family: "Atkinson Hyperlegible Next", Arial, sans-serif;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.2;
}

.btn:focus-visible {
  outline: 3px solid var(--Focus-Ring, #011D53);
  outline-offset: 2px;
}

.btn:hover {
  background: var(--Bg-Brand-Hover, #022D7F);
}

.btn:active {
  background: var(--Bg-Brand-Active, #011D53);
}

/* var(token, fallback): the fallback applies only if the token is undefined. */
.btn:disabled {
  background: var(--Bg-Disabled, #BDBDBD);
  color: var(--Text-Disabled, #8C8C8C);
  cursor: not-allowed;
  opacity: 1;
}`;

const SAMPLE_CSS_DARK = `@import url("https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;500;600;700&display=swap");

:root {
  /* Design tokens — the values that ship. Change these to change the button. */
  --Corner-M: 0.5rem;
  --Bg-Brand: #8DB6FF;
  --Bg-Brand-Hover: #5E97FF;
  --Bg-Brand-Active: #367BF9;
  --Text-On-Brand: #1A1A1A;
  --Focus-Ring: #367BF9;
  --Bg-Disabled: #D5D5D5;
  --Text-Disabled: #595959;
}

.btn {
  min-width: 44px;
  min-height: 44px;
  padding: 10px 14px;
  border: none;
  border-radius: var(--Corner-M, 0.5rem);
  background: var(--Bg-Brand, #8DB6FF);
  color: var(--Text-On-Brand, #1A1A1A);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  font-family: "Atkinson Hyperlegible Next", Arial, sans-serif;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.2;
}

.btn:focus-visible {
  outline: 3px solid var(--Focus-Ring, #367BF9);
  outline-offset: 2px;
}

.btn:hover {
  background: var(--Bg-Brand-Hover, #5E97FF);
}

.btn:active {
  background: var(--Bg-Brand-Active, #367BF9);
}

/* var(token, fallback): the fallback applies only if the token is undefined. */
.btn:disabled {
  background: var(--Bg-Disabled, #D5D5D5);
  color: var(--Text-Disabled, #595959);
  cursor: not-allowed;
  opacity: 1;
}`;

interface WorkspacePaneProps {
  reactCode: string;
  cssCode: string;
  hasLoadedComponentCode: boolean;
  loadedComponentName: string | null;
  evaluationResult: EvaluationResult | null;
  selectedFindingRuleId: string | null;
  isEvaluating: boolean;
  previewTheme: "light" | "dark";
  onReactCodeChange: (value: string) => void;
  onCssCodeChange: (value: string) => void;
  onLoadSample: () => void;
  onEvaluate: () => void;
  onPreviewThemeChange: (theme: "light" | "dark") => void;
  onTogglePanel: () => void;
  onA11yDoubleCheck: () => void;
  isDoubleChecking: boolean;
  a11yDoubleCheckError: string | null;
  /** False on hosted deployments, where the local Flask service cannot be reached. */
  isBackendReachable: boolean;
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

/**
 * Single-line range of the custom-property declaration that `propertyName` inside
 * `blockRange` depends on — e.g. the `--Text-Disabled: …;` line in `:root` for a
 * block whose `color` reads `var(--Text-Disabled, …)`.
 *
 * Used to send a finding to the line that actually changes the rendered value.
 * Returns null when the declaration does not use a token, or the token is not
 * declared anywhere, in which case callers keep their existing behaviour.
 */
function tokenDeclarationRange(
  cssCode: string,
  blockRange: LineRange | null,
  propertyName: string
): LineRange | null {
  if (!blockRange) {
    return null;
  }
  const blockText = cssCode.split("\n").slice(blockRange.startLine - 1, blockRange.endLine).join("\n");
  const tokenName = tokenNameForDeclaration(blockText, propertyName);
  if (!tokenName) {
    return null;
  }
  const escaped = tokenName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return rangeFromPattern(cssCode, new RegExp(`${escaped}\\s*:\\s*[^;]+;`, "m"));
}

/**
 * Line-number rail for a code editor.
 *
 * Positions each number with the same `lineToPixel` used by the issue markers
 * and the annotation overlay, and is translated by the textarea's own
 * `scrollTop`, so all three stay locked together.
 *
 * This is only correct while one logical line occupies one visual row, which is
 * why the editors set `wrap="off"`. With soft wrapping, a line longer than the
 * editor takes two rows and everything below it drifts — the numbers, the
 * markers and the highlight boxes alike.
 */
function CodeLineNumbers({ code, scrollTop }: { code: string; scrollTop: number }) {
  const lineCount = Math.max(code.split("\n").length, 1);
  return (
    <div className="code-line-numbers" aria-hidden="true">
      <div className="code-line-numbers-track" style={{ transform: `translateY(-${scrollTop}px)` }}>
        {Array.from({ length: lineCount }, (_, index) => (
          <span key={index + 1} className="code-line-number" style={{ top: `${lineToPixel(index + 1)}px` }}>
            {index + 1}
          </span>
        ))}
      </div>
    </div>
  );
}

function mapFindingToAnnotation(finding: RuleResult, reactCode: string, cssCode: string): CodeAnnotation {
  const fallbackTsxRange = firstRangeFromPatterns(
    reactCode,
    [/<button\b[\s\S]*?<\/button>/m, /<(div|span)\b[\s\S]*?<\/(div|span)>/m],
    { startLine: 1, endLine: 1 }
  );
  const fallbackCssRange = firstRangeFromPatterns(
    cssCode,
    [TARGET_BLOCK, FALLBACK_BLOCK, /:root\s*\{[\s\S]*?\}/m],
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
    [TARGET_BLOCK, FALLBACK_BLOCK],
    fallbackCssRange
  );
  const focusVisibleRange =
    findCssSelectorBlockRange(cssCode, TARGET_FOCUS_BLOCK) ??
    findCssSelectorBlockRange(cssCode, FALLBACK_FOCUS_BLOCK);
  const disabledRange =
  findCssSelectorBlockRange(cssCode, TARGET_DISABLED_BLOCK) ??
  findCssSelectorBlockRange(cssCode, TARGET_DISABLED_MODIFIER_BLOCK) ??
  findCssSelectorBlockRange(cssCode, FALLBACK_DISABLED_BLOCK);

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

  // Point at the design token rather than the `var()` usage. The token is the
  // value a browser resolves and therefore the line a developer edits; the
  // fallback beside the usage is dead unless the token is undefined. The token
  // name is derived from the failing declaration, so this is not tied to the
  // seeded sample's naming.
  const disabledTokenRange = isDisabledTextContrast
    ? tokenDeclarationRange(cssCode, disabledRange, "color")
    : null;

  const targetRange =
    disabledTokenRange ??
    (isDisabledTextContrast && disabledRange ? disabledRange : cssBaseBlockRange);

  return {
    id: finding.ruleId,
    ...targetRange,
    focusLine: disabledTokenRange
      ? disabledTokenRange.startLine
      : firstMatchingLineFromPatterns(
          cssCode,
          isDisabledTextContrast
            ? [/color\s*:/]
            : [/color\s*:/, /background(?:-color)?\s*:/, TARGET_OPEN],
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
          [/min-width\s*:/, /min-height\s*:/, TARGET_OPEN],
          cssBaseBlockRange.startLine
        ),
        focusLine: firstMatchingLineFromPatterns(
          cssCode,
          [/min-width\s*:/, /min-height\s*:/, TARGET_OPEN],
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
            [/:disabled/, /disabled/, TARGET_OPEN],
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
          [TARGET_BLOCK, FALLBACK_BLOCK],
          cssBaseBlockRange
        ),
        focusLine: firstMatchingLineFromPatterns(
          cssCode,
          [/:hover/, /:focus-visible/, /:active/, /:disabled/, TARGET_OPEN],
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
  previewTheme,
  onReactCodeChange,
  onCssCodeChange,
  onLoadSample,
  onEvaluate,
  onPreviewThemeChange,
  onTogglePanel,
  onA11yDoubleCheck,
  isDoubleChecking,
  a11yDoubleCheckError,
  isBackendReachable,
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
        <div className="workspace-toolbar__actions">
          {!hasLoadedComponentCode ? (
            <div className="orchestrator-btn-wrap">
              <button
                type="button"
                className="workspace-action-btn orchestrator-btn"
                aria-describedby="orchestrator-btn-tooltip"
                onClick={onTogglePanel}
              >
                Open OrchestratoR
              </button>
              <span
                id="orchestrator-btn-tooltip"
                role="tooltip"
                className="a11y-tooltip"
              >
                Load component code before running OrchestratoR checks.
              </span>
            </div>
          ) : (
            <button type="button" className="workspace-action-btn orchestrator-btn" onClick={onTogglePanel}>
              Open OrchestratoR
            </button>
          )}
          <button
            type="button"
            className="workspace-action-btn evaluate-btn"
            onClick={onEvaluate}
            disabled={isEvaluating || !hasLoadedComponentCode}
          >
            {isEvaluating ? "Evaluating..." : "Run Accessibility Check"}
          </button>
          {evaluationResult !== null && isBackendReachable ? (
            <>
              <button
                type="button"
                className="workspace-action-btn a11y-doublecheck-btn"
                onClick={onA11yDoubleCheck}
                disabled={isDoubleChecking}
                aria-busy={isDoubleChecking}
              >
                {isDoubleChecking ? (
                  <>
                    DoubleChecking
                    <span className="a11y-btn-loading-dots" aria-hidden="true">
                      <span className="a11y-btn-dot" />
                      <span className="a11y-btn-dot" />
                      <span className="a11y-btn-dot" />
                    </span>
                  </>
                ) : (
                  "Run A11Y DoubleCheck"
                )}
              </button>
              <span
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
              >
                {isDoubleChecking ? "A11Y DoubleCheck is running." : ""}
              </span>
            </>
          ) : (
            <div className="a11y-doublecheck-wrap">
              <button
                type="button"
                className="workspace-action-btn a11y-doublecheck-btn a11y-doublecheck-btn--inactive"
                aria-disabled="true"
                aria-describedby="a11y-doublecheck-tooltip"
                onClick={(e) => e.preventDefault()}
              >
                Run A11Y DoubleCheck
              </button>
              <span
                id="a11y-doublecheck-tooltip"
                role="tooltip"
                className="a11y-tooltip"
              >
                {evaluationResult === null
                  ? "Run A11Y DoubleCheck after the Accessibility Check."
                  : "A11Y DoubleCheck requires the local Python service and is not available in this hosted demo."}
              </span>
            </div>
          )}
        </div>
        {a11yDoubleCheckError && (
          <div className="a11y-doublecheck-error" role="alert">
            {a11yDoubleCheckError}
          </div>
        )}
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
              onClick={() => onPreviewThemeChange("light")}
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
              Light mode
            </button>
            <button
              type="button"
              className={`preview-theme-toggle__button${previewTheme === "dark" ? " preview-theme-toggle__button--active" : ""}`}
              aria-label="Preview component in dark mode"
              aria-pressed={previewTheme === "dark"}
              onClick={() => onPreviewThemeChange("dark")}
            >
              <span className="preview-theme-toggle__icon">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              </span>
              Dark mode
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
            <CodeLineNumbers code={reactCode} scrollTop={tsxScrollTop} />
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
                wrap="off"
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
            <CodeLineNumbers
              code={previewTheme === "dark" ? SAMPLE_CSS_DARK : cssCode}
              scrollTop={cssScrollTop}
            />
            <div className="code-input-wrap">
              <textarea
                ref={cssTextareaRef}
                id="css-code-input"
                className="code-input css"
                value={previewTheme === "dark" ? SAMPLE_CSS_DARK : cssCode}
                readOnly={previewTheme === "dark"}
                onChange={(event) => onCssCodeChange(event.target.value)}
                onScroll={(event) => setCssScrollTop(event.currentTarget.scrollTop)}
                placeholder={SAMPLE_CSS}
                spellCheck={false}
                wrap="off"
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
export const SAMPLE_BUTTON_CSS_DARK = SAMPLE_CSS_DARK;
