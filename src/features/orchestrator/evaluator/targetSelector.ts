/**
 * Single source of truth for the CSS selectors the orchestrator looks for in
 * user-supplied CSS.
 *
 * Two consumers must agree on these values: the rule engine (`buttonEvaluator`)
 * and the finding-to-annotation mapper (`WorkspacePane`, which highlights the
 * matching lines in the CSS editor).
 *
 * Why this is centralised: every lookup is `TARGET_SELECTOR ?? FALLBACK_SELECTOR`,
 * and the seeded sample CSS contains no bare `button` rule. So a selector that
 * no longer matches does not throw — it falls through to a selector that isn't
 * there, and the affected rules quietly degrade to "Unknown" while the health
 * score drops. Changing the component's class name therefore means changing it
 * here, and only here.
 */

/** Class the seeded sample component and its CSS use. */
export const TARGET_SELECTOR = ".btn";

/** Bare element selector tried when the target class is absent from the CSS. */
export const FALLBACK_SELECTOR = "button";

/** State-modifier form, e.g. `.btn.btn--disabled`. */
export const TARGET_DISABLED_MODIFIER = `${TARGET_SELECTOR}${TARGET_SELECTOR}--disabled`;

/** Escapes regex metacharacters so a selector can be embedded in a pattern. */
export function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Matches an entire CSS rule for `selector`, selector through closing brace —
 * e.g. `.btn:disabled { ... }`. Used to derive editor line ranges.
 */
export function cssBlockPattern(selector: string): RegExp {
  return new RegExp(`${escapeForRegExp(selector)}\\s*\\{[\\s\\S]*?\\}`, "m");
}

/**
 * Matches only a rule's opening line — e.g. `.btn {`. Used as a positional hint
 * when a specific declaration cannot be located.
 */
export function cssSelectorOpenPattern(selector: string): RegExp {
  return new RegExp(`${escapeForRegExp(selector)}\\s*\\{`);
}
