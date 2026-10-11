/**
 * Pure typing-validation helpers.
 *
 * These live outside `engine.ts` so they can be unit-tested in a plain Node
 * process (the engine constructor needs a canvas to build car sprites, which
 * is not available under `node --test`). The engine imports and uses exactly
 * these functions, so the tests below exercise the real validation rules.
 */

/** How many wrong characters may trail the first mismatch before input locks. */
export const MAX_ERROR_TRAIL = 6;

/**
 * Folds keyboard output that is not the literal ASCII the sentence expects into
 * the character the game actually scores.
 *
 * Covers typographic quotes (phones and macOS substitute curly quotes), Unicode
 * whitespace and the Unicode lookalikes mobile keyboards emit for `/`, `\` and
 * `-` when smart punctuation is enabled.
 */
export function normalizeChar(ch: string): string {
  switch (ch) {
    case "\u2019": // right single quote
    case "\u2018": // left single quote
    case "\u02bc": // modifier apostrophe
    case "\u2032": // prime
      return "'";
    case "\u201c": // left double quote
    case "\u201d": // right double quote
    case "\u2033": // double prime
      return '"';
    case "\u00a0": // nbsp
    case "\u2007": // figure space
    case "\u202f": // narrow nbsp
      return " ";
    case "\u2212": // minus sign
    case "\u2010": // hyphen
    case "\u2011": // non-breaking hyphen
    case "\u2012": // figure dash
    case "\u2013": // en dash
    case "\u2014": // em dash
      return "-";
    case "\uff0f": // fullwidth solidus
    case "\u2044": // fraction slash
      return "/";
    case "\uff3c": // fullwidth reverse solidus
      return "\\";
    default:
      return ch;
  }
}

/**
 * Comparison key for a single character.
 *
 * Typing games are case-insensitive, so letters are case-folded while the
 * displayed sentence and its scoring text stay intact. Punctuation is *not*
 * folded: `/` and `\` (and `'` and `"`) are distinct keystrokes the player has
 * to enter correctly.
 */
export function matchKey(ch: string): string {
  if (!ch) return ch;
  return /[A-Za-z]/.test(ch) ? ch.toLowerCase() : ch;
}

/** Index of the first character in `typed` that does not match `target`, or -1. */
export function firstMismatch(typed: string, target: string): number {
  for (let i = 0; i < typed.length; i++) {
    if (matchKey(typed[i]) !== matchKey(target[i])) return i;
  }
  return -1;
}

/** True when every character of the target has been entered correctly. */
export function isComplete(typed: string, target: string): boolean {
  return typed.length >= target.length && firstMismatch(typed, target) < 0;
}

/** Progress percentage (0-100) of the current line, never exceeding 100. */
export function progressPercent(typedLength: number, targetLength: number): number {
  if (!targetLength) return 0;
  return Math.min(100, (typedLength / targetLength) * 100);
}

/**
 * Simulates one keystroke against a target string, returning the resulting
 * state. Used by the engine and by tests so both share identical rules.
 */
export function applyKey(
  state: { typed: string; correct: number; errors: number },
  raw: string,
  target: string,
): { typed: string; correct: number; errors: number; completed: boolean } {
  const ch = normalizeChar(raw);
  if (ch.length !== 1 || ch === "\n" || ch === "\r") return { ...state, completed: false };

  const mismatch = firstMismatch(state.typed, target);
  if (mismatch >= 0 && state.typed.length - mismatch >= MAX_ERROR_TRAIL) {
    return { ...state, completed: false };
  }
  if (state.typed.length >= target.length + MAX_ERROR_TRAIL) {
    return { ...state, completed: false };
  }

  const idx = state.typed.length;
  const typed = state.typed + ch;
  const isCorrect = mismatch < 0 && idx < target.length && matchKey(ch) === matchKey(target[idx]);

  return {
    typed,
    correct: state.correct + (isCorrect ? 1 : 0),
    errors: state.errors + (isCorrect ? 0 : 1),
    completed: isComplete(typed, target),
  };
}
