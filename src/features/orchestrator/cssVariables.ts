/**
 * Resolves CSS custom properties so the evaluator and the preview read the value
 * a browser would actually use.
 *
 * Why this exists: `color: var(--Text-Disabled, #8C8C8C)` contains a literal hex,
 * so anything scanning the declaration for `#RRGGBB` picks up the *fallback*. A
 * browser does the opposite — it uses the declared token and ignores the fallback
 * entirely unless the token is undefined. Without this pass, editing the design
 * token changed nothing while editing a dead fallback changed the score.
 *
 * Known limitation: property collection is not scope- or cascade-aware. Every
 * `--name: value` declaration in the stylesheet goes into one map, last one
 * winning. That is correct for the single-`:root` stylesheets this tool
 * evaluates, and wrong for CSS that redeclares a property inside a selector.
 * Worth revisiting if arbitrary pasted CSS becomes a supported case.
 */

/** `var(--name)` or `var(--name, fallback)`. Fallbacks containing further `var()` are not matched. */
const VAR_REFERENCE = /var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,\s*([^()]*?)\s*)?\)/g;

/** `--name: value;` declarations. */
const CUSTOM_PROPERTY_DECLARATION = /(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]+);/g;

/** Guards against a token cycle such as `--a: var(--b); --b: var(--a);`. */
const MAX_RESOLUTION_PASSES = 10;

/** Collects every custom property declared anywhere in the stylesheet. */
export function parseCustomProperties(cssCode: string): Map<string, string> {
  const properties = new Map<string, string>();
  for (const match of cssCode.matchAll(CUSTOM_PROPERTY_DECLARATION)) {
    properties.set(match[1], match[2].trim());
  }
  return properties;
}

/**
 * Substitutes `var()` references with their declared values, falling back to the
 * inline fallback only when the property is genuinely undeclared — which is what
 * a fallback is for. An undeclared property with no fallback is left as-is so it
 * stays visibly unresolved rather than silently becoming something else.
 */
export function resolveCssCustomProperties(cssCode: string): string {
  const properties = parseCustomProperties(cssCode);
  if (!properties.size && !VAR_REFERENCE.test(cssCode)) {
    return cssCode;
  }

  let resolved = cssCode;
  for (let pass = 0; pass < MAX_RESOLUTION_PASSES; pass += 1) {
    const next = resolved.replace(VAR_REFERENCE, (whole, name: string, fallback?: string) => {
      const declared = properties.get(name);
      if (declared !== undefined) {
        return declared;
      }
      return fallback !== undefined ? fallback : whole;
    });
    if (next === resolved) {
      break;
    }
    resolved = next;
  }
  return resolved;
}

/**
 * The custom property a declaration's value depends on, e.g. `--Text-Disabled`
 * for `color: var(--Text-Disabled, #8C8C8C)`.
 *
 * Used to point a finding at the token declaration — the line a developer edits
 * — rather than at the `var()` usage, which a browser ignores.
 */
export function tokenNameForDeclaration(cssBlock: string, propertyName: string): string | null {
  const escaped = propertyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const declaration = cssBlock.match(new RegExp(`${escaped}\\s*:\\s*([^;]+);`));
  if (!declaration) {
    return null;
  }
  const reference = declaration[1].match(/var\(\s*(--[A-Za-z0-9_-]+)/);
  return reference ? reference[1] : null;
}
