/**
 * Text line-wrap algorithm ported from `python/src/system.py` lines 60-90
 * (the `wrap_text` function).
 *
 *   - Respects explicit line breaks via the literal `\n` marker in JSON
 *     (i.e., the two-character backslash-n, not a real newline).
 *   - Greedy word wrap to fit each manual line within `maxWidth`.
 *
 * We use {@link measureText} to avoid reaching into the DOM.
 */

import { measureText } from "./measure";

export function wrapText(text: string, font: string, maxWidth: number): string[] {
  // Python splits on the literal string "\\n" i.e. two chars: backslash + n.
  const manualLines = text.split("\\n");

  const all: string[] = [];
  for (const manualLine of manualLines) {
    if (!manualLine.trim()) {
      all.push("");
      continue;
    }

    const words = manualLine.split(/\s+/);
    let current: string[] = [];

    for (const word of words) {
      const test = [...current, word].join(" ");
      const { width } = measureText(test, font);
      if (width <= maxWidth) {
        current.push(word);
      } else {
        if (current.length > 0) all.push(current.join(" "));
        current = [word];
      }
    }

    if (current.length > 0) all.push(current.join(" "));
  }

  return all;
}
