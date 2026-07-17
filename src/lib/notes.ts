// Helpers for appending material onto a node's freeform notes.
//
// Appended blocks are wrapped in an HTML-comment marker so the UI can tell which parts of
// the notes are raw drop-ins that haven't been merged into the prose yet. Markdown renderers
// ignore the comment, so it never shows up in the preview.

export const APPEND_MARKER = '<!-- append -->'

/** Appends a labelled block to the end of `current`, separated by a horizontal rule. */
export function appendBlock(current: string | null | undefined, label: string, content: string): string {
  const body = content.trim()
  if (!body) return current ?? ''
  const block = `${APPEND_MARKER}\n### ${label}\n\n${body}`
  const base = (current ?? '').trimEnd()
  return base ? `${base}\n\n---\n\n${block}\n` : `${block}\n`
}

/** True when the notes contain at least one block that hasn't been merged in yet. */
export function hasPendingAppends(notes: string | null | undefined): boolean {
  return !!notes?.includes(APPEND_MARKER)
}

export function countPendingAppends(notes: string | null | undefined): number {
  if (!notes) return 0
  return notes.split(APPEND_MARKER).length - 1
}
