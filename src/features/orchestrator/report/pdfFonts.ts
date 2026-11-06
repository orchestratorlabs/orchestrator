/**
 * Text handling for the PDF export: the report is set in the PDF standard fonts
 * Helvetica and Helvetica-Bold (WinAnsi / Windows-1252 encoding), so it needs no
 * embedded font and no dependency, and the text stays selectable.
 *
 * Two jobs live here:
 *  - `toWinAnsi` converts report text to that encoding. Characters the encoding
 *    cannot hold become "?" and are counted, so the caller can say so in the PDF
 *    rather than silently dropping a reviewer's words.
 *  - `textWidth` measures text (Adobe Helvetica metrics) so lines wrap inside the
 *    page margins.
 */

export type PdfFont = "regular" | "bold";

/** Unicode characters in Windows-1252's 0x80–0x9F block, mapped to their byte. */
const CP1252_EXTRA: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87,
  "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91,
  "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98,
  "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};

/** Common characters outside Windows-1252 that have a faithful plain-ASCII form. */
const ASCII_FALLBACK: Record<string, string> = {
  "→": "->", "←": "<-", "≥": ">=", "≤": "<=", "≠": "!=", "−": "-", "‐": "-", "‑": "-",
  "‒": "-", "✓": "v", "✔": "v", "✗": "x", "✘": "x", " ": " ", " ": " ",
  "​": "", "﻿": "", " ": " ", " ": " ", " ": " ", " ": " ",
};

export interface WinAnsiText {
  /** One character per byte (code ≤ 255); line breaks are kept as \\n. */
  text: string;
  /** How many characters were replaced with "?". */
  replaced: number;
}

export function toWinAnsi(input: string): WinAnsiText {
  let out = "";
  let replaced = 0;
  // Line breaks in a reviewer's note are kept (the layout wraps on them).
  for (const ch of input.normalize("NFC").replace(/\r\n?/g, "\n")) {
    const code = ch.codePointAt(0)!;
    if (code === 0x0a) out += "\n";
    else if (code === 0x09) out += "    ";
    else if (code < 0x20 || code === 0x7f) continue;
    else if (code < 0x7f) out += ch;
    else if (code === 0xa0) out += " ";
    else if (CP1252_EXTRA[ch] !== undefined) out += String.fromCharCode(CP1252_EXTRA[ch]);
    else if (code >= 0xa1 && code <= 0xff) out += ch;
    else if (ASCII_FALLBACK[ch] !== undefined) out += ASCII_FALLBACK[ch];
    else {
      out += "?";
      replaced += 1;
    }
  }
  return { text: out, replaced };
}

// ── Adobe Helvetica / Helvetica-Bold advance widths, ASCII 32–126 (1000-unit em) ──
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/** Widths for the non-ASCII bytes that are not just an accented ASCII letter. */
const SPECIAL: Record<number, [number, number]> = {
  0x80: [556, 556], 0x82: [222, 278], 0x84: [333, 500], 0x85: [1000, 1000], 0x86: [556, 556],
  0x87: [556, 556], 0x89: [1000, 1000], 0x91: [222, 278], 0x92: [222, 278], 0x93: [333, 500],
  0x94: [333, 500], 0x95: [350, 350], 0x96: [556, 556], 0x97: [1000, 1000], 0x99: [1000, 1000],
  0xa1: [333, 333], 0xa2: [556, 556], 0xa3: [556, 556], 0xa7: [556, 556], 0xa9: [737, 737],
  0xab: [556, 556], 0xae: [737, 737], 0xb0: [400, 400], 0xb1: [584, 584], 0xb5: [556, 611],
  0xb6: [537, 556], 0xb7: [278, 278], 0xbb: [556, 556], 0xbf: [611, 611], 0xc6: [1000, 1000],
  0xd7: [584, 584], 0xd8: [778, 778], 0xdf: [611, 611], 0xe6: [889, 889], 0xf7: [584, 584],
  0xf8: [611, 611],
};

const FALLBACK_WIDTH: [number, number] = [556, 611];

function baseWidth(code: number, font: PdfFont): number {
  const index = font === "bold" ? 1 : 0;
  if (code >= 32 && code <= 126) return (font === "bold" ? HELVETICA_BOLD : HELVETICA)[code - 32];
  const special = SPECIAL[code];
  if (special) return special[index];
  // Accented Latin-1 letters share the width of their base letter.
  const base = String.fromCharCode(code).normalize("NFD").charCodeAt(0);
  if (base >= 32 && base <= 126) return (font === "bold" ? HELVETICA_BOLD : HELVETICA)[base - 32];
  return FALLBACK_WIDTH[index];
}

/** Width in points of WinAnsi text (as returned by `toWinAnsi`) at `size`. */
export function textWidth(text: string, font: PdfFont, size: number): number {
  let units = 0;
  for (let i = 0; i < text.length; i += 1) units += baseWidth(text.charCodeAt(i), font);
  return (units / 1000) * size;
}
