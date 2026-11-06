// Helpers for Markdown headings, shared by the renderer and the table of contents.

/** Anchor id for a heading; keeps letters of any script (e.g. Cyrillic). */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[*_`[\]()]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  )
}

/** "## Heading" lines of a Markdown document, for a table of contents. */
export function headingsOf(markdown: string): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = []
  let inCode = false
  for (const line of markdown.split('\n')) {
    if (line.trimStart().startsWith('```')) inCode = !inCode
    const m = !inCode && /^##\s+(.+?)\s*#*$/.exec(line)
    if (m) {
      const text = m[1].replace(/[*_`]/g, '')
      out.push({ id: slugify(text), text })
    }
  }
  return out
}
