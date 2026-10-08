// Detects AI write-ups that were saved cut off — the model hit its output-token cap
// mid-answer and the partial text was stored as if it were complete. The nightly edge
// function (supabase/functions/nightly-autofill/index.ts) carries a copy of the same checks.

const MIN_CHARS = 300 // anything shorter is a stub, not an explainer
const TERMINAL = /[.!?)\]|`*_>"”:]$/

/** True when markdown looks cut off: unclosed code fence, dangling list marker, no closing punctuation, or a stub. */
export function looksTruncated(md: string | null | undefined): boolean {
  const t = (md ?? '').trim()
  if (!t) return false // empty is "no details yet", not "cut off"
  if (t.length < MIN_CHARS) return true
  if ((t.match(/```/g) ?? []).length % 2 === 1) return true
  if (/(^|\n)\s*(\d+[.)]|[-*+])\s*$/.test(t)) return true
  return !TERMINAL.test(t)
}

/** Last-resort tidy for text that is still cut off: drop an unfinished code/diagram block and the dangling tail. */
export function tidyTruncated(md: string): string {
  let out = md.trimEnd()
  if ((out.match(/```/g) ?? []).length % 2 === 1) {
    out = out.slice(0, out.lastIndexOf('```')).trimEnd()
  }
  const cut = out.lastIndexOf('\n\n')
  if (!TERMINAL.test(out) && cut > MIN_CHARS) out = out.slice(0, cut).trimEnd()
  return out
}
